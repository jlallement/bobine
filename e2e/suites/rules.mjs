import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { L, check, withApp } from '../lib.mjs'

const write = (path, text) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}

/** Règles actives (fiche 056) : listées dans « Réglages de la session », ouvertes en aperçu. */
export async function rulesSuite(scheme) {
  console.log(`\n— Règles actives (${scheme})`)
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-'))
  const home = mkdtempSync(join(tmpdir(), 'bob-e2e-maison-'))
  const workspace = join(userData, 'workspace')
  // L'agent factice lit ses règles comme Bob, dans le mode « code ».
  write(join(workspace, 'AGENTS.md'), '# Consignes du projet\n\nRéponds en français.\n')
  write(join(workspace, '.bob', 'rules', 'tests.md'), '# Tests\n\nToujours un test.\n')
  write(join(home, '.bob', 'rules-code', 'style.md'), '# Mon style\n\nDes réponses **courtes**.\n')
  write(join(home, '.bob', 'rules-plan', 'plan.md'), 'Seulement en mode plan.\n')
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        const items = `[...document.querySelectorAll('[data-testid=rule-item]')]`
        // Côtés pris par le menu, image par image : il s'ouvre à sa taille, sans sauter de l'autre
        // côté de la zone de saisie quand ses règles arrivent (le relâché du clic choisissait
        // alors la ligne passée sous le pointeur).
        await ui.ev(`(() => {
          window.__sides = []
          const t0 = performance.now()
          const step = () => {
            const side = document.querySelector('[data-testid=session-settings-content]')?.dataset.side
            if (side && window.__sides.at(-1) !== side) window.__sides.push(side)
            if (performance.now() - t0 < 1500) requestAnimationFrame(step)
          }
          requestAnimationFrame(step)
          return true
        })()`)
        await ui.click(ui.$('session-settings'))
        await ui.waitFor(`${items}.length === 3`)
        await new Promise((r) => setTimeout(r, 300))
        const sides = await ui.ev('window.__sides')
        check(sides.length === 1, `menu ouvert d’emblée à sa place (côtés : ${sides.join(' → ')})`)
        const listed = await ui.ev(`${items}.map((i) => i.innerText.replace(/\\s+/g, ' '))`)
        check(
          listed[0].startsWith('AGENTS.md') &&
            listed.some(
              (l) => l.includes('.bob/rules/tests.md') && l.includes(L('rules.scope.project'))
            ) &&
            listed.some(
              (l) =>
                l.includes('~/.bob/rules-code/style.md') &&
                l.includes(
                  L('rules.scopeWithMode', { scope: L('rules.scope.personal'), mode: 'code' })
                )
            ) &&
            !listed.some((l) => l.includes('rules-plan')),
          `réglages de la session : règles du projet, personnelles et du mode actif (${listed.join(' | ')})`
        )
        await ui.shot('i0-regles-actives')
        await ui.click(`${items}.find((i) => i.innerText.includes('style.md'))`)
        await ui.waitFor(
          `${ui.$('document-name')}?.innerText === 'style.md' && ${ui.$('document-body')}.innerText.includes('Des réponses courtes')`
        )
        check(true, 'règle personnelle (hors du dossier) ouverte en aperçu')
        await ui.shot('i1-regle-apercu')
      },
      userData,
      'streaming-texte',
      { BOBINE_CONFIG_HOME: home }
    )
  } finally {
    rmSync(userData, { recursive: true, force: true })
    rmSync(home, { recursive: true, force: true })
  }
}
