/**
 * Les quatorze parcours de la grille de conformité (fiche 139). Chacun joue, avec le scénario que sa
 * persona lui donne, ce que ferait l'utilisateur, et rend ce qu'il a vérifié en propre ; les
 * invariants communs sont vérifiés ensuite par l'essai (`grid.ts`).
 */
import type { TranscriptItem } from '@shared/transcript'
import { continueWith } from '../conversations/handover'
import { CostCapGuard } from '../conversations/cost-cap'
import { rejectOnce, waitFor, type App, type Environment } from './harness'
import { PERSONAS, type JourneyId, type Persona } from './personas'

export interface JourneyRun {
  /** Instance de l'app à la fin du parcours (une autre après un redémarrage). */
  app: App
  id: string
  /** Écarts propres au parcours. */
  issues: string[]
  /** Statuts attendus de l'agent à la fin (défaut : prêt). */
  status?: string[]
}

export interface Journey {
  id: JourneyId
  label: string
  /** Délai de base de l'agent factice : un tour qui doit durer (Stop, file d'attente). */
  delayMs?: number
  run: (env: Environment) => Promise<JourneyRun>
}

type Tool = Extract<TranscriptItem, { kind: 'tool' }>

const scenario = (persona: Persona, journey: JourneyId) => `/scenario ${persona.scenarios[journey]}`

/** Éléments du dernier tour (après le dernier message de l'utilisateur). */
function lastTurn(items: readonly TranscriptItem[]): TranscriptItem[] {
  const start = items.findLastIndex((i) => i.kind === 'user')
  return items.slice(start + 1)
}

const tools = (items: readonly TranscriptItem[]) =>
  items.filter((i): i is Tool => i.kind === 'tool')

const agentText = (items: readonly TranscriptItem[]) =>
  items.flatMap((i) => (i.kind === 'agent' ? [i.text] : [])).join('')

const noticeKeys = (items: readonly TranscriptItem[]) =>
  items.flatMap((i) => (i.kind === 'notice' && i.message ? [i.message.key] : []))

/** Écart si la condition est fausse. */
const check = (ok: boolean, issue: string): string[] => (ok ? [] : [issue])

/** Session neuve du même agent (ADR-0030) : un seul repère, et l'échange d'avant reçu. */
function renewalIssues(all: readonly TranscriptItem[]): string[] {
  const answer = agentText(lastTurn(all))
  return [
    ...check(
      all.filter((i) => i.kind === 'handover' && i.reason).length === 1,
      'repère « Nouvelle session » absent ou répété'
    ),
    ...check(
      answer.startsWith('Contexte reçu'),
      `la session neuve n’a pas reçu l’échange d’avant : « ${answer.slice(0, 60)} »`
    )
  ]
}

async function opened(env: Environment) {
  const app = env.launch()
  const id = await app.start()
  return { app, id }
}

const items = (app: App, id: string) => app.view(id).transcript.items

export const JOURNEYS: Journey[] = [
  {
    id: 'prompt',
    label: 'prompt simple',
    async run(env) {
      const { app, id } = await opened(env)
      await app.prompt(id, scenario(env.persona, 'prompt'))
      const turn = lastTurn(items(app, id))
      return { app, id, issues: check(agentText(turn).length > 0, 'pas de réponse') }
    }
  },
  {
    id: 'permission',
    label: 'autorisation acceptée, puis refusée',
    async run(env) {
      const { app, id } = await opened(env)
      await app.prompt(id, scenario(env.persona, 'permission'))
      const accepted = tools(lastTurn(items(app, id)))
      app.permissions(rejectOnce)
      await app.prompt(id, scenario(env.persona, 'permission'))
      const refused = tools(lastTurn(items(app, id)))
      return {
        app,
        id,
        issues: [
          ...check(accepted.length > 0, 'aucune carte au premier tour'),
          ...check(
            accepted.every((t) => t.status === 'completed'),
            `accepté : ${accepted.map((t) => t.status).join(', ')}`
          ),
          ...check(
            refused[0]?.status === 'refused',
            `refusé : ${refused[0]?.status ?? 'aucune carte'}`
          ),
          ...check(
            refused.every((t) => t.status !== 'completed'),
            'un outil refusé est dit terminé'
          )
        ]
      }
    }
  },
  {
    id: 'plan',
    label: 'plan',
    async run(env) {
      const { app, id } = await opened(env)
      await app.prompt(id, scenario(env.persona, 'plan'))
      const plans = lastTurn(items(app, id)).filter((i) => i.kind === 'plan')
      const withPlan = env.persona.id !== 'acp-minimal'
      const last = plans.at(-1)
      return {
        app,
        id,
        issues: withPlan
          ? [
              ...check(plans.length === 1, `${plans.length} plan(s) dans le tour, attendu 1`),
              // Bob laisse sa liste ouverte en fin de tour (« Terminer » en cours) : c'est la sienne.
              ...check(last?.kind === 'plan' && last.entries.length > 0, 'plan vide')
            ]
          : check(plans.length === 0, 'un plan affiché alors que l’agent n’en envoie pas')
      }
    }
  },
  {
    id: 'tool',
    label: 'cycle complet d’un outil',
    async run(env) {
      const { app, id } = await opened(env)
      await app.prompt(id, scenario(env.persona, 'tool'))
      const cards = tools(lastTurn(items(app, id)))
      return {
        app,
        id,
        issues: [
          ...check(cards.length > 0, 'aucune carte d’outil'),
          ...check(
            cards.every((t) => t.status === 'completed'),
            `cartes : ${cards.map((t) => `${t.title} ${t.status}`).join(', ')}`
          ),
          // OpenCode annonce son patch « pending {} » sous le titre brut « patch » (fiche 128).
          ...check(
            cards.every((t) => t.title !== 'patch' || !!t.input || t.locations.length > 0),
            'carte « patch » sans cible'
          )
        ]
      }
    }
  },
  {
    id: 'cancel',
    label: 'annulation',
    delayMs: 5,
    async run(env) {
      const { app, id } = await opened(env)
      const turn = app.prompt(id, scenario(env.persona, 'cancel'))
      await waitFor(() => lastTurn(items(app, id)).length > 0, 'début de la réponse')
      await app.manager.cancel(id)
      await turn
      const ended = lastTurn(items(app, id))
      return {
        app,
        id,
        issues: [
          ...check(app.of(id, 'turn-end').at(-1)?.stopReason === 'cancelled', 'tour pas annulé'),
          ...check(
            noticeKeys(ended).includes('transcript.notice.cancelled'),
            'pas d’avis « réponse interrompue »'
          ),
          ...check(
            tools(ended).every((t) => t.status === 'cancelled' || t.status === 'completed'),
            `cartes : ${tools(ended)
              .map((t) => t.status)
              .join(', ')}`
          )
        ]
      }
    }
  },
  {
    id: 'crash',
    label: 'panne de l’agent puis relance',
    async run(env) {
      const { app, id } = await opened(env)
      await app.prompt(id, scenario(env.persona, 'crash'))
      await waitFor(() => app.status(id) === 'exited', 'agent arrêté')
      const crashed = lastTurn(items(app, id))
      const crashIssues = [
        ...check(
          noticeKeys(crashed).some((k) => k.startsWith('transcript.notice.exited')),
          'pas d’avis de panne'
        ),
        ...check(
          tools(crashed).every((t) => t.status === 'cancelled'),
          `outil du tour en panne : ${tools(crashed)
            .map((t) => t.status)
            .join(', ')}`
        )
      ]
      if (!env.persona.resumes) {
        // Agent qui ne sait pas rouvrir sa session : « Relancer » ouvre une session neuve dans la
        // même conversation, qui reçoit l'échange d'avant avec le message suivant (ADR-0030).
        const kept = items(app, id).length
        await app.manager.restart(id)
        await waitFor(() => app.status(id) === 'ready', 'session neuve prête')
        const renewed = items(app, id).length
        await app.prompt(id, '/scenario contexte-recu')
        return {
          app,
          id,
          issues: [
            ...crashIssues,
            ...check(renewed >= kept, 'fil perdu à la relance'),
            ...renewalIssues(items(app, id))
          ]
        }
      }
      // Un nouveau message relance l'agent, fil gardé (fiches 041, 121).
      await app.prompt(id, scenario(env.persona, 'prompt'))
      const answer = agentText(lastTurn(items(app, id)))
      return {
        app,
        id,
        issues: [...crashIssues, ...check(answer.length > 0, 'pas de réponse après la relance')]
      }
    }
  },
  {
    id: 'restart',
    label: 'reprise après redémarrage',
    async run(env) {
      const first = await opened(env)
      await first.app.prompt(first.id, scenario(env.persona, 'restart'))
      await first.app.idle(first.id, env.persona.settleMs)
      const before = items(first.app, first.id).length
      first.app.manager.stopAll()
      // Nouvelle instance de l'app sur les mêmes dossiers.
      const app = env.launch()
      const id = first.id
      app.sent.set(id, 1)
      app.manager.select(id)
      await waitFor(() => app.status(id) === 'ready', 'conversation rouverte')
      const reopened = items(app, id).length
      if (!env.persona.resumes) {
        // Session neuve (ADR-0030) : le fil d'avant, plus le repère « Nouvelle session ».
        await app.prompt(id, '/scenario contexte-recu')
        return {
          app,
          id,
          issues: [
            ...check(
              reopened === before + 1,
              `fil rouvert : ${reopened} éléments, ${before} avant`
            ),
            ...renewalIssues(items(app, id))
          ]
        }
      }
      await app.prompt(id, scenario(env.persona, 'prompt'))
      const all = items(app, id)
      return {
        app,
        id,
        issues: [
          ...check(reopened === before, `fil rouvert : ${reopened} éléments, ${before} avant`),
          ...check(
            !noticeKeys(all).includes('transcript.notice.continuedElsewhere'),
            'tours de l’app rejoués comme « continuée ailleurs »'
          ),
          ...check(agentText(lastTurn(all)).length > 0, 'pas de réponse après la reprise')
        ]
      }
    }
  },
  {
    id: 'subagent',
    label: 'sous-agent, message envoyé pendant qu’il travaille',
    delayMs: 5,
    async run(env) {
      const { app, id } = await opened(env)
      const background = env.persona.id === 'facon-opencode'
      // `subagent_update` (ACP instable) : aucune carte, le travail de l'enfant n'est pas montré.
      const withCard = env.persona.id !== 'acp-minimal'
      const subagentCard = () => tools(items(app, id)).find((t) => t.subagent)
      const first = app.prompt(id, scenario(env.persona, 'subagent'))
      // Sous-agent ordinaire : le message part pendant son tour (file d'attente). En arrière-plan
      // (OpenCode 2) : le tour est fini, le sous-agent travaille encore (fiche 122, D25).
      if (background) await first
      else if (withCard)
        await waitFor(() => subagentCard()?.status === 'in_progress', 'sous-agent au travail')
      else await waitFor(() => app.status(id) === 'busy', 'réponse en cours')
      const working = withCard
        ? subagentCard()?.status === 'in_progress'
        : app.status(id) === 'busy'
      await app.prompt(id, scenario(env.persona, 'prompt'))
      await first
      await waitFor(
        () => subagentCard()?.status !== 'in_progress',
        'fin du sous-agent',
        background ? 8000 : 4000
      ).catch(() => undefined)
      const card = subagentCard()
      const firstTurn = items(app, id).slice(
        0,
        items(app, id).findLastIndex((i) => i.kind === 'user')
      )
      return {
        app,
        id,
        issues: [
          ...check(working, 'le sous-agent ne travaillait pas au moment du message'),
          ...(withCard
            ? check(
                card?.status === 'completed',
                `carte du sous-agent : ${card?.status ?? 'absente'}`
              )
            : check(tools(firstTurn).length === 0, 'outil d’une session enfant mêlé au fil')),
          ...check(
            !background || card?.subagentRun?.endedAt !== undefined,
            'fin du sous-agent en arrière-plan pas vue'
          )
        ]
      }
    }
  },
  {
    id: 'compaction',
    label: 'compaction',
    async run(env) {
      const { app, id } = await opened(env)
      await app.prompt(id, scenario(env.persona, 'prompt'))
      await app.prompt(id, env.persona.compact)
      const cards = lastTurn(items(app, id)).filter((i) => i.kind === 'compaction')
      const card = cards[0]
      return {
        app,
        id,
        issues: [
          ...check(cards.length === 1, `${cards.length} carte(s) de résumé`),
          ...check(
            card?.kind === 'compaction' && card.status === 'completed' && card.summary.length > 0,
            'résumé pas terminé ou vide'
          )
        ]
      }
    }
  },
  {
    id: 'elicitation',
    label: 'élicitation',
    async run(env) {
      const { app, id } = await opened(env)
      await app.prompt(id, scenario(env.persona, 'elicitation'))
      const turn = lastTurn(items(app, id))
      const forms = turn.filter((i) => i.kind === 'elicitation')
      return {
        app,
        id,
        issues: [
          ...check(forms.length === 1, `${forms.length} formulaire(s)`),
          ...check(
            forms[0]?.kind === 'elicitation' && forms[0].state === 'accept',
            'réponse pas notée'
          ),
          ...check(agentText(turn).length > 0, 'pas de suite après la réponse')
        ]
      }
    }
  },
  {
    id: 'queue',
    label: 'file d’attente',
    delayMs: 5,
    async run(env) {
      const { app, id } = await opened(env)
      const first = app.prompt(id, scenario(env.persona, 'queue'))
      await waitFor(() => app.status(id) === 'busy', 'réponse en cours')
      await app.prompt(id, 'Premier message en attente')
      await app.prompt(id, 'Second message en attente')
      const queued = app.view(id).snapshot?.queued.length ?? 0
      await first
      await app.idle(id)
      // Les messages en attente partent ensemble, en un seul message (fiche 020).
      app.sent.set(id, 2)
      const users = items(app, id).filter((i) => i.kind === 'user')
      const batch = users.at(-1)
      return {
        app,
        id,
        issues: [
          ...check(queued === 2, `${queued} message(s) en file pendant la réponse, attendu 2`),
          ...check(
            batch?.kind === 'user' &&
              batch.text.includes('Premier message') &&
              batch.text.includes('Second message'),
            'les messages en attente ne sont pas partis ensemble'
          )
        ]
      }
    }
  },
  {
    id: 'switch',
    label: 'changement d’agent',
    async run(env) {
      const { app, id } = await opened(env)
      await app.prompt(id, scenario(env.persona, 'prompt'))
      await app.idle(id, env.persona.settleMs)
      const next = env.profileIdOf(env.persona.next)
      await continueWith(app.manager, () => [], id, next)
      await waitFor(() => app.status(id) === 'ready', 'nouvel agent prêt')
      await app.prompt(id, scenario(PERSONAS[env.persona.next], 'switch'))
      const all = items(app, id)
      const answer = agentText(lastTurn(all))
      return {
        app,
        id,
        issues: [
          ...check(app.view(id).summary.profileId === next, 'agent pas changé'),
          ...check(
            all.filter((i) => i.kind === 'handover').length === 1,
            'bascule pas posée dans le fil'
          ),
          ...check(
            answer.length > 0 && !answer.includes('Aucun contexte reçu'),
            `le nouvel agent n’a pas reçu l’échange d’avant : « ${answer.slice(0, 60)} »`
          )
        ]
      }
    }
  },
  {
    id: 'cost-cap',
    label: 'plafond de coût',
    async run(env) {
      // Plafond minuscule (fiche 157) : franchi dès le premier tour qui coûte quelque chose.
      const { app, id } = await opened(env)
      const guard = new CostCapGuard(app.manager, () => ({
        costCapEnabled: true,
        costCapAmount: 0.001,
        costCapTokens: 1_000_000_000
      }))
      const stop = guard.start()
      const unit = env.persona.costUnit
      let held = false
      try {
        await app.prompt(id, scenario(env.persona, 'cost-cap'))
        await app.idle(id, env.persona.settleMs)
        // Plafond atteint : le message suivant est retenu (pas compté comme envoyé).
        if (unit) await app.manager.prompt(id, scenario(env.persona, 'cost-cap'))
        held = items(app, id).at(-1)?.kind === 'cost-cap'
      } finally {
        stop()
      }
      const cards = items(app, id).filter((i) => i.kind === 'cost-cap')
      return {
        app,
        id,
        issues: [
          // Une carte à la fin du tour, une pour le message retenu, dans l'unité de l'agent ;
          // aucune sans consommation.
          ...check(cards.length === (unit ? 2 : 0), `${cards.length} carte(s) de plafond`),
          ...check(
            cards.every((c) => c.kind === 'cost-cap' && c.unit === unit),
            `plafond dans une autre unité que ${unit ?? '—'}`
          ),
          ...check(!unit || held, 'message envoyé au-delà du plafond')
        ]
      }
    }
  },
  {
    id: 'auth-at-turn',
    label: 'connexion expirée au message',
    async run(env) {
      // L'erreur exacte de Bob 2.0.9 (`connexion-expiree-bob-tour`, fiche 200) : carte chez lui seulement, rien de supposé
      // ailleurs (erreur de tour ordinaire, ADR-0011).
      const { app, id } = await opened(env)
      await app.prompt(id, scenario(env.persona, 'auth-at-turn'))
      const blocker = app.view(id).snapshot?.blocker
      if (!env.persona.authAtTurn) {
        return {
          app,
          id,
          issues: [
            ...check(
              blocker === undefined,
              'carte de connexion chez un agent qui ne l’annonce pas'
            ),
            ...check(app.of(id, 'turn-error').length === 1, 'pas d’erreur de tour'),
            ...check(
              !noticeKeys(items(app, id)).includes('agentHost.authExpired'),
              'avis « connexion expirée » chez un agent qui ne l’annonce pas'
            )
          ]
        }
      }
      const card = blocker?.kind === 'auth' && blocker.atTurn === true ? blocker : undefined
      const sso = card?.methods.find((m) => !m.step)
      const cardIssues = [
        ...check(app.status(id) === 'needs-action', `statut ${app.status(id) ?? '—'}`),
        ...check(!!card, 'pas de carte « Connexion expirée »'),
        ...check(!!sso, 'pas de connexion par l’agent sur la carte'),
        ...check(app.of(id, 'turn-error').length === 0, 'erreur brute dans le fil')
      ]
      if (!sso) return { app, id, issues: cardIssues, status: ['needs-action'] }
      // Reconnecté : la même session est rouverte, le message renvoyé une fois.
      await app.manager.authenticate(id, sso.id)
      await waitFor(() => app.of(id, 'turn-end').length === 1, 'message renvoyé')
      return {
        app,
        id,
        issues: [
          ...cardIssues,
          ...check(
            agentText(lastTurn(items(app, id))).length > 0,
            'pas de réponse après la reconnexion'
          )
        ]
      }
    }
  }
]
