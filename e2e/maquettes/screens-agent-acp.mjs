// Maquettes de la fiche 141 (agent ACP personnalisé) : sur la vraie page Réglages › Agents, la
// ligne « Ajouter un agent ACP… », le formulaire, et la page d'un agent déclaré.
import { i } from './icons.mjs'

const dot = '<span class="status-dot ready" aria-hidden></span>'

const customRow = `<li class="agent-list-row"><button class="agent-list-open"><span class="agent-avatar" aria-hidden>A</span><span class="agent-list-text"><span class="agent-list-name">Agent maison</span><small>${dot}Prêt · 0.4.2</small></span>${i('chevron-right', 15)}</button></li>`
const addRow = `<li class="agent-list-row"><button class="agent-list-open agent-list-add">${i('plus', 15)}<span class="agent-list-text"><span class="agent-list-name">Ajouter un agent ACP…</span></span></button></li>`

const field = (label, value, hint, { mono = false, area = 0, error = '' } = {}) =>
  `<label><span>${label}</span>${
    area
      ? `<textarea class="mono" rows="${area}">${value}</textarea>`
      : `<input class="${mono ? 'mono' : ''}" value="${value}">`
  }${error ? `<small class="custom-agent-error">${error}</small>` : ''}<small>${hint}</small></label>`

const form = (error) =>
  `<section data-maq-form><p class="settings-row-hint" style="margin:0 4px 12px">Tout agent qui parle ACP sur son entrée et sa sortie standard. Ce qu’il sait faire est lu à son démarrage.</p><form class="mcp-form custom-agent-form">` +
  field('Nom', 'Agent maison', 'Celui qu’on voit dans la liste et dans le menu des agents.') +
  field(
    'Commande',
    'npx -y @acme/agent-acp --acp',
    'Comme dans un terminal : la commande, puis ses arguments. Des guillemets autour d’un chemin qui contient des espaces.',
    { mono: true }
  ) +
  field(
    'Variables d’environnement',
    error ? 'ACME_REGION=eu\nACME LOG info' : 'ACME_REGION=eu\nACME_LOG=info',
    'Une par ligne : <code>NOM=valeur</code>. Pas de secret ici : la clé d’API se déclare plus bas.',
    { area: 3, error }
  ) +
  `<div class="custom-agent-optional">Facultatif</div>` +
  field(
    'Variable de la clé d’API',
    'ACME_API_KEY',
    'La clé se saisit ensuite sur la page de l’agent, chiffrée dans le trousseau de macOS.',
    { mono: true }
  ) +
  field(
    'Commande de compaction',
    '',
    'Seulement si l’agent ne l’annonce pas parmi ses commandes (ex. <code>/compact</code>).',
    { mono: true }
  ) +
  `<div class="mcp-form-actions"><button type="button" class="btn small ghost">Annuler</button><button type="button" class="btn small primary" ${error ? 'disabled' : ''}>Ajouter</button></div></form></section>`

const css = `
.agent-list-add { color: var(--accent); }
.agent-list-add svg { width: 32px; flex-shrink: 0; }
.custom-agent-form { gap: 12px; }
.custom-agent-optional { margin-top: 4px; font-size: 11.5px; font-weight: 600; letter-spacing: .02em; text-transform: uppercase; color: var(--muted); }
.mcp-form small.custom-agent-error { color: var(--err); }
.mcp-form small code { font-family: var(--font-mono); font-size: 11px; }
`

async function openAgents(h) {
  const { ui } = h
  if (!(await ui.ev(`!!document.querySelector('[data-testid=settings]')`))) {
    await ui.click(ui.$('open-settings'))
    await ui.waitFor(`!!document.querySelector('[data-testid=settings]')`)
  }
  await ui.click(ui.$('settings-agents'))
  await ui.waitFor(`!!document.querySelector('[data-testid=settings-agent-list]')`)
  await h.css(css)
}

const heading = (title) =>
  `<h2 class="settings-heading"><span class="settings-crumb" style="display:inline-flex;align-items:center;gap:2px;margin-right:10px;font-weight:400;font-size:13px;color:var(--muted)">${i('chevron-left', 15)}Agents</span>${title}</h2>`

export const AGENT_ACP_SCREENS = [
  {
    id: 'agent-acp-1-liste',
    title: 'Réglages › Agents : un agent déclaré, et « Ajouter un agent ACP… » en dernière ligne',
    agent: 'IBM Bob',
    prepare: async (h) => {
      await openAgents(h)
      await h.stage('[data-testid=settings-agent-list]', customRow, 'append')
      await h.stage('[data-testid=settings-agent-list]', addRow, 'append')
    }
  },
  {
    id: 'agent-acp-2-formulaire',
    title: 'Nouvel agent ACP : nom, commande, variables, clé et compaction facultatives',
    agent: 'IBM Bob',
    tall: true,
    prepare: async (h) => {
      await openAgents(h)
      await h.stage('.settings-heading', heading('Nouvel agent ACP'))
      await h.stage('.settings-body > section', form(''))
    }
  },
  {
    id: 'agent-acp-3-erreur',
    title: 'Nouvel agent ACP : ligne de variable mal formée, « Ajouter » grisé',
    agent: 'IBM Bob',
    tall: true,
    prepare: async (h) => {
      await openAgents(h)
      await h.stage('.settings-heading', heading('Nouvel agent ACP'))
      await h.stage(
        '.settings-body > section',
        form('Ligne 2 : <code>NOM=valeur</code> attendu (« ACME LOG info »).')
      )
    }
  },
  {
    id: 'agent-acp-4-page',
    title: 'Page de l’agent déclaré : « Modifier » à côté de « Relancer », « Supprimer » en bas',
    agent: 'IBM Bob',
    tall: true,
    prepare: async (h) => {
      await openAgents(h)
      const { ui } = h
      await ui.click(`document.querySelector('[data-testid=settings-agent]')`)
      await ui.waitFor(`!!document.querySelector('[data-testid=settings-agent-page]')`)
      await ui.ev(`(() => {
        const page = document.querySelector('[data-testid=settings-agent-page]')
        const set = (sel, v) => page.querySelectorAll(sel).forEach((n) => (n.textContent = v))
        set('.agent-head-name', 'Agent maison')
        set('.agent-head-command', 'npx -y @acme/agent-acp --acp')
        page.querySelector('.agent-head .agent-avatar').textContent = 'A'
        document.querySelector('[data-testid=settings-heading]').textContent = 'Agent maison'
        page.querySelectorAll('.settings-h3').forEach((n) => { if (n.textContent.startsWith('Propre')) n.textContent = 'Propre à Agent maison' })
        const label = page.querySelector('[data-testid=settings-api-keys] .settings-row-label, [data-testid=settings-api-keys] li > div > div')
        if (label) label.textContent = 'Clé d’API (ACME_API_KEY)'
      })()`)
      await h.stage(
        '[data-testid=agent-specific]',
        '<ul class="settings-list agent-specific"><li class="settings-list-empty">Rien : tout passe par ACP.</li></ul>'
      )
      await h.stage(
        '.agent-head',
        `<button class="btn small" style="margin-right:6px">Modifier…</button>`,
        'append'
      )
      await ui.ev(
        `(() => { const head = document.querySelector('.agent-head'); const added = head.lastElementChild; const restart = head.querySelector('[data-testid=agent-page-restart]'); if (restart) head.insertBefore(added, restart) })()`
      )
      await h.stage(
        '[data-testid=settings-agent-page]',
        `<div><h3 class="settings-h3">Déclaré dans Bobine</h3><div class="settings-card"><div class="settings-row"><div class="settings-row-text"><div class="settings-row-label">Supprimer cet agent</div><div class="settings-row-hint">Ses conversations restent consultables, en lecture seule.</div></div><div class="settings-row-control"><button class="btn small">Supprimer…</button></div></div></div></div>`,
        'append'
      )
    }
  }
]
