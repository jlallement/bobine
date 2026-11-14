import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BUILTIN_EN } from '../../src/main/roles/builtin-en.ts'
import { BUILTIN_FR } from '../../src/main/roles/builtin-fr.ts'
import { L, LANG, check, withApp } from '../lib.mjs'
import { conversationTooltip } from '../sidebar-tooltip.mjs'

/**
 * Rôle fourni dans la langue des essais (ADR-0046), tel que l'app le montre : insécables du
 * français posées comme `main/roles/builtin.ts` le fait.
 */
function builtin(name) {
  const texts = (LANG === 'en' ? BUILTIN_EN : BUILTIN_FR)[name]
  const shown = (text) =>
    LANG === 'en' ? text : text.replace(/ ([:;?!%»])/g, '\u00a0$1').replace(/« /g, '«\u00a0')
  return { description: shown(texts.description), prompt: shown(texts.prompt.join('\n')) }
}

/** Rôle de projet qui remplace le « Code reviewer » fourni (même nom), partagé par git. */
const PROJECT_REVIEWER = `---
name: code-reviewer
label: Relecteur maison
icon: scan-search
color: violet
description: Relit chaque diff selon les règles de la maison.
read-only: true
---

Tu relis le diff selon nos règles.
`

/** Fichier de rôle écarté : une faute de frappe sur « read-only » (ADR-0045). */
const BROKEN = `---
name: faute
description: Champ mal écrit.
read-onyl: true
---

Consigne.
`

/**
 * Rôles, interface de gestion (fiche 223, phase 3A) : section « Équipe » de la barre latérale,
 * assistant de création en trois étapes (Qui, Comment, Avec quoi) jusqu'au fichier
 * `.bobine/roles/<nom>.md` du projet, « Créer et essayer » qui pose le jeton du rôle dans la saisie
 * (puis fille en lecture seule, avatar du rôle sous sa mère), clic sur un rôle de la section
 * Équipe (même jeton), « Enregistrer comme rôle » sur une fille sans rôle (assistant prérempli),
 * Réglages › Rôles (rôle de projet qui remplace un rôle fourni, fichier écarté avec sa raison),
 * modifier, désactiver, supprimer, état vide. Agent factice, dépôt git jetable ; rien d'autre
 * n'est touché.
 */
export async function rolesGestionSuite(scheme) {
  console.log(`\n— Rôles : gestion (${scheme})`)
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-roles-'))
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=e2e', '-c', 'user.email=e2e@example.invalid', ...args], {
      cwd: workspace
    })
  const rolesDir = join(workspace, '.bobine', 'roles')
  mkdirSync(rolesDir, { recursive: true })
  writeFileSync(join(workspace, 'README.md'), '# Boutique\n')
  writeFileSync(join(rolesDir, 'code-reviewer.md'), PROJECT_REVIEWER)
  writeFileSync(join(rolesDir, 'faute.md'), BROKEN)
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'init')
  const created = join(rolesDir, 'expert-perf.md')
  // Langue tenue par le réglage, pas par `BOBINE_LANG` (vidé) : la fin de la suite la change dans
  // Réglages › Général (ADR-0046). Départ dans la langue des essais.
  const userData = mkdtempSync(join(tmpdir(), 'bob-e2e-roles-data-'))
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({ language: LANG }))
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        // Une fille se rattache à une conversation de l'historique : un premier échange d'abord.
        await ui.send('Bonjour')
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
        const team = `[...document.querySelectorAll('[data-testid=team-role]')].map((b) => b.dataset.role)`
        const step = `${ui.$('role-wizard')}?.dataset.step`

        // Section Équipe : les rôles actifs du projet, le rôle du projet compris.
        await ui.waitFor(`${team}.includes('code-reviewer')`)
        check(
          (await ui.ev(`${team}.length`)) === 7 &&
            (await ui.ev(`${ui.$('team-section')}.querySelector('.section-label').textContent`)) ===
              L('team.title'),
          'barre latérale : section Équipe, sept rôles actifs (le relecteur du projet remplace le fourni)'
        )
        await ui.shot('r1-equipe')
        // Chaque tuile se nomme : nom pour les lecteurs d'écran, infobulle nom et description
        // (traduite pour un rôle fourni).
        const tile = `document.querySelector('[data-testid=team-role][data-role=security-expert]')`
        check(
          (await ui.ev(`${tile}.getAttribute('aria-label')`)) ===
            L('team.assign', { label: L('roles.builtin.securityExpert') }),
          'section Équipe : chaque tuile a un nom accessible'
        )
        const tip = await conversationTooltip(ui, tile, {
          hover: true,
          capture: 'r1b-equipe-infobulle'
        })
        check(
          tip.includes(L('roles.builtin.securityExpert')) &&
            tip.includes(builtin('security-expert').description),
          'section Équipe : infobulle au survol, nom et description traduite du rôle fourni'
        )

        // Assistant, étape 1 : Qui. « Suivant » à vide montre les erreurs.
        await ui.click(ui.$('team-new'))
        await ui.waitFor(`${step} === 'who'`)
        await ui.click(ui.$('role-wizard-next'))
        await ui.waitFor(`document.querySelectorAll('[data-testid=role-field-error]').length === 3`)
        check(true, 'étape 1 vide : nom, identifiant et description signalés, on reste à l’étape')
        await fill('role-label', 'Expert perf')
        await fill(
          'role-description',
          'Mesure et explique les lenteurs avant de changer quoi que ce soit.'
        )
        await ui.waitFor(`${ui.$('role-name')}.value === 'expert-perf'`)
        check(
          (await ui.ev(`${ui.$('role-icon-gauge')}.getAttribute('aria-checked')`)) === 'true' &&
            (await ui.ev(`${ui.$('role-preview')}.innerText`)).includes('Expert perf'),
          'identifiant tiré du nom, icône suggérée (jauge), aperçu en direct'
        )
        await ui.shot('r2-assistant-qui')

        // Étape 2 : Comment. Une tuile remplit la consigne.
        await ui.click(ui.$('role-wizard-next'))
        await ui.waitFor(`${step} === 'how'`)
        await ui.click(ui.$('role-template-security-expert'))
        await ui.waitFor(`${ui.$('role-prompt')}.value.length > 50`)
        await fill(
          'role-prompt',
          'Tu es un expert en performances. Mesure avant de proposer, et ne modifie rien.'
        )
        await ui.shot('r3-assistant-comment')

        // Étape 3 : Avec quoi. Lecture seule (reprise du modèle), portée « Ce projet ».
        await ui.click(ui.$('role-wizard-next'))
        await ui.waitFor(`${step} === 'with'`)
        check(
          await ui.ev(`${ui.$('role-read-only')}.checked`),
          'lecture seule reprise du modèle choisi (expert sécu)'
        )
        await ui.click(ui.$('role-scope-project'))
        await ui.waitFor(
          `${ui.$('role-preview-file')}?.innerText.includes('.bobine/roles/expert-perf.md')`
        )
        await ui.shot('r4-assistant-avec-quoi')

        // Créer et essayer : le fichier est écrit, le jeton du rôle est posé dans la saisie.
        const input = `document.querySelector('[data-testid="composer-input"]')`
        const token = (name) =>
          `document.querySelector('[data-testid=role-token][data-role="${name}"]')`
        await ui.click(ui.$('role-wizard-create-try'))
        await ui.waitFor(`!${ui.$('role-wizard')}`)
        await ui.waitFor(`!!${token('expert-perf')}`)
        const file = readFileSync(created, 'utf8')
        check(
          file.includes('name: expert-perf') &&
            file.includes('icon: gauge') &&
            file.includes('read-only: true') &&
            file.includes('Tu es un expert en performances.'),
          'fichier .bobine/roles/expert-perf.md écrit dans le projet (en-tête et consigne)'
        )
        await ui.ev(`${input}.focus()`)
        await ui.type('Pourquoi la page d’accueil est-elle lente ?')
        await ui.shot('r5-essayer-jeton')
        await ui.enter()
        // La fille apparaît sous sa mère, avec l'avatar du rôle.
        const child = `document.querySelector('[data-testid=history-item][data-mother] [data-testid=history-role]')`
        await ui.waitFor(`${child}?.dataset.icon === 'gauge'`, 30_000)
        // La saisie se vide quand le main a rendu les filles lancées (après la liste).
        await ui.waitFor(`${input}.value === '' && !${token('expert-perf')}`)
        check(
          true,
          'fille lancée avec le rôle depuis le jeton : son avatar dans la barre latérale, saisie vidée'
        )
        await ui.waitFor(`${team}.includes('expert-perf')`)
        await ui.shot('r6-fille-avec-role')

        // Section Équipe : un clic pose le même jeton (un seul chemin pour invoquer un rôle).
        await ui.click(
          `document.querySelector('[data-testid=team-role][data-role=security-expert]')`
        )
        await ui.waitFor(`!!${token('security-expert')}`)
        await ui.waitFor(`document.activeElement === ${input}`)
        check(
          (await ui.ev(`${ui.$('role-destination')}.innerText`)).includes(
            L('roles.builtin.securityExpert')
          ),
          'section Équipe : jeton du rôle dans la saisie, qui a le focus ; « Partira à… » le nomme'
        )
        await ui.shot('r5b-equipe-jeton')
        await ui.ev(`${input}.setSelectionRange(0, 0)`)
        await ui.press('Backspace')
        await ui.waitFor(`!${token('security-expert')}`)

        // Une fille sans rôle qui a rendu son compte rendu : « Enregistrer comme rôle… ».
        await ui.click(ui.$('title-menu'))
        await ui.waitFor(
          `${ui.$('title-launch-child')} && !${ui.$('title-launch-child')}.hasAttribute('data-disabled')`
        )
        await ui.click(ui.$('title-launch-child'))
        await ui.waitFor(`!!${ui.$('child-dialog')}`)
        await ui.ev(`${ui.$('child-prompt')}.focus()`)
        await ui.type('Relis le diff de l’authentification. Ne modifie rien.')
        await ui.click(ui.$('child-launch'))
        await ui.waitFor(`!${ui.$('child-dialog')}`, 30_000)
        const save = `document.querySelector('[data-testid=child-report]:not([data-role]) [data-testid=child-report-save-role]')`
        await ui.waitFor(`!!${save}`, 30_000)
        check(
          !(await ui.ev(
            `!!document.querySelector('[data-testid=child-report][data-role] [data-testid=child-report-save-role]')`
          )),
          'compte rendu : « Enregistrer comme rôle » seulement pour la fille sans rôle'
        )
        await ui.ev(`${save}.scrollIntoView({ block: 'center' })`)
        await ui.shot('r11-enregistrer-comme-role')
        await ui.click(save)
        await ui.waitFor(`${step} === 'who'`)
        await fill('role-label', 'Relecteur auth')
        await fill('role-description', 'Relit un diff qui touche à l’authentification.')
        await ui.click(ui.$('role-wizard-next'))
        await ui.waitFor(`${step} === 'how'`)
        check(
          (await ui.ev(`${ui.$('role-prompt')}.value`)) ===
            'Relis le diff de l’authentification. Ne modifie rien.',
          'assistant prérempli : la demande faite à la fille devient la consigne'
        )
        await ui.shot('r12-assistant-prerempli')
        await ui.click(ui.$('role-wizard-next'))
        await ui.waitFor(`${step} === 'with'`)
        check(
          (await ui.ev(`${ui.$('role-agent')}.value`)) === 'mock',
          'assistant prérempli : l’agent de la fille'
        )
        await ui.click(ui.$('role-wizard-cancel'))
        await ui.waitFor(`!!${ui.$('role-wizard-discard')}`)
        await ui.click(ui.$('role-wizard-discard'))
        await ui.waitFor(`!${ui.$('role-wizard')}`)

        // Réglages › Rôles : trois groupes, rôle du projet qui remplace le fourni, fichier écarté.
        await ui.click(ui.$('open-settings'))
        await ui.waitFor(`!!${ui.$('settings')}`)
        await ui.click(ui.$('settings-roles'))
        await ui.waitFor(`!!${ui.$('roles-group-project')}`)
        const row = (name) => `document.querySelector('[data-testid=role-row][data-role=${name}]')`
        check(
          (await ui.ev(`${row('code-reviewer')}.dataset.scope`)) === 'project' &&
            (await ui.ev(
              `${row('code-reviewer')}.querySelector('[data-testid=role-hides]').innerText`
            )) === L('rolesSettings.hides', { scopes: L('rolesSettings.scope.builtin') }) &&
            (await ui.ev(`${row('expert-perf')}.dataset.scope`)) === 'project',
          'Réglages › Rôles : le relecteur du projet dit qu’il remplace le rôle fourni'
        )
        check(
          (await ui.ev(`${row('tech-lead')}.querySelector('.role-row-desc').textContent`)) ===
            builtin('tech-lead').description,
          'rôle fourni : description affichée dans la langue de l’interface'
        )
        check(
          (await ui.ev(`${ui.$('role-problem')}.innerText`)).startsWith('.bobine/roles/faute.md') &&
            (await ui.ev(`${ui.$('role-problem')}.querySelector('[title]').title`)).endsWith(
              '/.bobine/roles/faute.md'
            ) &&
            (await ui.ev(`${ui.$('role-problem')}.innerText`)).includes('read-onyl'),
          'fichier écarté : chemin relatif au projet (complet en infobulle) et raison'
        )
        await ui.shot('r7-reglages-roles')

        // Modifier : un seul écran ; enregistrer réécrit le fichier.
        await ui.click(`${row('expert-perf')}.querySelector('[data-testid=role-row-open]')`)
        await ui.waitFor(`${ui.$('role-edit')}?.dataset.role === 'expert-perf'`)
        check(!!(await ui.ev(`!!${ui.$('role-edit-git')}`)), 'rôle du projet : « Partagé par git »')
        await fill(
          'role-description',
          'Mesure les lenteurs et propose le correctif le plus simple.'
        )
        await ui.click(ui.$('role-edit-save'))
        await ui.waitFor(`!!${ui.$('role-edit-saved')}`)
        check(
          readFileSync(created, 'utf8').includes('propose le correctif le plus simple'),
          'modifier : description réécrite dans le fichier'
        )
        await ui.shot('r8-edition')

        // Désactiver : la ligne pâlit, le rôle quitte la section Équipe.
        await ui.click(ui.$('role-edit-back'))
        await ui.waitFor(`!!${row('expert-perf')}`)
        await ui.click(`${row('expert-perf')}.querySelector('[data-testid=role-row-enabled]')`)
        await ui.waitFor(`${row('expert-perf')}.dataset.enabled === 'false'`)
        await ui.waitFor(`!${team}.includes('expert-perf')`)
        check(true, 'désactiver : le rôle reste listé, pâli, et quitte la section Équipe')

        // Supprimer (confirmation), deux fois : plus aucun rôle à soi, état vide ; le relecteur
        // fourni revient.
        for (const name of ['expert-perf', 'code-reviewer']) {
          await ui.click(`${row(name)}.querySelector('[data-testid=role-row-open]')`)
          await ui.waitFor(`${ui.$('role-edit')}?.dataset.role === '${name}'`)
          await ui.click(ui.$('role-edit-delete'))
          await ui.click(ui.$('confirm-row-confirm'))
          await ui.waitFor(`!!${ui.$('roles-settings')}`)
        }
        await ui.waitFor(`!!${ui.$('roles-empty')}`)
        check(
          !existsSync(created) &&
            !existsSync(join(rolesDir, 'code-reviewer.md')) &&
            (await ui.ev(`${row('code-reviewer')}.dataset.scope`)) === 'builtin',
          'supprimer : fichiers effacés, état vide, le Code reviewer fourni reprend sa place'
        )
        await ui.shot('r9-vide')

        // Un rôle fourni : son écran d'édition propose de l'enregistrer en rôle personnel.
        await ui.click(`${row('tech-lead')}.querySelector('[data-testid=role-row-open]')`)
        await ui.waitFor(`!!${ui.$('role-edit-builtin')}`)
        check(
          !(await ui.ev(`!!${ui.$('role-edit-delete')}`)),
          'rôle fourni : pas de « Supprimer », bandeau « enregistré en rôle personnel »'
        )
        check(
          (await ui.ev(`${ui.$('role-description')}.value`)) === builtin('tech-lead').description &&
            (await ui.ev(`${ui.$('role-prompt')}.value`)) === builtin('tech-lead').prompt,
          'rôle fourni : description et consigne dans la langue de l’interface (ADR-0046)'
        )
        await ui.shot('r10-edition-fourni')

        // Changer la langue de l'interface relit les rôles fournis (ADR-0046) : liste et édition.
        const choose = async (language) => {
          await ui.click(ui.$('settings-general'))
          await ui.waitFor(`!!${ui.$('settings-language')}`)
          await ui.ev(`(() => {
            const select = ${ui.$('settings-language')}
            Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, '${language}')
            select.dispatchEvent(new Event('change', { bubbles: true }))
            return true
          })()`)
          await ui.waitFor(`document.documentElement.lang === '${language}'`)
          await ui.click(ui.$('settings-roles'))
          await ui.waitFor(`!!${row('tech-lead')}`)
        }
        const other = LANG === 'en' ? 'fr' : 'en'
        const otherTexts = (LANG === 'en' ? BUILTIN_FR : BUILTIN_EN)['tech-lead']
        await choose(other)
        await ui.waitFor(
          `${row('tech-lead')}.querySelector('.role-row-desc').textContent.replace(/\\u00a0/g, ' ') === ${JSON.stringify(otherTexts.description)}`
        )
        await ui.click(`${row('tech-lead')}.querySelector('[data-testid=role-row-open]')`)
        await ui.waitFor(`!!${ui.$('role-edit-builtin')}`)
        await ui.waitFor(
          `${ui.$('role-prompt')}.value.replace(/\\u00a0/g, ' ') === ${JSON.stringify(otherTexts.prompt.join('\n'))}`
        )
        check(true, 'langue changée : liste et édition du rôle fourni dans la nouvelle langue')
        await choose(LANG)
        await ui.waitFor(
          `${row('tech-lead')}.querySelector('.role-row-desc').textContent === ${JSON.stringify(builtin('tech-lead').description)}`
        )
        check(true, 'langue d’origine : rôles fournis relus dans cette langue')
      },
      userData,
      // Réponse simple, sans demande d'autorisation (la fille joue le même scénario).
      'streaming-texte',
      { BOBINE_WORKSPACE: workspace, BOBINE_LANG: '' }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
    rmSync(userData, { recursive: true, force: true })
  }
}
