/**
 * Ce qu'a relu le Code reviewer, en mots (fiche 267, recette N1) : la carte le dit toujours, avec
 * ou sans remarque — « Relu : 4 commits, 12 fichiers (ffa5062..db4a5e1) » —, et la bulle d'une
 * relecture lancée par « Faire relire » aussi. Une relecture qui dit « rien à signaler » sans dire
 * sur quoi donne une fausse assurance.
 */
import { t } from 'i18next'
import { EMPTY_TREE, type Review } from './review'

type Lng = { lng?: 'en' }

const short = (sha: string) => sha.slice(0, 7)

/**
 * La plage relue : « ffa5062..db4a5e1 », « du premier commit à db4a5e1 » ; avec le non commité,
 * seulement son départ (« depuis ffa5062 »). `from` absent ou l'arbre vide : depuis le début.
 */
export function reviewRange(
  from: string | undefined,
  to: string | undefined,
  withUncommitted: boolean,
  o: Lng = {}
): string {
  const start = from && from !== EMPTY_TREE ? short(from) : undefined
  if (withUncommitted || !to) {
    return start
      ? t('review.scope.since', { from: start, ...o })
      : t('review.scope.sinceStart', { ...o })
  }
  return start
    ? t('review.scope.range', { from: start, to: short(to), ...o })
    : t('review.scope.rangeFromStart', { to: short(to), ...o })
}

type Reviewed = Pick<
  Review,
  | 'scope'
  | 'base'
  | 'since'
  | 'head'
  | 'commits'
  | 'withUncommitted'
  | 'files'
  | 'origin'
  | 'shallow'
  | 'submodules'
>

/**
 * Ce qui a été relu, sans « Relu : » (fiche 267, revue UX) : d'où part la plage — « les 4 commits
 * de cette conversation, 3 fichiers », « … depuis la dernière relecture », « les 5 derniers commits
 * (début de la conversation introuvable) » —, l'historique partiel d'un clone superficiel et les
 * sous-modules non relus.
 */
export function reviewedWhat(review: Reviewed, o: Lng = {}): string {
  const files = t('review.card.files', { count: review.files, ...o })
  let what: string
  if (review.scope === 'commits') {
    const count = review.commits ?? 1
    const range = t(`review.what.${review.origin ?? 'conversation'}`, { count, files, ...o })
    what = review.withUncommitted ? t('review.what.dirty', { what: range, ...o }) : range
  } else if (review.scope === 'commit' && review.base) {
    what = t('review.what.commit', { commit: review.base, files, ...o })
  } else if (review.scope === 'branch' && review.base) {
    what = t('review.what.branch', { base: review.base, files, ...o })
  } else {
    what = t('review.what.uncommitted', { files, ...o })
  }
  const extras = [
    ...(review.shallow ? [t('review.what.shallow', { ...o })] : []),
    ...(review.submodules ? [t('review.what.submodules', { count: review.submodules, ...o })] : [])
  ]
  return extras.length ? `${what} · ${extras.join(' · ')}` : what
}

/** La plage relue, « ffa5062..db4a5e1 », pour une portée `commits` ; sinon rien. */
export function reviewedRange(review: Reviewed, o: Lng = {}): string | undefined {
  if (review.scope !== 'commits') return undefined
  return reviewRange(review.since, review.head, !!review.withUncommitted, o)
}

/** « Relu : … » d'une relecture enregistrée (carte « Relecture » d'avant la fiche 265). */
export function reviewedText(review: Reviewed, o: Lng = {}): string {
  const range = reviewedRange(review, o)
  const line = t('review.read.line', { what: reviewedWhat(review, o), ...o })
  return range ? `${line} (${range})` : line
}
