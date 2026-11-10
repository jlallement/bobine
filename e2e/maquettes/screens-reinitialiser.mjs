// Maquettes : recommencer à neuf (fiche 148) — profil temporaire pour essayer Bobine comme neuve,
// et réinitialisation façon désinstalleur. Sur la vraie fenêtre des réglages (onglet Données) :
// seule la nouvelle section est injectée, avec les vraies classes de l'app.
import { i } from './icons.mjs'

const row = (label, hint, control, extra = '') =>
  `<div class="settings-row ${extra}"><div class="settings-row-text"><div class="settings-row-label">${label}</div>${hint ? `<div class="settings-row-hint">${hint}</div>` : ''}</div><div class="settings-row-control">${control}</div></div>`

const toggle = (on = false) =>
  `<label class="switch"><input type="checkbox" ${on ? 'checked' : ''}><span></span></label>`

const keepList = (uninstall) => `
<div class="mq-reset-cols">
  <div>
    <div class="mq-reset-head">${i('trash-2', 13)}Part à la corbeille</div>
    <ul class="mq-reset-list">
      <li><span>Conversations</span><b>128 · 412 Mo</b></li>
      <li><span>Réglages, clés d’API, sites autorisés</span><b>48 Ko</b></li>
      <li><span>Journal de consommation</span><b>2,1 Mo</b></li>
      <li><span>Cookies et données du navigateur</span><b>86 Mo</b></li>
      <li><span>Journaux et cache</span><b>31 Mo</b></li>
      ${uninstall ? '<li><span>L’app Bobine</span><b>/Applications</b></li>' : ''}
    </ul>
    <div class="mq-reset-note">Et la clé « Bobine Safe Storage » du trousseau, qui chiffre les clés d’API.</div>
  </div>
  <div>
    <div class="mq-reset-head">${i('shield-check', 13)}Reste en place</div>
    <ul class="mq-reset-list">
      <li><span>Vos projets et leurs worktrees</span></li>
      <li><span>IBM Bob et OpenCode : connexions, réglages, sessions</span></li>
      ${uninstall ? '' : '<li><span>L’app Bobine</span></li>'}
    </ul>
  </div>
</div>`

const confirmPanel = (uninstall = false) => `
<div class="mq-reset-confirm">
  <p class="mq-reset-lead">Bobine se ferme, met ses données à la corbeille (rien n’est perdu tant qu’elle n’est pas vidée), puis ${uninstall ? 'part elle aussi à la corbeille.' : 'redémarre comme au premier lancement.'}</p>
  ${keepList(uninstall)}
  <label class="mq-reset-check"><input type="checkbox" ${uninstall ? 'checked' : ''}> Mettre aussi l’app à la corbeille (désinstaller)</label>
  <div class="mq-reset-actions"><span class="grow"></span><button class="btn small ghost">Garder</button><button class="btn small danger">${uninstall ? 'Tout effacer et désinstaller' : 'Tout effacer et redémarrer'}</button></div>
</div>`

const section = ({ confirm = false, uninstall = false, agents = false } = {}) => `
<div class="mq-fresh">
  <h3 class="settings-h3">Recommencer à neuf</h3>
  <div class="settings-card">
    ${row('Essayer Bobine comme neuve', 'Ouvre une seconde Bobine sur un profil vide, comme au premier lancement. Rien n’en est gardé à sa fermeture ; vos conversations et réglages ne sont pas touchés.', `<button class="btn small">${i('flask-conical', 13)}Ouvrir</button>`)}
    ${row('Agents comme sur un Mac neuf', 'Bob et OpenCode y redemandent leur connexion et la confiance des dossiers. Vos vraies connexions ne changent pas.', toggle(agents), 'sub')}
    ${row('Réinitialiser Bobine', 'Tout ce que Bobine garde sur ce Mac part à la corbeille, puis elle redémarre comme au premier lancement. Vos projets et vos agents ne sont pas touchés.', `<button class="btn small danger">Réinitialiser…</button>`)}
    ${confirm ? confirmPanel(uninstall) : ''}
  </div>
</div>`

const CSS = `
.settings-dialog { height: calc(100vh - 48px) !important; }
.mq-fresh { margin-top: 8px; }
.mq-reset-confirm { padding: 0 16px 14px; border-radius: 0 0 11px 11px; background: var(--err-soft); }
.settings-card > .settings-row:has(+ .mq-reset-confirm) { border-bottom: 0; background: var(--err-soft); }
.mq-reset-title { font-weight: 600; font-size: 14px; color: var(--text); }
.mq-reset-lead { margin: 0 0 12px; font-size: 13px; color: var(--text-2); }
.mq-reset-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.mq-reset-head { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--text-2); margin-bottom: 6px; text-transform: uppercase; letter-spacing: .04em; }
.mq-reset-list { list-style: none; margin: 0; padding: 0; font-size: 13px; color: var(--text); }
.mq-reset-list li { display: flex; gap: 8px; padding: 3px 0; }
.mq-reset-list li span { flex: 1; }
.mq-reset-list li b { font-weight: 400; color: var(--muted); font-variant-numeric: tabular-nums; }
.mq-reset-note { margin-top: 6px; font-size: 12px; color: var(--muted); }
.mq-reset-check { display: flex; align-items: center; gap: 8px; margin-top: 14px; font-size: 13px; color: var(--text); }
.mq-reset-actions { display: flex; gap: 8px; margin-top: 12px; }
.mq-reset-actions .grow, .mq-temp-chip + .grow { flex: 1; }
.mq-temp-chip { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border-radius: 12px; font-size: 12px; color: var(--text-2); background: var(--surface-2); border: 1px dashed var(--border-strong); margin-right: 8px; }
.mq-temp-chip svg { color: var(--accent); }
`

/** Réglages › Données, réelle, avec la section « Recommencer à neuf » ajoutée en bas. */
async function dataSettings(h, opts) {
  await h.css(CSS)
  const ev = h.ui.ev
  await h.ui.click(h.ui.$('open-settings'))
  await h.ui.waitFor(`!!document.querySelector('[data-testid=settings]')`)
  await ev(
    `[...document.querySelectorAll('.settings-nav-item')].find((b) => b.textContent.trim() === 'Données').click()`
  )
  await h.ui.waitFor(`!!document.querySelector('[data-testid=usage-reset-card]')`)
  await h.stage('.settings-main section', section(opts), 'append')
  h.after = `(() => { document.querySelector('.mq-fresh').scrollIntoView({ block: 'end' }); document.activeElement?.blur() })()`
}

export const RESET_SCREENS = [
  {
    id: 'neuf-1-donnees',
    title: 'Réglages › Données : « Recommencer à neuf », en bas',
    agent: 'IBM Bob',
    prepare: (h) => dataSettings(h, {})
  },
  {
    id: 'neuf-2-confirmer',
    title: 'Réinitialiser : ce qui part à la corbeille, ce qui reste',
    agent: 'IBM Bob',
    tall: true,
    prepare: (h) => dataSettings(h, { confirm: true })
  },
  {
    id: 'neuf-3-desinstaller',
    title: 'Réinitialiser et désinstaller : l’app part aussi à la corbeille',
    agent: 'IBM Bob',
    tall: true,
    prepare: (h) => dataSettings(h, { confirm: true, uninstall: true })
  },
  {
    id: 'neuf-4-temporaire',
    title: 'La seconde Bobine, sur un profil temporaire : neuve, et marquée comme telle',
    agent: 'IBM Bob',
    prepare: async (h) => {
      await h.css(CSS)
      await h.ui.click(h.ui.$('new-conversation'))
      await h.ui.waitFor(`!!document.querySelector('[data-testid=welcome]')`)
      await h.stage(
        '.sidebar-body',
        `<nav class="sidebar-body mq-sb"><div class="mq-sb-fixed"><button class="sidebar-item primary"><span class="icon-badge">${i('plus', 14)}</span><span class="label">Nouvelle conversation</span></button><button class="sidebar-item"><span class="icon-badge plain">${i('chart-column', 15)}</span><span class="label">Mon activité</span><kbd class="sidebar-kbd">⇧⌘U</kbd></button></div><div class="mq-sb-scroll"></div></nav>`
      )
      h.after = `(() => {
        const head = document.querySelector('.main-header'); const grow = head.querySelector(':scope > .grow')
        const chip = document.createElement('span'); chip.className = 'mq-temp-chip'; chip.setAttribute('data-maq', '')
        chip.innerHTML = ${JSON.stringify(`${i('flask-conical', 13)}Profil temporaire · effacé à la fermeture`)}
        grow.after(chip)
        document.querySelectorAll('.sidebar-footer .name').forEach((n) => (n.textContent = 'IBM Bob'))
      })()`
    }
  }
]
