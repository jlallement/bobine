// Maquettes sur l'app buildée : DOM injecté, aucun code produit (voir README.md).
// Usage : pnpm build && node e2e/maquettes/run.mjs [light|dark] [début d'identifiant…]
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sleep, withApp } from '../lib.mjs'
import { missingIcons, resolveIcons } from './icons.mjs'
import { SCREENS } from './screens.mjs'
import { AGENT_ACP_SCREENS } from './screens-agent-acp.mjs'
import { ACTIVITY_SCREENS, DASHBOARD_SCREENS } from './screens-tableau-de-bord.mjs'
import { ANNOTATE_SCREENS } from './screens-annoter.mjs'
import { RESET_SCREENS } from './screens-reinitialiser.mjs'
import { MAQ_CSS, SITE_CSS } from './styles.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const schemes =
  process.argv[2] && !process.argv[2].includes('-') ? [process.argv[2]] : ['light', 'dark']
const only = process.argv.slice(3)
const spool = readFileSync(join(here, 'spool.svg'), 'utf8').trim()

const CODE_TOKENS = `
:root { --mq-code-bg:#f6f5f0; --mq-code-fg:#2b2a26; --mq-syn-k:#a0397a; --mq-syn-s:#2f7a4a; --mq-syn-f:#2f5fb3; --mq-syn-c:#6f6c64; --mq-ansi-green:#2f7a4a; --mq-ansi-blue:#2f5fb3; }
@media (prefers-color-scheme: dark) { :root { --mq-code-bg:#1f1e1d; --mq-code-fg:#f0eee6; --mq-syn-k:#e08ac0; --mq-syn-s:#8fd19e; --mq-syn-f:#8fb4f0; --mq-syn-c:#a19e95; --mq-ansi-green:#8fd19e; --mq-ansi-blue:#8fb4f0; } }`

const AGENTS = {
  OpenCode: { letter: 'O', model: 'GPT-6.1 Sol', mode: 'Build' },
  'IBM Bob': { letter: 'B', model: '', mode: 'Agent' }
}

for (const scheme of schemes) {
  const base = mkdtempSync(join(tmpdir(), 'maq-'))
  const workspace = join(base, 'carnet-de-lecture')
  mkdirSync(workspace)
  const git = (...a) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e@x.invalid', ...a], {
      cwd: workspace
    })
  writeFileSync(join(workspace, 'README.md'), '# Carnet\n')
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')

  await withApp(
    scheme,
    async (ui) => {
      await ui.ready()
      await ui.viewport(1440, 900)
      await ui.send('Ajoute le filtre par statut dans la barre d’outils (point 4 du README).')
      await sleep(1500)
      const ev = ui.ev
      const css = (id, text) =>
        ev(
          `(() => { let s = document.getElementById('${id}'); if (!s) { s = document.createElement('style'); s.id = '${id}'; document.head.append(s) } s.textContent = ${JSON.stringify(text)} })()`
        )
      await css('maq-css', MAQ_CSS + SITE_CSS + CODE_TOKENS)
      const stage = async (sel, html, mode = 'replace') => {
        const markup = await resolveIcons(html)
        return ev(`(() => {
        const el = document.querySelector(${JSON.stringify(sel)})
        if (!el) throw new Error('absent : ' + ${JSON.stringify(sel)})
        const t = document.createElement('template'); t.innerHTML = ${JSON.stringify(markup)}
        const n = t.content.firstElementChild; n.setAttribute('data-maq', '')
        const mode = ${JSON.stringify(mode)}
        if (mode === 'replace') { el.setAttribute('data-maq-hidden', el.style.display || ''); el.style.display = 'none'; el.after(n) }
        else if (mode === 'append') el.append(n)
        else el.prepend(n)
        return true })()`)
      }
      const reset = async () => {
        for (let k = 0; k < 3; k++) {
          await ui.key('Escape')
          await sleep(120)
        }
        if (await ev(`!!document.querySelector('[data-testid=side-panel]')`)) {
          await ev(`${ui.$('panel-toggle')}.click()`)
          await sleep(300)
        }
        await ev(`(() => { const i = document.querySelector('[data-testid=composer-input]'); if (i) i.value = '';
        for (const t of ['send', 'stop']) { const b = document.querySelector('[data-testid=' + t + ']'); if (b) b.style.display = '' } })()`)
        await ev(`document.querySelectorAll('[data-maq]').forEach((n) => n.remove());
        document.querySelectorAll('[data-maq-hidden]').forEach((n) => { n.style.display = n.getAttribute('data-maq-hidden'); n.removeAttribute('data-maq-hidden') });
        document.getElementById('maq-css2')?.remove()`)
        await sleep(250)
      }
      const dress = (name) => {
        const a = AGENTS[name]
        return ev(`(() => {
        const set = (s, v) => document.querySelectorAll(s).forEach((n) => (n.textContent = v))
        set('.sidebar-footer .name', ${JSON.stringify(name)})
        set('.sidebar-footer [data-testid=agent-status]', 'Prêt')
        const av = document.querySelector('.sidebar-footer .agent-avatar'); if (av) av.firstChild.textContent = ${JSON.stringify(a.letter)}
        set('[data-testid=agent-menu] .chip-label', ${JSON.stringify(name)})
        const m = document.querySelector('[data-testid=model-chip]'); if (m) { m.style.display = ${JSON.stringify(a.model ? '' : 'none')}; m.querySelector('.chip-label').textContent = ${JSON.stringify(a.model)} }
        set('[data-testid=mode-chip] .chip-label', ${JSON.stringify(a.mode)})
        set('[data-testid=workspace-menu] .chip-label', 'carnet-de-lecture')
        const inp = document.querySelector('[data-testid=composer-input]'); if (inp) inp.placeholder = 'Répondre à ' + ${JSON.stringify(name)} + '…'
      })()`)
      }
      const h = {
        spool,
        stage,
        css: (t) => css('maq-css2', t),
        sidebar: async (opts) => {
          const { sidebar } = await import('./parts.mjs')
          return stage('.sidebar-body', sidebar(opts))
        },
        title: (t) =>
          ev(`document.querySelector('.main-title-text').textContent = ${JSON.stringify(t)}`),
        busy: async () => {
          await ev(`(() => { const b = document.querySelector('[data-testid=composer-input]'); if (b) b.placeholder = 'Ajouter une suite (envoyée à la fin de la réponse)…'
          const st = document.querySelector('.sidebar-footer [data-testid=agent-status]'); if (st) st.textContent = 'Répond…' })()`)
          return stage(
            '[data-testid=send]',
            '<button type="button" class="send-button stop"><svg width="12" height="12" viewBox="0 0 12 12"><rect width="12" height="12" rx="2.5" fill="currentColor"/></svg></button>'
          )
        },
        bgSettings: async (nav, main) => {
          await h.sidebar()
          await stage(
            '[data-testid=thread]',
            '<div class="thread"><div class="msg-user-group"><div class="msg-user">Trois chantiers indépendants du README : 4, 5 et 6. Confie-les à des conversations filles.</div></div><div class="msg-agent-group"><div class="msg-agent"><div class="markdown"><p>Je lance trois chantiers en parallèle, chacun dans son worktree.</p></div></div></div></div>'
          )
          await h.title('Trois chantiers indépendants du README')
          return h.settings(nav, main)
        },
        openPanel: async (html) => {
          if (!(await ev(`!!document.querySelector('[data-testid=side-panel]')`))) {
            await ui.click(ui.$('panel-toggle'))
            await ui.waitFor(`!!document.querySelector('[data-testid=side-panel]')`)
            await sleep(300)
          }
          return stage('[data-testid=side-panel]', html)
        },
        settings: async (nav, main) => {
          if (!(await ev(`!!document.querySelector('[data-testid=settings]')`))) {
            await ui.click(ui.$('open-settings'))
            await ui.waitFor(`!!document.querySelector('[data-testid=settings]')`)
            await sleep(400)
          }
          await stage('.settings-nav', nav)
          await stage('.settings-main', main)
          await ev(`document.activeElement?.blur()`)
        },
        composer: async (text, menu) => {
          await ev(
            `(() => { const i = document.querySelector('[data-testid=composer-input]'); i.value = ${JSON.stringify(text)} })()`
          )
          return stage('form.composer', menu, 'append')
        },
        sessionMenu: async (extra) => {
          await ui.click(ui.$('session-settings'))
          await ui.waitFor(`!!document.querySelector('[data-testid=session-settings-content]')`)
          await sleep(300)
          await ev(`(() => { const m = document.querySelector('[data-testid=session-settings-content]')
          m.querySelector('.menu-label').textContent = 'Réglages · OpenCode'
          m.querySelector('[data-testid=control-mode] .menu-value').textContent = 'Build'
          m.querySelector('[data-testid=control-model] .menu-value').textContent = 'GPT-6.1 Sol'
          m.querySelector('[data-testid=control-verbose]').style.display = 'none'
          const r = m.querySelector('[data-testid=rules-none]'); r.querySelector('.menu-title').textContent = 'AGENTS.md'; r.querySelector('.menu-desc').textContent = 'Ce dossier · 18 lignes' })()`)
          await stage('[data-testid=session-settings-content]', extra, 'append')
          await sleep(400)
        },
        overlay: async (html) => {
          await ev(`${ui.$('open-search')}.click()`)
          await ui.waitFor(`!!document.querySelector('[data-testid=search]')`)
          await sleep(300)
          return stage('[data-testid=search]', html)
        }
      }
      h.ui = ui
      for (const screen of [
        ...SCREENS,
        ...AGENT_ACP_SCREENS,
        ...DASHBOARD_SCREENS,
        ...ACTIVITY_SCREENS,
        ...RESET_SCREENS,
        ...ANNOTATE_SCREENS
      ]) {
        if (only.length && !only.some((o) => screen.id.startsWith(o))) continue
        await reset()
        if (screen.tall) {
          await ui.viewport(1440, 1240)
          await css('maq-css2', '.settings-dialog { height: calc(100vh - 48px) !important; }')
        }
        await dress(screen.agent)
        h.after = ''
        await screen.prepare(h, scheme)
        if (h.after) await ev(h.after)
        await ui.hover({ x: 1100, y: 640 })
        if (!screen.id.startsWith('skills-2')) await ev(`document.activeElement?.blur()`)
        await sleep(500)
        await ui.shot(`maq-${screen.id}`)
        console.log(`${scheme} ✓ ${screen.id}`)
        if (screen.tall) await ui.viewport(1440, 900)
      }
      await reset()
    },
    undefined,
    'echo',
    { BOBINE_WORKSPACE: workspace, MOCK_AGENT_TITLES: 'prompt' }
  )
}
if (missingIcons().length) console.log('Icônes absentes :', missingIcons().join(', '))
