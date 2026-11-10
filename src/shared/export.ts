/**
 * Export d'une conversation (fiche 043) : Markdown lisible (comme l'export de Claude Desktop), ou
 * JSON complet (le fil tel que l'app le garde, pour le réimporter ou l'exploiter). Pur, sans
 * Electron : testable.
 */
import { t } from 'i18next'
import type { ConversationSummary } from './agent'
import { usageSummary } from './app-commands'
import { noticeText, type TranscriptItem, type TranscriptState } from './transcript'
import { hasUsage } from './usage'
import type { MessageOrigin } from './children'
import { handoverName } from './handover'
import { shortHash } from './worktree-cycle'
import { formatCap } from './cost-cap'

export type ExportFormat = 'markdown' | 'json'

/** Taille maximale d'un texte d'outil ou de terminal repris dans le Markdown. */
const MAX_TOOL_TEXT = 4000
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007]*\u0007/g

const pad = (n: number) => String(n).padStart(2, '0')
const dateOf = (now: Date) =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

/** Nom de fichier proposé : titre sans accents ni ponctuation, date du jour, extension. */
export function exportFileName(
  summary: Pick<ConversationSummary, 'title'>,
  format: ExportFormat,
  now = new Date()
): string {
  const slug =
    summary.title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'conversation'
  return `${slug}-${dateOf(now)}.${format === 'json' ? 'json' : 'md'}`
}

export function exportConversation(
  summary: ConversationSummary,
  transcript: TranscriptState,
  format: ExportFormat,
  now = new Date()
): string {
  if (format === 'json') {
    return `${JSON.stringify(
      {
        format: 'bobine-conversation',
        version: 1,
        exportedAt: now.toISOString(),
        conversation: summary,
        transcript
      },
      null,
      2
    )}\n`
  }
  const agent = summary.profileLabel
  const lines: string[] = [
    `# ${summary.title}`,
    '',
    `- ${t('export.agent', { agent })}`,
    `- ${t('export.folder', { folder: summary.workspace })}`,
    `- ${t('export.updatedAt', { date: summary.updatedAt })}`,
    `- ${t('export.exportedAt', { date: dateOf(now) })}`,
    ''
  ]
  for (const item of transcript.items) lines.push(...itemLines(item, transcript, agent), '')
  if (hasUsage(transcript.usage)) lines.push('---', '', usageSummary(transcript.usage, agent), '')
  return `${lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()}\n`
}

const clip = (text: string, max = MAX_TOOL_TEXT) =>
  text.length > max
    ? `${text.slice(0, max)}\n${t('export.omitted', { count: text.length - max })}`
    : text

const fenced = (text: string, lang = '') => ['```' + lang, clip(text.trimEnd()), '```']

const quoted = (text: string) =>
  text
    .trim()
    .split('\n')
    .map((l) => `> ${l}`)

/** Texte dans un bloc de code dont la clôture ne peut pas apparaître dans le texte. */
function longFenced(text: string): string[] {
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map((m) => m[0].length))
  const fence = '`'.repeat(longest + 1)
  return [fence, clip(text.trimEnd()), fence]
}

/** Message d'une autre conversation, ou réveil de la mère (fiche 097) : à la place de « Vous ». */
function originHeading(from: MessageOrigin): string {
  if (from.kind === 'wake') return t('children.from.wake')
  const key = from.kind === 'parent' ? 'children.from.parent' : 'children.from.child'
  return t(key, { title: from.title })
}

function itemLines(item: TranscriptItem, transcript: TranscriptState, agent: string): string[] {
  switch (item.kind) {
    case 'user': {
      const attached = (item.attachments ?? []).map((a) => a.name)
      return [
        `## ${item.from ? originHeading(item.from) : t('export.you')}`,
        '',
        ...(attached.length
          ? [`*${t('export.attachments', { files: attached.join(', ') })}*`, '']
          : []),
        item.text,
        // Textes collés (fiche 155) : leur contenu, à la suite du message.
        ...(item.attachments ?? []).flatMap((a) =>
          a.kind === 'text' ? ['', `*${a.name}*`, '', ...longFenced(a.text)] : []
        )
      ]
    }
    case 'agent':
      return [`## ${agent}`, '', item.text]
    case 'thought':
      return [`> **${t('export.thought')}**`, ...quoted(item.text)]
    case 'tool': {
      const lines = [`**${t('export.tool')}** — ${item.title} *(${item.status})*`]
      for (const content of item.content) {
        if (content.type === 'diff') {
          lines.push('', t('export.changedFile', { path: `\`${content.path}\`` }))
        } else if (content.type === 'content' && content.content.type === 'text') {
          lines.push('', ...fenced(content.content.text))
        } else if (content.type === 'terminal') {
          const output = transcript.terminals?.[content.terminalId]?.output
          if (output) lines.push('', ...fenced(output.replace(ANSI, '')))
        }
      }
      return lines
    }
    case 'plan':
      return [
        `**${t('export.tasks')}**`,
        '',
        ...item.entries.map((e) => `- [${e.status === 'completed' ? 'x' : ' '}] ${e.content}`)
      ]
    case 'notice':
      return [`> ${t('export.notice', { level: `*${item.level}*`, text: noticeText(item) })}`]
    case 'elicitation': {
      const answer =
        item.state === 'accept' && item.content
          ? ` — ${t('export.answer', { answer: `\`${JSON.stringify(item.content)}\`` })}`
          : item.state === 'pending'
            ? ''
            : ` — ${item.state}`
      return [`**${t('export.question')}** — ${item.prompt.message}${answer}`]
    }
    case 'branch':
      return [`> ${t('export.branch', { title: item.fromTitle, n: item.restored })}`]
    case 'handover':
      return [
        item.reason
          ? `> ${t('handover.thread.renewTitle', { agent: item.to.label })}`
          : `> ${t('export.handover', { agent: handoverName(item) })}`
      ]
    case 'worktree-start':
      return [
        `> ${t(item.branch ? 'export.worktreeStart' : 'export.worktreeStartDetached', {
          branch: item.branch ?? '',
          hash: shortHash(item.commit)
        })}${item.subject ? ` — ${item.subject}` : ''}`
      ]
    case 'worktree-setup':
      return worktreeSetupLines(item)
    case 'children-merge': {
      // Fusion enchaînée des filles (fiche 120) : une ligne, une fois finie.
      const merged = item.rows.filter((r) => r.state === 'merged' || r.state === 'up-to-date')
      if (item.status === 'running' || item.status === 'stopping') return []
      return [`> ${t('export.childrenMerge', { base: item.base, count: merged.length })}`]
    }
    case 'compaction':
      return item.summary ? [`> **${t('export.summary')}**`, ...quoted(item.summary)] : []
    case 'review':
      // Relecture (fiche 177) : une ligne par remarque, une fois rendues.
      return [
        `> ${t('review.export', { title: item.title, count: item.findings.length })}`,
        ...item.findings.map(
          (f) => `> - ${f.file}:${f.line} (${t(`review.severity.${f.severity}`)}) ${f.title}`
        )
      ]
    case 'memory-proposal':
      // Proposition de mémoire (fiche 182) : une ligne, le nom et l'issue.
      return [
        `> ${t(`memory.export.${item.action}`, { name: item.draft.name })} — ${t(`memory.status.${item.status}`)}`
      ]
    default:
      // Cartes de fin de tour, éléments des conversations filles : à part (complexité bornée,
      // fiche 089).
      return guardLines(item) ?? childLines(item as ChildItem)
  }
}

/** Plafond de coût (fiche 157), limite d'étapes (fiche 209) : une ligne. */
function guardLines(item: TranscriptItem): string[] | undefined {
  if (item.kind === 'cost-cap') {
    return [`> ${t('turnGuards.cap.export', { limit: formatCap(item.limit, item.unit) })}`]
  }
  if (item.kind !== 'turn-limit') return undefined
  return [`> ${t(item.refused ? 'turnGuards.limit.exportRefused' : 'turnGuards.limit.export')}`]
}

/** Préparation du worktree (fiche 175) : une ligne, la commande et son issue. */
function worktreeSetupLines(item: Extract<TranscriptItem, { kind: 'worktree-setup' }>): string[] {
  if (!item.command) {
    const count = item.copy?.files.length ?? 0
    return count ? [`> ${t('worktreeSetup.exportCopied', { count })}`] : []
  }
  const state =
    item.state === 'done'
      ? t('worktreeSetup.doneShort')
      : item.state === 'failed'
        ? item.stopped
          ? t('worktreeSetup.stopped')
          : item.timedOut
            ? t('worktreeSetup.timedOut')
            : t('worktreeSetup.failed', { code: item.exitCode ?? '?' })
        : item.state === 'approval'
          ? t('worktreeSetup.approve')
          : item.state === 'skipped'
            ? t('worktreeSetup.skipped')
            : t('worktreeSetup.running')
  return [`> ${t('worktreeSetup.export', { command: item.command, state })}`]
}

type ChildItem = Extract<
  TranscriptItem,
  { kind: 'child-instruction' | 'child-started' | 'child-recommendation' | 'child-report' }
>

/** Lignes des éléments des conversations filles (fiches 097, 150, 160), en citation. */
function childLines(item: ChildItem): string[] {
  switch (item.kind) {
    case 'child-instruction':
      return [
        `> ${t('children.instructionFor', { title: item.title })}`,
        '>',
        ...quoted(item.prompt).map((line) => `> ${line}`)
      ]
    case 'child-started':
      return [
        `> ${t('export.childStarted', { title: item.title })}`,
        '>',
        ...quoted(item.prompt).map((l) => `> ${l}`)
      ]
    case 'child-recommendation':
      return [
        `> ${t(item.ready ? 'export.childRecommended' : 'export.childNotRecommended', { title: item.title })}`,
        ...(item.note ? ['>', ...quoted(item.note).map((l) => `> ${l}`)] : [])
      ]
    case 'child-report': {
      const files = t('children.files', { count: item.fileCount })
      return [
        `> ${t('export.childReport', { title: item.title, files })}`,
        ...(item.excerpt ? ['>', ...quoted(item.excerpt).map((l) => `> ${l}`)] : [])
      ]
    }
  }
}
