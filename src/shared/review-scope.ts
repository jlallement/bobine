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

/** « Relu : … » d'une relecture enregistrée (carte du Code reviewer, carte « Relecture »). */
export function reviewedText(
  review: Pick<
    Review,
    'scope' | 'base' | 'since' | 'head' | 'commits' | 'withUncommitted' | 'files'
  >,
  o: Lng = {}
): string {
  const files = t('review.card.files', { count: review.files, ...o })
  if (review.scope === 'commits') {
    const dirty = !!review.withUncommitted
    return t(dirty ? 'review.read.commitsDirty' : 'review.read.commits', {
      commits: t('review.scope.commits', { count: review.commits ?? 1, ...o }),
      files,
      range: reviewRange(review.since, review.head, dirty, o),
      ...o
    })
  }
  if (review.scope === 'commit' && review.base)
    return t('review.read.commit', { commit: review.base, files, ...o })
  if (review.scope === 'branch' && review.base)
    return t('review.read.branch', { base: review.base, files, ...o })
  return t('review.read.uncommitted', { files, ...o })
}
