/**
 * Assistants de « Recommencer à neuf » sous Windows (fiches 148, 187, 229) : les mêmes que ceux de
 * `reset.ts` et `fresh-start.ts`, en PowerShell (Windows n'a pas `/bin/sh`). Pas de mode Node non
 * plus (fusible RunAsNode coupé). Le travail est écrit en JSON dans le script, passé par
 * `-EncodedCommand` : ni citation de `cmd.exe`, ni fichier `.ps1` (la stratégie d'exécution par
 * défaut de Windows, `Restricted`, refuse `-File` ; `-Command` n'y est pas soumis).
 *
 * Corbeille : les données vont d'abord dans un dossier daté à côté du dossier de données (même
 * volume : un déplacement est un renommage, tout ou rien comme `mv`), avec le LISEZ-MOI, puis ce
 * dossier part dans la Corbeille de Windows (`Microsoft.VisualBasic.FileIO`, livré avec .NET),
 * seulement si un fichier témoin y est d'abord bien arrivé (`CanRecycle`) : sans Corbeille
 * utilisable, Windows supprimerait sans rien dire. Sinon le dossier daté reste là, visible.
 * N'importe pas `electron`.
 */
import type { ResetJob } from './reset'

/** Arguments de `powershell.exe` qui exécutent `script` (UTF-16LE en base64, comme l'attend
 * `-EncodedCommand`). */
export function encodedPowerShell(script: string): string[] {
  return [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-EncodedCommand',
    Buffer.from(script, 'utf16le').toString('base64')
  ]
}

/**
 * Lance `script` dans un PowerShell qui survit à Bobine. Vérifié dans la VM (fiche 229) :
 * PowerShell 5.1 lancé `detached` (sans console) sort aussitôt sans rien faire, et un enfant
 * attaché meurt avec Bobine (objet de tâche de libuv). D'où un relais : un PowerShell attaché et
 * caché, attendu jusqu'au bout (≈ 1 s), lance l'assistant par `Start-Process` (fenêtre cachée) ;
 * créé par un membre du job de libuv (`SILENT_BREAKAWAY_OK`), l'assistant n'en fait pas partie.
 * Rend la ligne de commande du relais : `[programme, arguments]`.
 */
export function detachedPowerShell(powershell: string, scriptFile: string): [string, string[]] {
  const inner = encodedPowerShell(scriptLoader(scriptFile)).join(' ')
  const relay = `Start-Process -FilePath ${psLiteral(powershell)} -WindowStyle Hidden -ArgumentList ${psLiteral(inner)}`
  return [powershell, encodedPowerShell(relay)]
}

/** Longueur maximale d'une ligne de commande de Windows (`CreateProcess`). */
export const MAX_COMMAND_LINE = 32_767

/**
 * Le script est trop long pour la ligne de commande (deux fois encodé : plus de 32 767
 * caractères, vu dans la VM) : il est écrit dans un fichier, lu et exécuté par un `ScriptBlock`
 * (non soumis à la stratégie d'exécution, contrairement à `-File`). Il s'efface à la fin.
 */
export function scriptLoader(scriptFile: string): string {
  return `& ([ScriptBlock]::Create([IO.File]::ReadAllText(${psLiteral(scriptFile)}, [Text.Encoding]::UTF8)))`
}

/**
 * Le script, qui efface son fichier d'abord : déjà lu en entier par `scriptLoader`, et ses `exit`
 * finissent le processus (un effacement placé à la fin ne serait pas toujours atteint).
 */
export const selfDeleting = (script: string, scriptFile: string) =>
  `Remove-Item -LiteralPath ${psLiteral(scriptFile)} -Force -ErrorAction SilentlyContinue\n${script}`

/** Chaîne PowerShell littérale (entre `'`, seul `'` à doubler). */
export const psLiteral = (text: string) => `'${text.replace(/'/g, "''")}'`

/** Première ligne : le travail, en JSON. */
const withJob = (job: unknown, body: string) =>
  `$job = ${psLiteral(JSON.stringify(job))} | ConvertFrom-Json\n${body}`

const WAIT_FOR_APP = String.raw`
$deadline = (Get-Date).AddMilliseconds([int]$job.tenths * 100)
while (Get-Process -Id ([int]$job.pid) -ErrorAction SilentlyContinue) {
  if ((Get-Date) -gt $deadline) { WaitFailed; exit 1 }
  Start-Sleep -Milliseconds 100
}
# Les processus auxiliaires de Chromium finissent juste après l'app.
Start-Sleep -Milliseconds 500
`

/** Corps de l'assistant de réinitialisation (voir `RESET_HELPER` de `reset.ts`, même contrat). */
const RESET_BODY = String.raw`
$ErrorActionPreference = 'Stop'
$LF = [string][char]10; $CRLF = [string][char]13 + [char]10
function Fail([string]$text) {
  try {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $job.failure) | Out-Null
    [IO.File]::WriteAllText($job.failure, $text + $LF)
  } catch {}
}
# Supprime un dossier seulement s'il est vide : Remove-Item demanderait sinon une confirmation,
# impossible en mode non interactif (le script s'arrêterait là, vu dans la VM).
function DropIfEmpty([string]$dir) {
  try {
    if ((Test-Path -LiteralPath $dir) -and -not (Get-ChildItem -LiteralPath $dir -Force)) {
      Remove-Item -LiteralPath $dir -Force
    }
  } catch {}
}
# La Corbeille accepte-t-elle vraiment ce volume ? Sans elle (session sans bureau, volume sans
# corbeille, stratégie), SendToRecycleBin SUPPRIME sans rien dire (vu dans la VM, session SSH).
# Un fichier témoin y est donc envoyé d'abord : il doit apparaître dans le dossier $Recycle.Bin du
# compte, sur ce volume (son fichier $I nomme le chemin d'origine). Sinon, rien n'est recyclé.
function CanRecycle([string]$dir) {
  try {
    Add-Type -AssemblyName Microsoft.VisualBasic
    $canary = Join-Path $dir ('bobine-corbeille-' + [guid]::NewGuid().ToString('N') + '.txt')
    [IO.File]::WriteAllText($canary, 'Bobine')
    [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($canary, 'OnlyErrorDialogs', 'SendToRecycleBin')
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $bin = Join-Path ([IO.Path]::GetPathRoot($canary)) ('$Recycle.Bin\' + $sid)
    $leaf = Split-Path -Leaf $canary
    foreach ($info in @(Get-ChildItem -LiteralPath $bin -Force -Filter '$I*' -ErrorAction SilentlyContinue)) {
      $origin = [Text.Encoding]::Unicode.GetString([IO.File]::ReadAllBytes($info.FullName))
      if ($origin.Contains($leaf)) {
        # Le témoin, et lui seul, est retiré de la Corbeille.
        Remove-Item -LiteralPath $info.FullName -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath (Join-Path $bin ('$R' + $info.Name.Substring(2))) -Force -ErrorAction SilentlyContinue
        return $true
      }
    }
  } catch {}
  return $false
}
function WaitFailed {
  Fail "Bobine (pid $($job.pid)) was still running: nothing was moved."
  Remove-Item -LiteralPath $job.header -Force -ErrorAction SilentlyContinue
}
${WAIT_FOR_APP}
$folder = Join-Path $job.trash $job.name; $n = 2
while (Test-Path -LiteralPath $folder) { $folder = Join-Path $job.trash "$($job.name) $n"; $n++ }
$moved = @(); $detail = $null
try { New-Item -ItemType Directory -Path $folder | Out-Null } catch { $detail = "$($folder): $($_.Exception.Message)" }
if (-not $detail) {
  foreach ($from in @($job.paths)) {
    if (-not (Test-Path -LiteralPath $from)) { continue }
    $base = Split-Path -Leaf $from; $to = Join-Path $folder $base; $n = 2
    while (Test-Path -LiteralPath $to) { $to = Join-Path $folder "$base $n"; $n++ }
    try { Move-Item -LiteralPath $from -Destination $to; $moved += ,@($from, $to) }
    catch {
      $detail = "$($from): $($_.Exception.Message)"
      # Déplacement raté à mi-chemin (fichier ouvert ailleurs) : un dossier vide peut rester.
      DropIfEmpty $to
      break
    }
  }
}
if ($detail) {
  $report = $detail
  foreach ($m in $moved) {
    try {
      if (Test-Path -LiteralPath $m[0]) { throw 'already there' }
      Move-Item -LiteralPath $m[1] -Destination $m[0]
    } catch { $report += $LF + "NOT PUT BACK: $($m[1]) -> $($m[0]) $($_.Exception.Message)" }
  }
  Fail $report
  DropIfEmpty $folder
} else {
  $lines = @(([IO.File]::ReadAllText($job.header)).TrimEnd(), '')
  foreach ($m in $moved) { $lines += "$(Split-Path -Leaf $m[1])  <-  $($m[0])" }
  # Écrit d'un coup, en UTF-8 avec BOM (lu correctement par le Bloc-notes).
  $tmp = Join-Path $folder '.readme.tmp'
  [IO.File]::WriteAllText($tmp, ($lines -join $CRLF) + $CRLF, (New-Object Text.UTF8Encoding $true))
  Move-Item -LiteralPath $tmp -Destination (Join-Path $folder $job.readme)
  if ($job.recycle -and (CanRecycle $job.trash)) {
    try {
      [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($folder, 'OnlyErrorDialogs', 'SendToRecycleBin')
    } catch {}
  }
}
Remove-Item -LiteralPath $job.header -Force -ErrorAction SilentlyContinue
$relaunch = @($job.relaunch)
if ($relaunch.Count -gt 0) {
  $rest = @($relaunch | Select-Object -Skip 1 | ForEach-Object { '"' + $_ + '"' })
  if ($rest.Count -gt 0) { Start-Process -FilePath $relaunch[0] -ArgumentList ($rest -join ' ') }
  else { Start-Process -FilePath $relaunch[0] }
}
exit 0
`

/** Script complet de la réinitialisation sous Windows. */
export function windowsResetScript(job: ResetJob, header: string): string {
  return withJob(
    {
      pid: job.pid,
      tenths: job.waitTenths ?? 600,
      trash: job.trashDir,
      name: job.folderName,
      readme: job.readmeName,
      header,
      failure: job.failureFile,
      paths: job.paths,
      relaunch: job.relaunch ?? [],
      // Essais : `BOBINE_TRASH_DIR` garde le dossier daté là, sans la vraie Corbeille.
      recycle: job.recycle !== false
    },
    RESET_BODY
  )
}

/** Ménage d'un profil temporaire (voir `TEMPORARY_CLEANUP` de `fresh-start.ts`). */
export function windowsCleanupScript(
  dir: string,
  pid: number,
  tenths: number,
  prefix: string
): string {
  return withJob(
    { dir, pid, tenths, prefix },
    String.raw`
if (-not (Split-Path -Leaf $job.dir).StartsWith($job.prefix)) { exit 2 }
function WaitFailed {}
${WAIT_FOR_APP}
Remove-Item -LiteralPath $job.dir -Recurse -Force -ErrorAction SilentlyContinue
`
  )
}
