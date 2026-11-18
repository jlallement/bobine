// Maquettes de la fiche 240 : une fille en worktree part du dernier commit, sans le non commité
// de la mère. Avertissement et choix avant le lancement (saisie `@rôle`, carte « Tâches
// proposées »), avis en lecture seule dans le dossier de la mère, rappel dans la mère.
// Sur la vraie fenêtre : `@rôle` est tapé pour de vrai (jetons et ligne « Partira à… » réels) ;
// seuls les morceaux nouveaux sont injectés, avec les classes de l'app.
// node e2e/maquettes/run.mjs light f240 — validées le 2026-11-18, « Mettre de côté » retiré.
import { i } from './icons.mjs'

/* Teintes des rôles (`TINTS`, src/shared/themes.ts) : l'app les pose en `--role` depuis le JS. */
const TINT = {
  light: { pink: '#b8336f', green: '#2c8151', blue: '#1d5bbf' },
  dark: { pink: '#e27aa9', green: '#5cb87f', blue: '#8fb4f0' }
}

const FILES = [
  'plan.md',
  'maquettes/b.html',
  'server/index.js',
  'public/app.js',
  'test/api.test.js',
  'ios/Taches/ContentView.swift'
]
const COUNT = 17

/* ----------------------------------------------------------------- styles */

const CSS = `
.mq-dirty { margin: 8px 0 0; font-size: 13px; }
.mq-dirty .main-dirty-title { font-size: 13px; }
.mq-dirty .main-dirty-files { font-family: var(--font-mono); font-size: 12px; color: var(--text-2); }
.mq-dirty .main-dirty-why { font-size: 12.5px; }
.mq-dirty .main-dirty-actions { justify-content: flex-start; align-items: center; margin-top: 2px; }
.mq-dirty .main-dirty-actions .grow { flex: 1; }
.mq-dirty .mq-alt { display: flex; align-items: center; gap: 6px; padding: 6px 0 0 19px; margin-top: 2px; border-top: 1px dashed var(--border); color: var(--text-2); font-size: 12.5px; }
.mq-dirty .mq-alt svg { color: var(--muted); flex-shrink: 0; }
.mq-dirty .mq-alt .grow { flex: 1; }
.mq-dirty .worktree-form { margin-top: 2px; }
.mq-dirty .worktree-form textarea { width: 100%; min-height: 54px; font: inherit; font-size: 12.5px; }
.mq-composer-dock .main-dirty { margin-left: 12px; margin-right: 12px; }
.mq-dest-avis { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 6px 0 0 12px; font-size: 12px; line-height: 1.4; color: var(--text-2); }
.mq-dest-avis .role-tag { margin-left: 2px; }
.mq-dest-avis .mq-seen { color: var(--muted); }
.mq-proposal-dirty { margin: 0 0 4px; }
.proposal-row .btn.primary.mq-locked { opacity: .45; }
.mq-missing { display: flex; align-items: flex-start; gap: 6px; margin-top: 4px; font-size: 12.5px; color: var(--text-2); }
.mq-missing svg { color: var(--warn); flex-shrink: 0; margin-top: 2px; }
.mq-missing code { font-family: var(--font-mono); font-size: 11.5px; }
.mq-legend { position: fixed; left: 14px; bottom: 76px; z-index: 80; width: 270px; display: block; padding: 8px 11px; border-radius: 9px; background: var(--surface-2); border: 1px dashed var(--border-strong); color: var(--text-2); font-size: 12px; line-height: 1.45; }
.mq-legend b { color: var(--text); }
`

/* --------------------------------------------------------------- morceaux */

const userMsg = (text) =>
  `<div class="msg-user-group"><div class="msg-user">${text}</div><div class="msg-user-actions"><time class="msg-time">20:58</time></div></div>`
const agentMsg = (html, duration = '') =>
  `<div class="msg-agent-group"><div class="msg-agent"><div class="markdown">${html}</div></div>${duration ? `<div class="msg-agent-actions"><time class="msg-time">20:59</time><span class="msg-duration">${duration}</span></div>` : ''}</div>`
const toolDone = (icon, label) =>
  `<div data-testid="tool" data-status="completed"><details class="tool"><summary class="tool-row">${i(icon, 15, 'tool-icon')}<span class="tool-title"><span>${label}</span></span><span class="tool-state completed">${i('check', 14)}</span>${i('chevron-right', 14, 'chevron tool-icon')}</summary></details></div>`

/** Le fil de la mère : elle a écrit le plan, les maquettes et le serveur, rien n'est commité. */
const MOTHER =
  userMsg('Écris le plan de la page des tâches, deux maquettes, puis le serveur et ses tests.') +
  toolDone('file-pen', 'A écrit 17 fichiers') +
  toolDone('terminal', 'A lancé « npm test »') +
  agentMsg(
    '<p>C’est fait : <code>plan.md</code>, <code>maquettes/a.html</code> et <code>maquettes/b.html</code>, le serveur dans <code>server/</code>, la page dans <code>public/</code>, les tests dans <code>test/</code> (12 passent). Rien n’est encore commité.</p>',
    '3 min 12 s'
  )

const fileList = () =>
  `<ul class="main-dirty-files">${FILES.map((f) => `<li>${f}</li>`).join('')}<li class="muted">… et ${COUNT - FILES.length} autres</li></ul>`

/**
 * Avertissement avant lancement : même famille que « Fusion refusée » (MainDirtyCard), mêmes
 * actions, plus « Partir quand même ». `who` : qui part (« les 2 conversations filles »).
 * `avis` : propose aussi l'avis en lecture seule (saisie `@rôle` seulement).
 */
const dirtyBlock = ({ who, avis = false, commit = false, start = 'Partir quand même' }) => `
<div class="main-dirty mq-dirty" data-mq-dirty>
  <div class="main-dirty-title">${i('triangle-alert', 13)}<span>Ce dossier a ${COUNT} modifications non commitées : ${who} ne les ${who.startsWith('la ') ? 'verra' : 'verront'} pas.</span></div>
  ${fileList()}
  <div class="main-dirty-why">${who.startsWith('la ') ? 'Elle part' : 'Chacune part'} du dernier commit (<code>main</code> · <code>9970242</code> « chore: initial commit »), dans ${who.startsWith('la ') ? 'son' : 'son propre'} worktree. Committez d’abord pour qu’elles y soient.</div>
  ${
    commit
      ? `<div class="worktree-form"><label class="muted">Message du commit</label><textarea>feat: plan, mockups and task server with tests</textarea><div class="worktree-form-actions"><button class="btn small ghost">Annuler</button><button class="btn small primary">Committer puis lancer</button></div></div>`
      : `<div class="main-dirty-actions"><button class="btn small primary">Committer d’abord</button><span class="grow"></span><button class="btn small ghost">${start}</button></div>`
  }
  ${
    avis && !commit
      ? `<div class="mq-alt">${i('eye', 13)}<span>Juste un avis ? Ils peuvent lire ce dossier tel quel, non commité compris, sans rien y modifier.</span><span class="grow"></span><button class="btn small">Demander un avis en lecture seule</button></div>`
      : ''
  }
</div>`

const legend = (html) => `<div class="mq-legend"><p style="margin:0">${html}</p></div>`

/* ------------------------------------------------------------ préparation */

/** Fil de la mère, titre, dossier « taches ». */
async function mother(h, thread = MOTHER) {
  await clearComposer(h)
  await h.stage('[data-testid=thread]', `<div class="thread">${thread}</div>`)
  await h.title('Page des tâches : plan, maquettes, serveur')
  await h.ui.ev(
    `document.querySelectorAll('[data-testid=workspace-menu] .chip-label').forEach((n) => (n.textContent = 'taches'))`
  )
}

/** Saisie vidée pour de bon (sélection puis effacement) : React voit le changement. */
async function clearComposer(h) {
  const ui = h.ui
  // run.mjs vide la valeur du DOM sans que React le sache : on rétablit puis efface pour de bon.
  await ui.ev(`(() => { const i = document.querySelector('[data-testid=composer-input]'); i.focus()
    document.execCommand('selectAll'); document.execCommand('insertText', false, 'x')
    document.execCommand('selectAll'); document.execCommand('delete') })()`)
  await ui.press('Escape')
  await ui.ev(`document.activeElement?.blur()`)
}

/** Tape vraiment `@rôle…` dans la saisie : jetons et ligne « Partira à… » de l'app. */
async function typeRoles(h, text) {
  const ui = h.ui
  const input = `document.querySelector('[data-testid=composer-input]')`
  await ui.ev(`${input}.focus()`)
  await ui.type(text)
  await ui.press('Escape')
  await ui.waitFor(`!!document.querySelector('[data-testid=role-destination]')`, 8000)
}

/** Insère `html` juste après la ligne « Partira à… » (ou à la place, `replace`). */
async function afterDestination(h, html, replace = false) {
  const keep = replace
    ? ''
    : await h.ui.ev(`document.querySelector('[data-testid=role-destination]').outerHTML`)
  await h.stage(
    '[data-testid=role-destination]',
    `<div class="mq-composer-dock">${keep}${html}</div>`
  )
}

/* ---------------------------------------------------------------- écrans */

export const WORKTREE_CHILD_SCREENS = [
  {
    id: 'f240-1-role-avertissement',
    agent: 'OpenCode',
    prepare: async (h) => {
      await h.css(CSS)
      await mother(h)
      await typeRoles(
        h,
        '@ux-ui-expert @back-architect construisez la page des tâches d’après plan.md '
      )
      await afterDestination(h, dirtyBlock({ who: 'les 2 conversations filles', avis: true }))
      await h.stage(
        'body',
        legend(
          '<b>Saisie @rôle, dossier modifié.</b> Visible dès que les rôles sont cités ; Entrée n’envoie rien tant qu’aucun choix n’est fait (le focus va sur l’avertissement). Rien si le dossier est propre.'
        ),
        'append'
      )
    }
  },
  {
    id: 'f240-2-role-committer',
    agent: 'OpenCode',
    prepare: async (h) => {
      await h.css(CSS)
      await mother(h)
      await typeRoles(
        h,
        '@ux-ui-expert @back-architect construisez la page des tâches d’après plan.md '
      )
      await afterDestination(h, dirtyBlock({ who: 'les 2 conversations filles', commit: true }))
      await h.stage(
        'body',
        legend(
          '<b>« Committer d’abord ».</b> Le formulaire de la carte de fusion (message proposé, modifiable) ; « Committer puis lancer » committe dans ce dossier, puis les filles partent de ce commit.'
        ),
        'append'
      )
    }
  },
  {
    id: 'f240-3-role-avis',
    agent: 'OpenCode',
    prepare: async (h, scheme) => {
      await h.css(CSS)
      await mother(h)
      await typeRoles(
        h,
        '@ux-ui-expert @back-architect donnez votre avis sur plan.md et maquettes/b.html '
      )
      void scheme
      const stack = await h.ui.ev(
        `document.querySelector('[data-testid=role-destination] .role-stack')?.outerHTML ?? ''`
      )
      await afterDestination(
        h,
        `<div class="mq-dest-avis" data-maq-avis>${stack}<span>Partira à <strong>2 rôles</strong>, pour un <strong>avis</strong> : une conversation fille chacun, en parallèle</span><span class="role-destination-detail">· dans ce dossier · lecture seule demandée</span><span class="role-destination-detail mq-seen">· ils voient les ${COUNT} modifications non commitées</span><button class="btn small ghost" style="margin-left:auto;margin-right:12px">Plutôt les faire travailler…</button></div>`,
        true
      )
      await h.stage(
        'body',
        legend(
          '<b>Après « Demander un avis en lecture seule ».</b> Plus d’avertissement : les filles lisent le dossier de la mère, non commité compris. Avec OpenCode (écrit sans demander), la lecture seule est demandée et le dossier surveillé, comme pour un rôle en lecture seule. « Plutôt les faire travailler… » revient à l’avertissement.'
        ),
        'append'
      )
    }
  },
  {
    id: 'f240-4-taches-proposees',
    agent: 'OpenCode',
    prepare: async (h, scheme) => {
      await h.css(CSS)
      const t = TINT[scheme]
      const row = (label, color, icon, title, desc) => `
<div class="proposal-row">
  <div class="proposal-main">
    <button type="button" class="proposal-title">${i('chevron-right', 14)}${
      label
        ? `<span class="role-avatar s22 child-report-icon" style="--role:${color}" data-state="idle">${i(icon, 12)}</span><span><strong class="proposal-role-label">${label}</strong> — ${title}</span>`
        : `<span>${title}</span>`
    }</button>
    <span class="grow"></span>
    <span class="proposal-actions"><button class="btn small ghost icon">${i('sliders-horizontal', 14)}</button><button class="btn small ghost">Refuser</button><button class="btn small">Faire ici</button><button class="btn small primary mq-locked" title="Choisissez d’abord ci-dessus">Lancer</button></span>
  </div>
  ${desc ? `<div class="proposal-note">${desc}</div>` : ''}
</div>`
      void t
      const card = `
<div class="permission-card proposals">
  <div class="pc-head">${i('split', 18, 'pc-icon')}<div><div class="pc-title">3 tâches proposées</div><div class="pc-sub">L’agent propose de confier ce travail à des conversations filles, chacune dans son propre worktree. Vous pouvez aussi lui demander de le faire ici.</div></div></div>
  <div class="mq-proposal-dirty">${dirtyBlock({ who: 'les conversations filles lancées d’ici', start: 'Lancer quand même' })}</div>
  <div class="proposal-rows">
    ${row('', '', '', 'API et tests', '')}
    ${row('', '', '', 'Page web', '')}
    ${row('', '', '', 'App iOS (SwiftUI)', '')}
  </div>
  <div class="pc-actions proposals-foot"><span class="question-hint">↑ ↓ pour choisir une ligne, Entrée pour la lancer</span></div>
</div>`
      await mother(
        h,
        `${MOTHER}${userMsg('Découpe la suite en trois tâches parallèles : API, page web, app iOS.')}${toolDone('split', 'A proposé 3 tâches')}${card}`
      )
      await h.ui.ev(`document.querySelector('.scroll')?.scrollTo(0, 99999)`)
      await h.stage(
        'body',
        legend(
          '<b>Carte « Tâches proposées », dossier modifié.</b> Un avertissement pour la carte (le dossier est le même pour toutes les lignes) ; « Lancer » attend le choix. « Faire ici », « Refuser » et une ligne d’un rôle en lecture seule ne sont pas concernés. Même bloc dans « Lancer en parallèle… » et après <code>/split</code>.'
        ),
        'append'
      )
    }
  },
  {
    id: 'f240-5-rappel-mere',
    agent: 'OpenCode',
    prepare: async (h, scheme) => {
      await h.css(CSS)
      const t = TINT[scheme]
      const launch = (label, color, icon, title) => `
<div class="role-launch" style="--role:${color}" data-state="unread">
  <span class="role-avatar s30" style="--role:${color}" data-state="done">${i(icon, 16)}</span>
  <div class="role-launch-body">
    <div class="role-launch-head"><strong>${label}</strong><span class="role-state">a rendu son compte rendu</span><span class="grow"></span><button class="btn small">Ouvrir</button></div>
    <div class="role-launch-title">${title}</div>
    <div class="role-launch-meta"><span class="role-tag warn">${i('triangle-alert', 12)}Parti sans ${COUNT} modifications non commitées</span><button type="button" class="link-button role-launch-toggle">Consigne${i('chevron-right', 12, 'chevron')}</button></div>
  </div>
</div>`
      const report = (label, color, icon, title, lead) => `
<div class="child-report done${label ? ' role-report' : ''}">
  ${
    label
      ? `<span class="role-avatar s22 child-report-icon" style="--role:${color}" data-state="done">${i(icon, 12)}</span>`
      : i('circle-check', 14, 'child-report-icon')
  }
  <div class="child-report-body">
    <div class="child-report-head"><button class="link-button child-report-title">${label ? `${label} a rendu son compte rendu — ${title}` : `« ${title} » a fini son tour`}</button><span class="child-report-usage">4 échanges · 31 k jetons</span></div>
    <div class="mq-missing">${i('triangle-alert', 13)}<span>Partie du commit <code>9970242</code> sans les ${COUNT} modifications non commitées de ce dossier (<code>plan.md</code>, <code>server/</code>, <code>public/</code>…) : son travail ne les a pas vues.</span></div>
    <button class="child-report-toggle"><span class="child-report-lead">${lead}</span>${i('chevron-right', 14, 'chevron')}</button>
  </div>
</div>`
      await mother(
        h,
        `${MOTHER}${userMsg('@ux-ui-expert construisez la page des tâches d’après plan.md')}${launch('Expert UX/UI', t.pink, 'palette', 'Page des tâches d’après plan.md')}${report('Expert UX/UI', t.pink, 'palette', 'Page des tâches d’après plan.md', 'Je ne trouve ni plan.md ni les maquettes : j’ai repris une page à partir de README.md.')}${toolDone('split', 'Conversation fille lancée : « API et tests »')}${report('', '', '', 'API et tests', 'API REST des tâches dans api/, avec 9 tests ; le dossier n’avait pas de serveur.')}`
      )
      await h.ui.ev(`document.querySelector('.scroll')?.scrollTo(0, 99999)`)
      await h.stage(
        'body',
        legend(
          '<b>Rappel dans la mère</b>, pour une fille partie quand même : sur sa carte de lancement (étiquette) et sur chaque compte rendu (ligne, avec le commit de départ). Le compte rendu qui réveille l’agent le dit aussi, en anglais.'
        ),
        'append'
      )
    }
  }
]
