/**
 * Outil de relecture (fiche 177) : `report_findings`, proposé aux seules conversations de relecture
 * (« Faire relire… »), par le module des filles (`children-tools.ts`, rôle `reviewer`). Le
 * relecteur y rend ses remarques structurées — fichier, lignes, gravité, nature, titre, pourquoi —
 * au lieu d'un texte libre que l'app devrait deviner. Elles arrivent sur
 * la carte « Relecture » de la conversation relue, puis en remarques sur son diff (fiche 085).
 *
 * Autorisé d'office : il n'agit que dans l'app (rien n'est envoyé à l'auteur sans l'utilisateur).
 * Description en anglais (ADR-0014).
 */
import {
  FINDING_TITLE_CHARS,
  FINDING_WHY_CHARS,
  MAX_FINDINGS,
  REVIEW_CATEGORIES,
  REVIEW_SEVERITIES,
  REVIEW_SUMMARY_CHARS
} from '@shared/review'
import type { ChildReviews } from '../conversations/children-review'
import { argsOf, textResult, type AppTool } from './tools'

export type ReviewTools = Pick<ChildReviews, 'report'>

const REPORT_FINDINGS =
  'Report the findings of your code review (you are a review conversation started by the user). ' +
  'Call it once, with every finding, before ending your turn; an empty list means nothing to ' +
  'report. Each finding points at lines of the current version of a file of this folder, says how ' +
  'severe it is (high: must fix before merging; medium: should fix; low: worth considering) and ' +
  'whether it is about correctness or simplification, and why: the concrete failure or cost, and ' +
  'the fix. Findings become comments on the diff; the user chooses which ones to send to the ' +
  'author. Never modify files to fix them yourself.'

const SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      maxItems: MAX_FINDINGS,
      items: {
        type: 'object',
        properties: {
          file: { type: 'string', description: 'Path relative to this folder.' },
          line: { type: 'integer', minimum: 1, description: 'First line (current file).' },
          endLine: { type: 'integer', minimum: 1, description: 'Last line, if several.' },
          severity: { type: 'string', enum: [...REVIEW_SEVERITIES] },
          category: { type: 'string', enum: [...REVIEW_CATEGORIES] },
          title: { type: 'string', maxLength: FINDING_TITLE_CHARS, description: 'One line.' },
          why: {
            type: 'string',
            maxLength: FINDING_WHY_CHARS,
            description: 'The concrete failure or cost, and the fix.'
          }
        },
        required: ['file', 'line', 'severity', 'category', 'title', 'why']
      }
    },
    summary: {
      type: 'string',
      maxLength: REVIEW_SUMMARY_CHARS,
      description: 'Overall verdict, one or two sentences.'
    }
  },
  required: ['findings']
}

/** `report_findings` pour le relecteur `conversationId` (rôle `reviewer` de `children-tools.ts`). */
export function reportFindingsTool(conversationId: string, reviews: ReviewTools): AppTool {
  return {
    definition: { name: 'report_findings', description: REPORT_FINDINGS, inputSchema: SCHEMA },
    autoAllow: true,
    call: async (raw) => textResult(await reviews.report(conversationId, argsOf(raw)))
  }
}
