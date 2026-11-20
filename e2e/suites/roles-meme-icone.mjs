import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, LANG, check, withApp } from '../lib.mjs'

/**
 * Rôles de même icône et collisions d'identifiant (fiche 268), contre l'agent factice, dans un
 * profil jetable (rien du vrai profil ni des fichiers de Bob ou d'OpenCode n'est lu ou écrit).
 *
 * Défaut remonté : « le second rôle de même icône écrase le premier ». Deux rôles personnels de
 * même icône et même couleur, noms différents, créés par « + » de la section Équipe : deux
 * fichiers, deux tuiles, deux lignes dans Réglages › Rôles. Puis un rôle dont l'identifiant est
 * celui d'un rôle fourni (« Code reviewer » → `code-reviewer`) : refusé dès l'étape 1, avec un
 * identifiant libre proposé ; le rôle fourni reste à sa place.
 */
export async function rolesMemeIconeSuite(scheme) {
  console.log(`\n— Rôles : même icône, identifiant pris (${scheme})`)
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-roles-icone-'))
  writeFileSync(join(workspace, 'README.md'), '# Boutique\n')
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-roles-icone-data-'))
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({ language: LANG }))
  const userRoles = join(userData, 'roles')
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        // Saisie comme au clavier pour React : valeur posée puis évènement `input`.
        const fill = (testId, value) =>
          ui.ev(`(() => {
            const el = ${ui.$(testId)}
            el.focus()
            const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement
            Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, ${JSON.stringify(value)})
            el.dispatchEvent(new Event('input', { bubbles: true }))
          })()`)
        const step = `${ui.$('role-wizard')}?.dataset.step`
        const team = `[...document.querySelectorAll('[data-testid=team-role]')].map((b) => b.dataset.role)`
        const tile = (name) =>
          `document.querySelector('[data-testid=team-role][data-role="${name}"] [data-icon]')`

        /** Étape 1 remplie : nom, description, icône bouclier et couleur orange choisies. */
        const who = async (label, description) => {
          await ui.click(ui.$('team-new'))
          await ui.waitFor(`${step} === 'who'`)
          await fill('role-label', label)
          await fill('role-description', description)
          await ui.click(ui.$('role-icon-shield-check'))
          await ui.click(ui.$('role-color-orange'))
        }
        /** Étapes 2 et 3, puis « Créer ». */
        const finish = async (prompt) => {
          await ui.click(ui.$('role-wizard-next'))
          await ui.waitFor(`${step} === 'how'`)
          await fill('role-prompt', prompt)
          await ui.click(ui.$('role-wizard-next'))
          await ui.waitFor(`${step} === 'with'`)
          await ui.click(ui.$('role-wizard-create'))
          await ui.waitFor(`!${ui.$('role-wizard')}`)
        }

        await who('Expert web', 'Audite la sécurité du site web.')
        await finish('Tu audites la sécurité du site web.')
        await who('Expert mobile', 'Audite la sécurité de l’app mobile.')
        await finish('Tu audites la sécurité de l’app mobile.')
        await ui.waitFor(`${team}.includes('expert-web') && ${team}.includes('expert-mobile')`)
        const web = join(userRoles, 'expert-web.md')
        const mobile = join(userRoles, 'expert-mobile.md')
        check(
          readFileSync(web, 'utf8').includes('site web') &&
            readFileSync(mobile, 'utf8').includes('app mobile') &&
            (await ui.ev(`${tile('expert-web')}.dataset.icon`)) === 'shield-check' &&
            (await ui.ev(`${tile('expert-mobile')}.dataset.icon`)) === 'shield-check',
          'deux rôles de même icône et même couleur : deux fichiers, deux tuiles dans l’Équipe'
        )

        // Réglages › Rôles : les deux, côte à côte, chacun avec sa description.
        await ui.click(ui.$('open-settings'))
        await ui.waitFor(`!!${ui.$('settings')}`)
        await ui.click(ui.$('settings-roles'))
        await ui.waitFor(`!!${ui.$('roles-group-user')}`)
        const rows = `[...${ui.$('roles-group-user')}.querySelectorAll('[data-testid=role-row]')].map((r) => r.dataset.role)`
        check(
          JSON.stringify(await ui.ev(rows)) === JSON.stringify(['expert-mobile', 'expert-web']),
          'Réglages › Rôles : les deux rôles personnels listés'
        )
        await ui.shot('268-deux-roles-meme-icone')
        await ui.press('Escape')
        await ui.waitFor(`!${ui.$('settings')}`)

        // Identifiant d'un rôle fourni : refusé à l'étape 1, identifiant libre proposé.
        await who('Code reviewer', 'Relit le diff selon nos règles.')
        await ui.waitFor(`${ui.$('role-name')}.value === 'code-reviewer'`)
        await ui.click(ui.$('role-wizard-next'))
        await ui.waitFor(`!!${ui.$('role-name-suggestion')}`)
        check(
          (await ui.ev(step)) === 'who' &&
            (await ui.ev(`${ui.$('role-field-error')}.textContent`)) ===
              L('roles.error.nameTaken', {
                name: 'code-reviewer',
                label: L('roles.builtin.codeReviewer'),
                scope: L('rolesSettings.scope.builtin')
              }),
          'identifiant d’un rôle fourni : refusé dès l’étape 1, le rôle qui le porte est nommé'
        )
        await ui.shot('268-identifiant-pris')
        await ui.click(ui.$('role-name-suggestion'))
        await ui.waitFor(`${ui.$('role-name')}.value === 'code-reviewer-2'`)
        await finish('Tu relis le diff selon nos règles.')
        await ui.waitFor(`${team}.includes('code-reviewer-2')`)
        check(
          existsSync(join(userRoles, 'code-reviewer-2.md')) &&
            !existsSync(join(userRoles, 'code-reviewer.md')) &&
            (await ui.ev(`${team}.includes('code-reviewer')`)) &&
            readFileSync(web, 'utf8').includes('site web') &&
            readFileSync(mobile, 'utf8').includes('app mobile'),
          '« Utiliser @code-reviewer-2 » : rôle créé à côté du fourni, rien de remplacé ni d’écrasé'
        )
      },
      userData,
      'streaming-texte',
      { BOBINE_WORKSPACE: workspace, BOBINE_LANG: '' }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(userData, { recursive: true, force: true })
  }
}
