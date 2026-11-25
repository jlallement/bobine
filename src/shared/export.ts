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
import { originKey, type MessageOrigin } from './children'
import { handoverName } from './handover'
import { shortHash } from './worktree-cycle'
import { formatCap } from './cost-cap'
import { stripAppContext } from './app-context'
import { participantIds } from './roundtable'

export type ExportFormat = 'markdown' | 'json'

/** Taille maximale d'un texte d'outil ou de terminal repris dans le Markdown. */
const MAX_TOOL_TEXT = 4000
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007]*\u0007/g

const pad = (n: number) => String(n).padStart(2, '0')
const dateOf = (now: Date) =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

/**
 * Chemin rendu par la fenêtre d'enregistrement, avec une seule extension (fiche 247, D14) : la
 * fenêtre de macOS, filtrée sur l'extension, l'ajoute parfois à un nom saisi qui la porte déjà
 * (« notes.md.md ») ; celle de Linux ne l'ajoute jamais. Extension doublée ramenée à une, ajoutée si
 * le nom n'en a pas ; casse ignorée (« Notes.MD » reste tel quel).
 */
export function withExtension(path: string, extension: 'md' | 'json' | 'csv'): string {
  const suffix = `.${extension}`
  const lower = path.toLowerCase()
  if (lower.endsWith(suffix + suffix)) return path.slice(0, -suffix.length)
  return lower.endsWith(suffix) ? path : path + suffix
}

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
    // Discussion (fiche 224) : son dossier, tenu par Bobine, n'est pas nommé.
    ...(summary.space === 'discussion'
      ? []
      : [`- ${t('export.folder', { folder: summary.workspace })}`]),
    `- ${t('export.updatedAt', { date: summary.updatedAt })}`,
    `- ${t('export.exportedAt', { date: dateOf(now) })}`,
    ''
  ]
  // Participants d'un tour de table (fiche 285) : leurs avis sortent avec le tour, sous leur nom.
  const seats = participantChildren(transcript.items)
  // Un seul passage : dernier message de l'utilisateur et tours vus jusque-là.
  const tours = new Map<string, Extract<TranscriptItem, { kind: 'roundtable' }>>()
  let asked: Extract<TranscriptItem, { kind: 'user' }> | undefined
  for (const item of transcript.items) {
    if (item.kind === 'roundtable') tours.set(item.roundtableId, item)
    // Conversation d'un participant : son premier message est la question, avec les blocs de l'app.
    const question = item.kind === 'user' && !asked && !!summary.roundtable
    if (item.kind === 'user') asked = item
    if ((item.kind === 'child-started' || item.kind === 'child-report') && seats.has(item.childId))
      continue
    const heading = item.kind === 'agent' ? stepHeading(asked, tours) : undefined
    lines.push(...itemLines(item, transcript, agent, heading, question), '')
  }
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
  const key = originKey(from)
  return t(key, { title: from.title })
}

/** Message de l'utilisateur, ou d'une autre conversation (sortie d'`itemLines`, complexité bornée). */
function userLines(
  item: Extract<TranscriptItem, { kind: 'user' }>,
  /** Question d'un participant de tour de table (premier message de sa conversation, fiche 285). */
  question = false
): string[] {
  // Demande interne d'un tour de table (fiche 285) : jamais son texte en anglais ; la réponse
  // qui suit est marquée (synthèse, décision), la réplique d'un participant aussi.
  if (item.from?.kind === 'roundtable') {
    return item.from.step === 'rebuttal' ? [`> ${t('roundtable.rebuttal.title')}`] : []
  }
  const attached = (item.attachments ?? []).map((a) => a.name)
  return [
    `## ${question ? `${t('export.you')} · ${t('roundtable.name')}` : item.from ? originHeading(item.from) : t('export.you')}`,
    '',
    ...(attached.length
      ? [`*${t('export.attachments', { files: attached.join(', ') })}*`, '']
      : []),
    // Message venu de l'app (provenance) : sans les blocs qu'elle y joint. Un message tapé par
    // l'utilisateur sort tel quel, même s'il cite ces textes.
    item.from || question ? (stripAppContext(item.text) ?? '') : item.text,
    // Textes collés (fiche 155) : leur contenu, à la suite du message.
    ...(item.attachments ?? []).flatMap((a) =>
      a.kind === 'text' ? ['', `*${a.name}*`, '', ...longFenced(a.text)] : []
    )
  ]
}

function itemLines(
  item: TranscriptItem,
  transcript: TranscriptState,
  agent: string,
  /** Titre d'une réponse à une demande du tour de table (synthèse, décision). */
  heading?: string,
  question = false
): string[] {
  switch (item.kind) {
    case 'user':
      return userLines(item, question)
    case 'agent':
      return [`## ${heading ?? agent}`, '', item.text]
    case 'role-request':
      // Bulle « @Rôle … » (fiche 263) : la demande, à qui elle est allée.
      return [
        `## ${t('export.roleRequest', { roles: item.works.map((w) => w.role.label).join(', ') })}`,
        '',
        item.text
      ]
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
      return guardLines(item, transcript.items) ?? childLines(item as ChildItem)
  }
}

/** Plafond de coût (fiche 157), limite d'étapes (fiche 209) : une ligne ; tour de table (fiche 285). */
function guardLines(item: TranscriptItem, items: readonly TranscriptItem[]): string[] | undefined {
  if (item.kind === 'roundtable') return roundtableLines(item, items)
  if (item.kind === 'cost-cap') {
    return [`> ${t('turnGuards.cap.export', { limit: formatCap(item.limit, item.unit) })}`]
  }
  if (item.kind !== 'turn-limit') return undefined
  return [`> ${t(item.refused ? 'turnGuards.limit.exportRefused' : 'turnGuards.limit.export')}`]
}

/**
 * Tour de table (fiche 285) : la question comme un message de l'utilisateur, marqué « Tour de
 * table », puis l'avis de chaque participant sous son vrai nom (le compte rendu gardé dans le fil).
 */
function roundtableLines(
  item: Extract<TranscriptItem, { kind: 'roundtable' }>,
  items: readonly TranscriptItem[]
): string[] {
  const opinions = item.seats.flatMap((seat) => {
    const report = items.findLast(
      (i) =>
        i.kind === 'child-report' &&
        i.childId === seat.childId &&
        i.outcome === 'done' &&
        (seat.askedAt === undefined || i.askedAt === seat.askedAt)
    )
    const reply = report?.kind === 'child-report' ? report.reply?.trim() : undefined
    const name = seat.agentLabel === seat.label ? seat.label : `${seat.label} · ${seat.agentLabel}`
    return ['', `### ${name}`, '', reply && seat.state === 'answered' ? reply : `*${seat.state}*`]
  })
  return [
    `## ${t('export.you')} · ${t('roundtable.name')}`,
    '',
    ...(item.attachments?.length
      ? [`*${t('export.attachments', { files: item.attachments.join(', ') })}*`, '']
      : []),
    item.question,
    '',
    `> ${t('roundtable.export', { count: item.seats.length })}`,
    ...opinions
  ]
}

/** Conversations des participants des tours du fil (places, et lancements à la clé d'un tour). */
function participantChildren(items: readonly TranscriptItem[]): Set<string> {
  const ids = participantIds(items)
  const tours = new Set(items.flatMap((i) => (i.kind === 'roundtable' ? [i.roundtableId] : [])))
  for (const i of items) {
    if (i.kind === 'child-started' && i.card && tours.has(i.card)) ids.add(i.childId)
  }
  return ids
}

/** Réponse à une demande d'un tour de table : « Synthèse du tour de table · <modèle> ». */
function stepHeading(
  asked: Extract<TranscriptItem, { kind: 'user' }> | undefined,
  tours: ReadonlyMap<string, Extract<TranscriptItem, { kind: 'roundtable' }>>
): string | undefined {
  if (asked?.from?.kind !== 'roundtable') return undefined
  const { id, step } = asked.from
  if (step !== 'synthesis' && step !== 'verdict') return undefined
  const rt = tours.get(id)
  const by = rt ? (rt[step]?.by ?? rt.synthesizer) : undefined
  const model = by?.model ?? by?.label ?? ''
  return t(step === 'synthesis' ? 'roundtable.synthesis.label' : 'roundtable.decision.label', {
    model
  })
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
      // Réponse entière d'un travail lancé par une bulle (fiche 263), sinon son début.
      const text = item.reply ?? item.excerpt
      return [
        `> ${t('export.childReport', { title: item.title, files })}`,
        ...(text ? ['>', ...quoted(text).map((l) => `> ${l}`)] : [])
      ]
    }
  }
}
