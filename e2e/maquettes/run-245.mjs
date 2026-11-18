// Maquettes de la fiche 245 : « Jetons traités » = entrée + sortie partout (cache à part), « ≈ » et
// « estimation » sur chaque coût, essai de l'accueil avec le modèle de la conversation, et l'option
// D13 (« ✕ 1 échec · ⊘ 1 interrompu »). Sur la vraie fenêtre : app buildée, agent factice
// (`premier-essai` : il répond et annonce sa consommation), vrais composants (`/cost`, détail de
// la consommation, Mon activité, accueil) dont seuls les textes sont remplacés par les chiffres de
// la recette du 2026-11-17 et le rendu proposé.
//   pnpm build && node e2e/maquettes/run-245.mjs [light|dark] [f245-…]
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NEUTRAL_AGENT_ENV, sleep, withApp } from '../lib.mjs'
import { i, resolveIcons } from './icons.mjs'

const schemes =
  process.argv[2] && !process.argv[2].includes('-') ? [process.argv[2]] : ['light', 'dark']
const only = process.argv.slice(process.argv[2] && !process.argv[2].includes('-') ? 3 : 2)
const wanted = (id) => !only.length || only.some((o) => id.startsWith(o))

const CSS = `
.mq-legend { position: fixed; left: 14px; bottom: 76px; z-index: 80; width: 270px; padding: 8px 11px; border-radius: 9px; background: var(--surface-2); border: 1px dashed var(--border-strong); color: var(--text-2); font-size: 12px; line-height: 1.45; }
.mq-legend b { color: var(--text); }
.mq-legend s { color: var(--muted); }
.mq-new { box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent); border-radius: 4px; }
.usage-row.mq-apart span:first-child::before { content: ''; }
.usage-row.mq-apart { color: var(--muted); }
.usage-hint.mq-hint { margin-top: 4px; }
.usage-kpi-sub + .usage-kpi-sub { margin-top: 2px; }
.mq-warn { color: var(--warn); }
.tool-state .mq-sep { color: var(--muted); margin: 0 2px; }
`

/** Remplace un nœud par du HTML (icônes résolues) ; `mode` : replace | append | prepend. */
async function stage(ui, sel, html, mode = 'replace') {
  const markup = await resolveIcons(html)
  return ui.ev(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)})
    if (!el) throw new Error('absent : ' + ${JSON.stringify(sel)})
    const t = document.createElement('template'); t.innerHTML = ${JSON.stringify(markup)}
    const n = t.content.firstElementChild; n.setAttribute('data-maq', '')
    const mode = ${JSON.stringify(mode)}
    if (mode === 'replace') { el.style.display = 'none'; el.after(n) }
    else if (mode === 'append') el.append(n)
    else el.prepend(n)
    return true })()`)
}

const css = (ui, text) =>
  ui.ev(
    `(() => { let s = document.getElementById('maq-245'); if (!s) { s = document.createElement('style'); s.id = 'maq-245'; document.head.append(s) } s.textContent = ${JSON.stringify(text)} })()`
  )

const legend = (ui, html) =>
  stage(ui, 'body', `<div class="mq-legend">${html}</div>`, 'append')

const clearLegend = (ui) => ui.ev(`document.querySelectorAll('.mq-legend').forEach((n) => n.remove())`)

/** L'app habillée en OpenCode, conversation de la recette. */
async function dress(ui, model = 'GPT-6 Luna') {
  await ui.ev(`(() => {
    const set = (s, v) => document.querySelectorAll(s).forEach((n) => (n.textContent = v))
    set('.sidebar-footer .name', 'OpenCode')
    set('.sidebar-footer [data-testid=agent-status]', 'Prêt')
    const av = document.querySelector('.sidebar-footer .agent-avatar'); if (av) av.firstChild.textContent = 'O'
    set('[data-testid=agent-menu] .chip-label', 'OpenCode')
    const m = document.querySelector('[data-testid=model-chip]'); if (m) { m.style.display = ''; const l = m.querySelector('.chip-label'); if (l) l.textContent = ${JSON.stringify(model)} }
    set('[data-testid=mode-chip] .chip-label', 'Build')
    set('[data-testid=workspace-menu] .chip-label', 'taches')
    const t = document.querySelector('.main-title-text'); if (t) t.textContent = 'Nous allons construire un petit gestionnaire de tâches'
    const inp = document.querySelector('[data-testid=composer-input]'); if (inp) inp.placeholder = 'Répondre à OpenCode…'
    document.querySelectorAll('[data-testid=usage-meter] .usage-percent').forEach((n) => (n.textContent = '8 %'))
    document.querySelectorAll('.sidebar .history-item .label').forEach((n, k) => { if (k === 0) n.textContent = 'Nous allons construire un petit gestionnaire de tâches' })
  })()`)
}

const appCommand = async (ui, command) => {
  await ui.ev(
    `(() => { const t = ${ui.$('composer-input')}; t.focus(); t.select(); return true })()`
  )
  await ui.type(command)
  await ui.press('Escape')
  await ui.press('Enter')
}

/* ------------------------------------------------------------------ fil */

const user = (text) =>
  `<div class="msg-user-group"><div class="msg-user">${text}</div><div class="msg-user-actions"><time class="msg-time">22:05</time></div></div>`
const agent = (html) =>
  `<div class="msg-agent-group"><div class="msg-agent"><div class="markdown">${html}</div></div></div>`
const summary = (text) =>
  `<div class="turn-summary">${i('circle-check', 13)}<span>${text}</span></div>`
const report = (icon, title, usage, meta, body, tone = '') => `
<div class="child-report ${tone}">${i(icon, 14, 'child-report-icon')}<div class="child-report-body">
  <div class="child-report-head"><strong class="child-report-title">${title}</strong><span class="child-report-usage mq-new">${usage}</span></div>
  ${meta ? `<div class="child-report-meta">${meta}</div>` : ''}
  ${body ? `<p class="review-summary">${body}</p>` : ''}
</div></div>`

const FIL = `<div class="thread">
${user('Exécute ce plan.')}
${agent('<p>Le gestionnaire est en place : API Node.js sans framework, page web, sources SwiftUI. <code>npm test</code> réussit (3 tests).</p>')}
${summary('Terminé en 2 min 24 s · 14 fichiers +625 −2 · ≈ 0,0075&nbsp;$US')}
${report('circle-check', 'Code reviewer a rendu son compte rendu — Relis l’ensemble des modifications non commitées', '≈ 0,00&nbsp;$US', '', 'Compte rendu : j’ai relu les modifications non commitées, y compris les fichiers ajoutés…')}
${report('circle-check', 'Relecture par OpenCode : rien à signaler', '≈ 0,00&nbsp;$US', '<span>Modifications non commitées</span><span>12 fichiers</span>', 'Aucun problème de correction ou de gestion des erreurs réseau suffisamment certain n’a été trouvé.', 'review-card clean')}
<div class="subtasks"><div class="subtasks-head"><strong>Sous-tâches</strong><span class="muted"> · 2 finies</span><span class="subtasks-total mq-new">≈ 0,00&nbsp;$US</span></div>
<div class="subtask-row" data-state="done"><span class="subtask-info"><span class="subtask-title">Construire API et tests</span><span class="subtask-meta"><span class="subtask-branch">${i('git-branch', 12)} bobine/20261117-2109-9700</span><span class="subtask-cost mq-new">≈ 0,00&nbsp;$US</span></span></span><button class="subtask-status">${i('circle-check', 16)}</button><button class="btn small">Ouvrir</button></div>
<div class="subtask-row" data-state="done"><span class="subtask-info"><span class="subtask-title">Construire la page web</span><span class="subtask-meta"><span class="subtask-branch">${i('git-branch', 12)} bobine/20261117-2109-4d35</span><span class="subtask-cost mq-new">≈ 0,00&nbsp;$US</span></span></span><button class="subtask-status">${i('circle-check', 16)}</button><button class="btn small">Ouvrir</button></div>
</div>
</div>`

const toolRow = (icon, title, state) =>
  `<div data-testid="tool"><details class="tool"><summary class="tool-row">${i(icon, 15, 'tool-icon')}<span class="tool-title"><span>${title}</span></span>${state}${i('chevron-right', 14, 'chevron tool-icon')}</summary></details></div>`
const FAILED = `<span class="tool-state failed">${i('x', 14)} échec</span>`
const CANCELLED = `<span class="tool-state cancelled">${i('ban', 13)} interrompu</span>`
const DONE = `<span class="tool-state completed">${i('check', 15)}</span>`

const GROUPE = `<div class="thread">
${user('Ajoute une page « À propos » à la page web, avec des tests.')}
<div class="tool-group"><details class="tool" open><summary class="tool-row">${i('layers', 15, 'tool-icon')}<span class="tool-title"><span>1 commande, 4 lectures et 1 modification</span></span><span class="tool-state failed mq-new">${i('x', 14)} 1 échec</span><span class="mq-sep">·</span><span class="tool-state cancelled mq-new">${i('ban', 13)} 1 interrompu</span>${i('chevron-right', 14, 'chevron tool-icon')}</summary>
<div class="tool-group-items">
${toolRow('terminal', 'shell', FAILED)}
${toolRow('file-text', 'Lecture de web/index.html', DONE)}
${toolRow('file-text', 'Lecture de web/app.js', DONE)}
${toolRow('file-text', 'Lecture de web/style.css', DONE)}
${toolRow('file-text', 'Lecture de web/app.test.js', DONE)}
${toolRow('file-pen', 'patch', CANCELLED)}
</div></details></div>
<div class="notice notice-info">Réponse interrompue.</div>
</div>`

/* ------------------------------------------------------------ séances */

async function conversationScreens(scheme) {
  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      await ui.viewport(1440, 900)
      await ui.send('Bonjour')
      await ui.waitFor(`!!document.querySelector('[data-testid=turn-summary]')`, 20000)
      await css(ui, CSS)
      if (await ui.ev(`!!document.querySelector('[data-testid=side-panel]')`)) {
        await ui.ev(`${ui.$('panel-toggle')}.click()`)
        await sleep(400)
      }
      await dress(ui)

      if (wanted('f245-1')) {
        await appCommand(ui, '/cost')
        await ui.waitFor(`document.querySelectorAll('[data-testid=notice-report]').length === 1`)
        await dress(ui)
        await ui.ev(`(() => {
          const n = document.querySelector('[data-testid=notice-report] .notice-body span')
          n.innerHTML = 'Jetons traités&nbsp;: 242&nbsp;370 sur 17 échanges (216&nbsp;288 en entrée, 26&nbsp;082 en sortie)\\n<span class="mq-new">En plus&nbsp;: 3&nbsp;801&nbsp;728 relus en cache, 7&nbsp;805 de réflexion.</span>\\nCoût&nbsp;: <span class="mq-new">≈ 0,1556&nbsp;$US (estimation annoncée par OpenCode)</span>'
          document.querySelectorAll('.turn-summary span').forEach((s) => (s.textContent = 'Terminé en 2 s · ≈ 0,0009 $US'))
          document.activeElement?.blur()
        })()`)
        await legend(
          ui,
          '<b>/cost</b> — même nombre que Mon activité : entrée + sortie.<br>Avant : <s>« Jetons traités : 4 051 903 »</s> (cache compris).<br>Coût : « ≈ » et « estimation ».'
        )
        await ui.hover({ x: 900, y: 760 })
        await sleep(400)
        await ui.shot('maq-f245-1-cost')
        await clearLegend(ui)
      }

      if (wanted('f245-2')) {
        await ui.click(ui.$('usage-meter'))
        await ui.waitFor(`!!${ui.$('usage-details')}`)
        await sleep(300)
        await ui.ev(`(() => {
          const d = document.querySelector('[data-testid=usage-details]')
          const row = (a, b, cls = 'usage-row sub') => '<div class="' + cls + '"><span>' + a + '</span><span>' + b + '</span></div>'
          d.innerHTML = '<div class="menu-label">Consommation · OpenCode</div>'
            + '<div class="usage-section"><div class="usage-row"><span>Contexte</span><strong>87,4k / 1,1M (8 %)</strong></div><div class="usage-bar"><span style="width:8%"></span></div></div>'
            + '<div class="usage-section"><div class="usage-row"><span>Jetons traités (17 échanges)</span><strong class="mq-new">242,4k</strong></div>'
            + row('Entrée', '216,3k') + row('Sortie', '26,1k')
            + row('Dernier échange', '477')
            + '<div class="usage-row sub mq-apart mq-new"><span>Et, hors total : relus en cache</span><span>3,8M</span></div>'
            + '<div class="usage-row sub mq-apart mq-new"><span>Réflexion</span><span>7,8k</span></div></div>'
            + '<div class="usage-section"><div class="usage-row"><span class="mq-new">Coût de la conversation (estimation)</span><strong class="mq-new">≈ 0,1556&nbsp;$US</strong></div>'
            + '<div class="usage-hint mq-hint mq-new">Montant annoncé par OpenCode d’après ses tarifs : ce qui est facturé peut différer (abonnement, remises).</div></div>'
            + '<div class="usage-section"><div class="usage-row" title=""><span>Moyenne par échange</span><span class="mq-new">14,3k · ≈ 0,0092&nbsp;$US</span></div></div>'
            + '<button class="usage-all">Toute mon activité…</button>'
        })()`)
        await ui.hover({ x: 300, y: 300 })
        await sleep(400)
        await ui.shot('maq-f245-2-detail')
        await ui.press('Escape')
        await sleep(300)
      }

      if (wanted('f245-4')) {
        await stage(ui, '[data-testid=thread]', FIL)
        await legend(
          ui,
          '<b>Fil</b> — chaque coût porte « ≈ » : filles, relecture, sous-tâches (le pied du tour l’avait déjà).'
        )
        await ui.hover({ x: 900, y: 760 })
        await sleep(400)
        await ui.shot('maq-f245-4-fil')
        await clearLegend(ui)
        await ui.ev(`document.querySelectorAll('[data-maq]').forEach((n) => n.remove()); document.querySelectorAll('[data-testid=thread]').forEach((n) => (n.style.display = ''))`)
      }

      if (wanted('f245-8')) {
        await stage(ui, '[data-testid=thread]', GROUPE)
        await legend(
          ui,
          '<b>Option D13</b> — l’en-tête du groupe montre tous ses états : la commande qui a vraiment échoué avant l’arrêt, et la modification interrompue par Arrêter.'
        )
        await ui.hover({ x: 900, y: 760 })
        await sleep(400)
        await ui.shot('maq-f245-8-groupe')
        await clearLegend(ui)
        await ui.ev(`document.querySelectorAll('[data-maq]').forEach((n) => n.remove()); document.querySelectorAll('[data-testid=thread]').forEach((n) => (n.style.display = ''))`)
      }

      if (wanted('f245-3')) {
        await ui.viewport(1440, 1240)
        await ui.ev(`[...document.querySelectorAll('.sidebar button, .sidebar a')].find((b) => /Mon activité/.test(b.textContent))?.click()`)
        await ui.waitFor(`!!document.querySelector('[data-testid=usage-kpis]')`)
        await sleep(800)
        await ui.ev(`(() => {
          const kpi = (id) => document.querySelector('[data-testid=usage-kpi-' + id + ']')
          const set = (id, label, value, subs) => {
            const k = kpi(id); if (!k) return
            if (label !== null) k.querySelector('.usage-kpi-label').innerHTML = label
            k.querySelector('.usage-kpi-value').innerHTML = value
            k.querySelectorAll('.usage-kpi-sub').forEach((n) => n.remove())
            for (const s of subs) { const d = document.createElement('div'); d.className = 'usage-kpi-sub'; d.innerHTML = s; k.append(d) }
          }
          set('turns', null, '50', ['dans 9 conversations'])
          set('time', null, '40 min 52 s', ['49 s par échange'])
          set('tokens', null, '635,2k', ['entrée 580,8k · sortie 54,4k', '<span class="mq-new">et 17,1M relus en cache</span>'])
          set('cost', '<span class="mq-new">Coût estimé</span>', '<span class="mq-new">≈ 0,2403&nbsp;$US</span>', ['1 échange sans coût communiqué'])
          document.querySelectorAll('.usage-legend span').forEach((s) => { if (/Agent factice/.test(s.textContent)) s.lastChild.textContent = 'OpenCode' })
          document.querySelectorAll('th').forEach((th) => { if (th.textContent.trim() === 'Coût') th.innerHTML = '<span class="mq-new">Coût estimé</span>' })
          document.querySelectorAll('td, .usage-table-cell').forEach((td) => { if (/\\$US/.test(td.textContent) && !/≈/.test(td.textContent)) td.textContent = '≈ ' + td.textContent.trim() })
          const walk = (root, fn) => { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let x; const all = []; while ((x = w.nextNode())) all.push(x); all.forEach(fn) }
          walk(document.querySelector('.main') ?? document.body, (x) => {
            const v = x.textContent
            if (v.trim() === '1 échange') x.textContent = '50 échanges'
            else if (v.trim() === 'Factice rapide') x.textContent = 'openai/GPT-6 Luna'
            else if (/Agent factice/.test(v)) x.textContent = v.replace('Agent factice', 'OpenCode')
            else if (v.trim() === '2,4k · 250') x.textContent = '580,8k · 54,4k'
            else if (/0,0125/.test(v)) x.textContent = v.replace(/0,0125/, /Par/.test(x.parentElement?.className ?? '') ? '0,0048' : '0,2403')
            else if (v.trim() === 'workspace') x.textContent = 'taches'
            else if (v.trim() === 'Bonjour') x.textContent = 'Nous allons construire un petit gestionnaire de tâches'
          })
        })()`)
        await legend(
          ui,
          '<b>Mon activité</b> — « Jetons traités » inchangé (entrée + sortie), le cache en plus sur sa ligne. Coût : « Coût estimé », « ≈ » partout (tableaux compris).'
        )
        await ui.hover({ x: 200, y: 1000 })
        await sleep(500)
        await ui.shot('maq-f245-3-activite')
        await clearLegend(ui)
      }
    },
    undefined,
    'premier-essai'
  )
}

async function onboardingScreens(scheme) {
  if (!wanted('f245-5') && !wanted('f245-6') && !wanted('f245-7')) return
  const trial = mkdtempSync(join(tmpdir(), 'maq-245-essai-'))
  await withApp(
    scheme,
    async (ui) => {
      await ui.viewport(1440, 900)
      await ui.waitFor(`!!${ui.$('onboarding')}`)
      await css(ui, CSS)
      await ui.click(ui.$('onboarding-continue'))
      await ui.waitFor(`!!${ui.$('onboarding-ready')}`, 30000)
      await ui.click(ui.$('onboarding-continue'))
      await ui.waitFor(`!!${ui.$('onboarding-trial-folder')}`)
      await ui.click(ui.$('onboarding-trial-folder'))
      await ui.waitFor(`!!${ui.$('onboarding-send')}`, 30000)
      const opencode = () =>
        ui.ev(`(() => {
          const set = (s, v) => document.querySelectorAll(s).forEach((n) => (n.textContent = v))
          set('.sidebar-footer .name', 'OpenCode')
          const av = document.querySelector('.sidebar-footer .agent-avatar'); if (av) av.firstChild.textContent = 'O'
          document.querySelectorAll('.onboarding h1, .onboarding .onboarding-title, .onboarding [data-testid=onboarding-title]').forEach((h) => { h.textContent = h.textContent.replace('Agent factice', 'OpenCode') })
          document.querySelectorAll('.onboarding *').forEach((n) => { if (n.childNodes.length === 1 && n.firstChild.nodeType === 3 && n.textContent.includes('Agent factice')) n.textContent = n.textContent.replace('Agent factice', 'OpenCode') })
          document.activeElement?.blur()
        })()`)
      if (wanted('f245-5')) {
        await opencode()
        await ui.ev(`(() => {
          const help = document.querySelector('.onboarding-card .onboarding-prompt')?.parentElement
          if (!help) throw new Error('aide de l’essai absente')
          const old = [...help.childNodes].filter((n) => n.nodeType === 3 && /Modèle/.test(n.textContent))
          old.forEach((n) => n.remove())
          const s = document.createElement('span'); s.className = 'mq-new'; s.textContent = 'Modèle : openai/GPT-6.2 Astra, celui de vos conversations'
          if (!help.querySelector('br + br')) help.append(document.createElement('br'))
          help.append(s)
        })()`)
        await legend(
          ui,
          '<b>Essai (D16)</b> — le modèle annoncé est celui de la conversation (sa puce), et l’essai l’applique avant d’envoyer le message.'
        )
        await ui.hover({ x: 1100, y: 700 })
        await sleep(400)
        await ui.shot('maq-f245-5-essai')
        await clearLegend(ui)
      }
      await ui.click(ui.$('onboarding-send'))
      await ui.waitFor(`!!${ui.$('onboarding-replied')}`, 30000)
      await opencode()
      const replied = (facts, extra = '') =>
        ui.ev(`(() => {
          const r = document.querySelector('[data-testid=onboarding-replied]')
          const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT); let x; while ((x = w.nextNode())) { if (/a répondu en/.test(x.textContent)) x.textContent = 'OpenCode a répondu en 2,6 s' }
          r.querySelector('.onboarding-reply').textContent = 'OK'
          let f = r.querySelector('.onboarding-facts'); if (!f) { f = document.createElement('div'); f.className = 'onboarding-facts'; r.querySelector('.onboarding-reply').after(f) }
          f.innerHTML = ${JSON.stringify(facts)}
          r.querySelectorAll('[data-mq-extra]').forEach((n) => n.remove())
          if (${JSON.stringify(extra)}) { const p = document.createElement('p'); p.className = 'onboarding-text small'; p.setAttribute('data-mq-extra', ''); p.innerHTML = ${JSON.stringify(extra)}; f.after(p) }
          document.activeElement?.blur()
        })()`)
      if (wanted('f245-6')) {
        await replied(
          'Coût <span class="mq-new">≈ 0,0003&nbsp;$US</span> · 1 901 jetons envoyés · 3 reçus · <span class="mq-new">Modèle : openai/GPT-6.2 Astra</span>'
        )
        await legend(ui, '<b>Essai répondu</b> — même modèle qu’annoncé et que la puce ; coût en « ≈ ».')
        await ui.hover({ x: 1100, y: 700 })
        await sleep(400)
        await ui.shot('maq-f245-6-essai-repondu')
        await clearLegend(ui)
      }
      if (wanted('f245-7')) {
        await replied(
          'Coût ≈ 0,00&nbsp;$US · 1 901 jetons envoyés · 3 reçus',
          '<span class="mq-warn mq-new">Répondu avec opencode/Hy4 flash Free, pas openai/GPT-6.2 Astra (celui de vos conversations) : OpenCode ne le propose pas dans cette session.</span>'
        )
        await legend(
          ui,
          '<b>Cas rare</b> — l’agent refuse ou ne propose pas le modèle de la conversation : le message part quand même, et l’écart est dit.'
        )
        await ui.hover({ x: 1100, y: 700 })
        await sleep(400)
        await ui.shot('maq-f245-7-essai-autre-modele')
        await clearLegend(ui)
      }
    },
    undefined,
    'premier-essai',
    {
      BOBINE_DEFAULT_WORKSPACE: '',
      BOBINE_ONBOARDING: '1',
      BOBINE_TRIAL_DIR: trial,
      ...NEUTRAL_AGENT_ENV
    }
  )
}

for (const scheme of schemes) {
  await conversationScreens(scheme)
  await onboardingScreens(scheme)
}
