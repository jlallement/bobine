/**
 * Objets de tâche de Windows par `koffi` (ADR-0050, D9) : cinq fonctions de `kernel32`, sans
 * module à compiler. `koffi` n'est chargé que par `loadJobApi`, appelé sous Windows seulement
 * (`process-safety.ts`) : rien de ce fichier ne s'exécute sur macOS ni sous Linux, dont les apps ne
 * livrent pas `koffi` (`electron-builder.yml`). Essayé dans la VM Windows 11 ARM64 (fiche 229).
 * N'importe pas `electron`.
 */
import { createRequire } from 'node:module'
import type { JobApi, JobHandle } from './process-tree-windows'

const require = createRequire(import.meta.url)

const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000
const JOB_OBJECT_BASIC_ACCOUNTING_INFORMATION = 1
const JOB_OBJECT_EXTENDED_LIMIT_INFORMATION = 9
const PROCESS_TERMINATE = 0x0001
const PROCESS_SET_QUOTA = 0x0100

/** Poignée d'un job, telle que koffi la rend (pointeur opaque). */
interface KoffiJob {
  handle: unknown
}

/** Charge koffi et `kernel32.dll` ; lève si c'est impossible (le repli `taskkill` prend le relais). */
export function loadJobApi(): JobApi {
  const koffi = require('koffi') as typeof import('koffi')
  const kernel32 = koffi.load('kernel32.dll')
  const HANDLE = koffi.pointer('BOBINE_HANDLE', koffi.opaque())
  // Structures de winnt.h, alignement naturel (koffi le calcule).
  const BASIC = koffi.struct('BOBINE_JOBOBJECT_BASIC_LIMIT_INFORMATION', {
    PerProcessUserTimeLimit: 'int64',
    PerJobUserTimeLimit: 'int64',
    LimitFlags: 'uint32',
    MinimumWorkingSetSize: 'uintptr',
    MaximumWorkingSetSize: 'uintptr',
    ActiveProcessLimit: 'uint32',
    Affinity: 'uintptr',
    PriorityClass: 'uint32',
    SchedulingClass: 'uint32'
  })
  const IO_COUNTERS = koffi.struct('BOBINE_IO_COUNTERS', {
    ReadOperationCount: 'uint64',
    WriteOperationCount: 'uint64',
    OtherOperationCount: 'uint64',
    ReadTransferCount: 'uint64',
    WriteTransferCount: 'uint64',
    OtherTransferCount: 'uint64'
  })
  const EXTENDED = koffi.struct('BOBINE_JOBOBJECT_EXTENDED_LIMIT_INFORMATION', {
    BasicLimitInformation: BASIC,
    IoInfo: IO_COUNTERS,
    ProcessMemoryLimit: 'uintptr',
    JobMemoryLimit: 'uintptr',
    PeakProcessMemoryUsed: 'uintptr',
    PeakJobMemoryUsed: 'uintptr'
  })
  const ACCOUNTING = koffi.struct('BOBINE_JOBOBJECT_BASIC_ACCOUNTING_INFORMATION', {
    TotalUserTime: 'int64',
    TotalKernelTime: 'int64',
    ThisPeriodTotalUserTime: 'int64',
    ThisPeriodTotalKernelTime: 'int64',
    TotalPageFaultCount: 'uint32',
    TotalProcesses: 'uint32',
    ActiveProcesses: 'uint32',
    TotalTerminatedProcesses: 'uint32'
  })
  const fn = (name: string, result: unknown, args: unknown[]) =>
    kernel32.func('__stdcall', name, result as never, args as never[])
  const CreateJobObjectW = fn('CreateJobObjectW', HANDLE, ['void *', 'void *'])
  const SetInformationJobObject = fn('SetInformationJobObject', 'bool', [
    HANDLE,
    'int',
    koffi.pointer(EXTENDED),
    'uint32'
  ])
  const QueryInformationJobObject = fn('QueryInformationJobObject', 'bool', [
    HANDLE,
    'int',
    koffi.out(koffi.pointer(ACCOUNTING)),
    'uint32',
    'void *'
  ])
  const AssignProcessToJobObject = fn('AssignProcessToJobObject', 'bool', [HANDLE, HANDLE])
  const TerminateJobObject = fn('TerminateJobObject', 'bool', [HANDLE, 'uint32'])
  const OpenProcess = fn('OpenProcess', HANDLE, ['uint32', 'bool', 'uint32'])
  const CloseHandle = fn('CloseHandle', 'bool', [HANDLE])

  const handleOf = (job: JobHandle) => (job as KoffiJob).handle
  return {
    create() {
      const handle: unknown = CreateJobObjectW(null, null)
      if (!handle) throw new Error('CreateJobObjectW a échoué')
      // KILL_ON_JOB_CLOSE seul : ni BREAKAWAY_OK, ni SILENT_BREAKAWAY_OK.
      const info = { BasicLimitInformation: { LimitFlags: JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE } }
      const size = koffi.sizeof(EXTENDED)
      if (!SetInformationJobObject(handle, JOB_OBJECT_EXTENDED_LIMIT_INFORMATION, info, size)) {
        CloseHandle(handle)
        throw new Error('SetInformationJobObject a échoué')
      }
      return { handle } satisfies KoffiJob
    },
    assign(job, pid) {
      const process: unknown = OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, false, pid)
      if (!process) return false
      try {
        return Boolean(AssignProcessToJobObject(handleOf(job), process))
      } finally {
        CloseHandle(process)
      }
    },
    active(job) {
      const accounting: { ActiveProcesses?: number } = {}
      const size = koffi.sizeof(ACCOUNTING)
      const ok = QueryInformationJobObject(
        handleOf(job),
        JOB_OBJECT_BASIC_ACCOUNTING_INFORMATION,
        accounting,
        size,
        null
      )
      return ok ? (accounting.ActiveProcesses ?? 0) : 0
    },
    terminate(job) {
      TerminateJobObject(handleOf(job), 1)
    },
    close(job) {
      CloseHandle(handleOf(job))
    }
  }
}
