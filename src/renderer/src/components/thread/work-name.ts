import type { WorkCardData } from '@shared/role-request'

/** Nom d'un travail : son rôle, sinon son titre. */
export const workName = (card: WorkCardData): string => card.role?.label ?? card.title
