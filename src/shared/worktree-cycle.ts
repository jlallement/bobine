/**
 * Cycle complet d'un worktree (fiche 110, ADR-0022) : ce que le renderer montre et demande, et les
 * textes proposés (message de commit, PR, consigne de résolution) calculés sans l'agent.
 */

/** État d'un worktree pour la barre de la vue « Git » de l'onglet Modifications. */
export interface WorktreeCycleView {
  /** Titre de la conversation (message de commit et PR proposés). */
  title: string
  branch: string
  path: string
  root: string
  /** Commit de départ : hash court, branche de base, date (ISO) et sujet quand ils sont connus. */
  base: string
  baseShort: string
  baseBranch: string
  baseDate?: string
  baseSubject?: string
  /** Modifications non commitées du dossier d'origine à la création : pas dans le worktree. */
  dirtyAtStart?: number
  /** Fichiers modifiés ou nouveaux, pas encore commités. */
  dirty: number
  /** Commits de la branche que la base n'a pas, et l'inverse. */
  ahead: number
  behind: number
  /** Sujets des commits de la branche que la base n'a pas (les plus récents d'abord). */
  commits: string[]
  /**
   * Commits de la branche pas encore poussés sur sa branche suivie (fiche 176 : « Pousser vers la
   * PR ») ; absent si la branche n'est suivie nulle part.
   */
  unpushed?: number
  /** La base contient tout le travail de la branche (après « Fusionner », ou une PR fusionnée). */
  merged: boolean
  /** Fusion en cours, arrêtée sur des conflits. */
  merging?: { files: string[] }
  /** « Ouvrir une PR » possible, ou pourquoi pas. */
  pr: PrAvailability
  /**
   * Aucun dépôt distant (fiche 189) : ni bouton ni raison. À part de `pr`, dont la raison reste
   * celle d'avant (`gh` vérifié d'abord) pour GitHub.
   */
  noRemote?: true
}

/**
 * « Ouvrir une PR / MR » possible, ou pourquoi pas (fiche 189, ADR-0041). `noun` : mot de la forge
 * pour une demande de fusion, `mr` (GitLab) ; absent, `pr` (GitHub, comme avant). `host` : hôte du
 * dépôt distant, pour les messages. `open` : demande déjà ouverte de la branche, pour une forge
 * sans suivi (GitLab) ; GitHub la donne par le suivi de la fiche 176.
 */
export type PrAvailability = (
  | { ok: true; remote: string; open?: { url: string; title?: string } }
  | { ok: false; reason: PrBlocker }
) & { noun?: 'mr'; host?: string }

/**
 * `no-gh` : `gh` absent (GitHub) ; `no-tool` : l'outil de la forge absent (`glab`) ;
 * `unknown-forge` : ni GitHub ni GitLab ; `unreachable`, `certificate` : l'outil est connecté à
 * l'hôte, mais il ne répond pas ou son certificat est refusé.
 */
export type PrBlocker =
  | 'no-gh'
  | 'not-logged'
  | 'no-remote'
  | 'no-tool'
  | 'unknown-forge'
  | 'unreachable'
  | 'certificate'
  /** Vérification de la forge encore en cours (hôte lent) : la vue git n'attend pas (fiche 189). */
  | 'checking'
  /** API introuvable (404) : GitLab sous un sous-chemin non déclaré à glab (fiche 189). */
  | 'not-found'

/** Clé de `worktreeCycle.pr.*` d'une raison (avec le contexte `mr` pour GitLab). */
export function prBlockerKey(reason: PrBlocker): PrBlockerKey {
  return PR_BLOCKER_KEYS[reason]
}

const PR_BLOCKER_KEYS = {
  'no-gh': 'noGh',
  'not-logged': 'notLogged',
  'no-remote': 'noRemote',
  'no-tool': 'noTool',
  'unknown-forge': 'unknownForge',
  unreachable: 'unreachable',
  certificate: 'certificate',
  checking: 'checking',
  'not-found': 'notFound'
} as const satisfies Record<PrBlocker, string>

export type PrBlockerKey = (typeof PR_BLOCKER_KEYS)[PrBlocker]

export interface CommitOutcome {
  hash: string
  short: string
}

export type MergeOutcome =
  | { status: 'merged'; kind: 'fast-forward' | 'merge'; base: string; stash?: StashOutcome }
  /** Rien à fusionner : la base a déjà tout. */
  | { status: 'nothing'; base: string }
  | { status: 'conflicts'; files: string[]; stash?: StashOutcome }
  /** Modifications non commitées dans le worktree : committer d'abord. */
  | { status: 'dirty'; count: number }
  /**
   * Modifications non commitées dans le dossier principal, où la base est extraite (fiche 123) :
   * la fusion n'est pas partie ; à committer d'abord ou à mettre de côté.
   */
  | ({ status: 'main-dirty' } & MainDirty)

/** Dossier principal non commité, où la base est extraite : ce que la carte « fusion refusée » dit. */
export interface MainDirty {
  /** Dossier principal du dépôt. */
  root: string
  /** Branche de base, extraite là. */
  base: string
  /** Fichiers modifiés ou nouveaux, relatifs au dossier principal. */
  files: CommitFile[]
  /** Titre d'où proposer le message de « Committer d'abord » (la mère) ; neutre sans. */
  title?: string
}

/**
 * Modifications du dossier principal mises de côté le temps d'une fusion (`git stash -u`), puis
 * remises : revenues, ou restées dans `git stash` (`ref` : hash court de l'entrée).
 */
export type StashOutcome =
  | { restored: true; count: number }
  | { restored: false; count: number; ref: string; conflicts: string[] }

export interface PrOutcome {
  url: string
  /** La PR existait déjà pour cette branche : son lien est rendu. */
  existed: boolean
  /** `mr` sur GitLab (fiche 189) ; absent : `pr`. */
  noun?: 'mr'
}

/** Worktree de Bobine sans conversation (supprimée sans cocher « Supprimer aussi le worktree »). */
export interface OrphanWorktree {
  root: string
  path: string
  branch: string
  dirty: number
  /** Commits de la branche que la branche courante du dépôt n'a pas. */
  ahead: number
}

/** Un fichier à committer, tel que la vue « Git » le liste. */
export interface CommitFile {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
}

const DOC_FILE = /(^|\/)(docs?|doc)\/|\.(md|mdx|markdown|txt|rst|adoc)$/i
const TEST_FILE = /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$|_test\.(go|py|rb)$/i
const FIX_TITLE = /\b(fix|fixe|bug|corrig|répar|repar|crash|erreur|error|plant)/i
const SUBJECT_MAX = 60
const BODY_FILES_MAX = 20

/** Type Conventional Commits deviné : docs, test, fix, sinon feat. */
export function commitType(title: string, files: readonly CommitFile[]): string {
  if (files.length > 0 && files.every((f) => DOC_FILE.test(f.path))) return 'docs'
  if (files.length > 0 && files.every((f) => TEST_FILE.test(f.path))) return 'test'
  if (FIX_TITLE.test(title)) return 'fix'
  return 'feat'
}

/**
 * Mots qui n'achèvent pas une phrase : articles, prépositions, conjonctions (français, anglais).
 * Un sujet coupé ne finit pas sur eux (C14 : « …à confier chacun à une »).
 */
const DANGLING_WORDS = new Set(
  (
    'le la les l un une des du de d à au aux en et ou ni mais que qu dans sur sous par pour avec sans ' +
    'chez vers ce cet cette ces son sa ses leur leurs mon ma mes ton ta tes ' +
    'the a an of to in on at by for with and or but as from into'
  ).split(' ')
)

/** Dernier mot d'un sujet, sans l'apostrophe d'élision (« l’ » → « l »). */
const lastWord = (text: string) => /([\p{L}\p{N}]+)['’]?$/u.exec(text)?.[1]?.toLowerCase() ?? ''

/**
 * Sujet d'un commit tiré du titre : minuscule initiale, sans point final, coupé à une limite de mot
 * (jamais au milieu d'un mot, jamais sur un article ou une préposition) et terminé par « … » quand
 * il est coupé.
 */
export function commitSubject(title: string): string {
  let subject = title
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.…]+$/, '')
  // Titre encore automatique (« Nouvelle conversation ») ou vide : un sujet neutre.
  if (!subject) return 'update files'
  subject = subject.charAt(0).toLowerCase() + subject.slice(1)
  if (subject.length <= SUBJECT_MAX) return subject
  // Une place pour le « … » : la coupe tombe sur la limite d'un mot, pas dedans.
  const room = subject.slice(0, SUBJECT_MAX - 1)
  const atBoundary = subject.charAt(SUBJECT_MAX - 1) === ' '
  let cut = atBoundary ? room : room.slice(0, Math.max(room.lastIndexOf(' '), 0))
  // Pas de mot outil en bout de phrase, ni de ponctuation qui pendouille.
  for (;;) {
    const trimmed = cut.replace(/[\s,;:(–—-]+$/, '')
    const space = trimmed.lastIndexOf(' ')
    if (space <= 0 || !DANGLING_WORDS.has(lastWord(trimmed))) {
      cut = trimmed
      break
    }
    cut = trimmed.slice(0, space)
  }
  // Un seul mot sans espace (identifiant, texte sans espaces) : coupé tel quel, faute de mieux.
  if (!cut) cut = room.replace(/[\s,;:]+$/, '')
  return `${cut}…`
}

/**
 * Sujet qui ne promet que ce que le commit contient (0.11, D4) : le titre de la conversation s'il
 * tient en entier (court, il dit l'intention) ; sinon, coupé, il annoncerait plus ou autre chose
 * que les fichiers cochés : un résumé de ces fichiers.
 */
export function honestSubject(title: string, files: readonly CommitFile[]): string {
  const clean = title
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.…]+$/, '')
  if (files.length === 0 || (clean && clean.length <= SUBJECT_MAX)) return commitSubject(title)
  return filesSubject(files)
}

/** « update a.ts », « add a.ts and b.ts », « update 5 files in src/panel ». */
export function filesSubject(files: readonly CommitFile[]): string {
  const isNew = (f: CommitFile) => f.status === 'added' || f.status === 'untracked'
  const verb = files.every(isNew)
    ? 'add'
    : files.every((f) => f.status === 'deleted')
      ? 'remove'
      : 'update'
  const names = [...new Set(files.map((f) => f.path.split('/').pop() ?? f.path))]
  if (names.length <= 3) {
    const listed =
      names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
    const subject = `${verb} ${listed}`
    if (subject.length <= SUBJECT_MAX) return subject
  }
  const counted = `${verb} ${files.length} files`
  const dir = commonDirectory(files.map((f) => f.path))
  const inDir = dir ? `${counted} in ${dir}` : counted
  return inDir.length <= SUBJECT_MAX ? inDir : counted
}

/** Dossier commun à ces chemins (`src/panel`), ou rien. */
function commonDirectory(paths: readonly string[]): string {
  const dirs = paths.map((p) => p.split('/').slice(0, -1))
  const first = dirs[0] ?? []
  let length = first.length
  for (const dir of dirs) {
    let same = 0
    while (same < Math.min(length, dir.length) && dir[same] === first[same]) same++
    length = same
  }
  return first.slice(0, length).join('/')
}

/**
 * Message de commit proposé (fiche 110) : `type: sujet`, puis la liste des fichiers. Générique,
 * sans appel à l'agent ; l'utilisateur le retouche avant de committer.
 */
export function proposeCommitMessage(title: string, files: readonly CommitFile[]): string {
  const subject = `${commitType(title, files)}: ${honestSubject(title, files)}`
  if (files.length === 0) return subject
  const lines = files.slice(0, BODY_FILES_MAX).map((f) => `- ${f.path}${fileNote(f)}`)
  if (files.length > BODY_FILES_MAX) lines.push(`- … and ${files.length - BODY_FILES_MAX} more`)
  return `${subject}\n\n${lines.join('\n')}`
}

function fileNote(file: CommitFile): string {
  switch (file.status) {
    case 'added':
    case 'untracked':
      return ' (new)'
    case 'deleted':
      return ' (deleted)'
    case 'renamed':
      return ' (renamed)'
    default:
      return ''
  }
}

/** Titre et corps proposés pour la PR : le titre de la conversation, les commits, les fichiers. */
export function proposePr(
  title: string,
  commits: readonly string[],
  files: readonly string[]
): { title: string; body: string } {
  const subject = title.replace(/\s+/g, ' ').trim() || 'Changes from Bobine'
  const sections: string[] = []
  if (commits.length > 0) {
    sections.push(['## Commits', ...commits.map((c) => `- ${c}`)].join('\n'))
  }
  if (files.length > 0) {
    const shown = files.slice(0, BODY_FILES_MAX).map((f) => `- ${f}`)
    if (files.length > BODY_FILES_MAX) shown.push(`- … and ${files.length - BODY_FILES_MAX} more`)
    sections.push(['## Files', ...shown].join('\n'))
  }
  return { title: subject, body: sections.join('\n\n') }
}

/**
 * Consigne envoyée à l'agent pour résoudre les conflits (ADR-0014 : ce qui va à l'agent n'est pas
 * traduit). Il ne committe pas : l'app termine la fusion quand les marqueurs ont disparu.
 */
export function conflictPrompt(base: string, branch: string, files: readonly string[]): string {
  return [
    `Merging the base branch \`${base}\` into \`${branch}\` left conflicts in these files:`,
    ...files.map((f) => `- ${f}`),
    '',
    'Resolve each conflict: keep the right content from both sides and remove every',
    '`<<<<<<<`, `=======` and `>>>>>>>` marker. Do not commit and do not run `git merge`:',
    'the app finishes the merge once the markers are gone.'
  ].join('\n')
}

/** Le texte contient encore un marqueur de conflit git en début de ligne. */
export function hasConflictMarkers(text: string): boolean {
  return /^(<{7}|={7}|>{7}|\|{7})( |$)/m.test(text)
}

/** Hash court (7 caractères) d'un commit. */
export const shortHash = (hash: string): string => hash.slice(0, 7)

/**
 * Départ d'un worktree, posé en tête de son fil (fiche 110 ; une seule carte depuis la fiche 117) :
 * branche et commit de départ, et les modifications non commitées du dossier d'origine, qui n'y
 * sont pas.
 */
export interface WorktreeStart {
  /** Branche de départ ; absente : HEAD détachée. */
  branch?: string
  /** Commit de départ, complet. */
  commit: string
  /** Date du commit (ISO 8601). */
  date?: string
  /** Sujet du commit. */
  subject?: string
  /** Modifications non commitées du dossier d'origine au départ. */
  dirty?: number
}

/** Pourquoi « Ouvrir une PR » n'est pas possible : clé de `worktreeCycle.pr.*`, ou rien. */
export function prBlocker(
  info: Pick<WorktreeCycleView, 'pr' | 'ahead'>
): PrBlockerKey | 'nothing' | undefined {
  if (!info.pr.ok) return prBlockerKey(info.pr.reason)
  return info.ahead === 0 ? 'nothing' : undefined
}

/** Pourquoi « Fusionner » n'est pas possible : à committer d'abord, ou rien à fusionner. */
export function mergeBlocker(
  info: Pick<WorktreeCycleView, 'merging' | 'dirty' | 'ahead'>
): 'dirty' | 'nothing' | undefined {
  if (info.merging) return undefined
  if (info.dirty > 0) return 'dirty'
  return info.ahead === 0 ? 'nothing' : undefined
}

/**
 * Branche distante après « Nettoyer » une PR fusionnée (0.9.1, D19) : supprimée (ou déjà partie),
 * gardée parce qu'elle a reçu des commits après la fusion, ou l'erreur de git.
 */
export type RemoteBranchOutcome = { deleted: true } | { kept: 'moved' } | { error: string }

/**
 * Nom court d'une demande de fusion pour son lien (fiche 189, verdict UX) : `groupe/projet!1`
 * (GitLab), `owner/repo#12` (GitHub) ; l'adresse telle quelle sinon.
 */
export function requestRef(url: string): string {
  const gitlab = /^https?:\/\/[^/]+\/(.+?)\/-\/merge_requests\/(\d+)\/?(?:[?#].*)?$/.exec(url)
  if (gitlab) return `${gitlab[1]}!${gitlab[2]}`
  const github = /^https?:\/\/[^/]+\/([^/]+\/[^/]+)\/pull\/(\d+)\/?(?:[?#].*)?$/.exec(url)
  if (github) return `${github[1]}#${github[2]}`
  return url
}
