import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { check, L, withApp } from '../lib.mjs'
import { conversationTooltip } from '../sidebar-tooltip.mjs'

/**
 * Modifier un message et repartir de là (fiche 023) : branche avec l'échange repris, fichiers
 * remis dans leur état d'alors, originale intacte, « Réessayer ». L'agent titre sa session avec le
 * début du texte reçu, contexte de la branche compris, comme Bob (`MOCK_AGENT_TITLES=prompt`) : ni
 * la liste ni la carte de branche ne le montrent (fiche 125).
 */
export async function branchSuite(scheme) {
  console.log(`\n— Repartir d’un message (${scheme})`)
  const workspace = mkdtempSync(join(tmpdir(), 'bob-e2e-branch-'))
  const readme = join(workspace, 'README.md')
  const initial = '# Démo\n\nVersion 1\n\n## Utilisation\n'
  writeFileSync(readme, initial)
  try {
    await withApp(
      scheme,
      async (ui) => {
        const users = `[...document.querySelectorAll('[data-testid=user-message]')]`
        await ui.send('/scenario streaming-texte')
        await ui.ready()
        await ui.send('/scenario modifications')
        await ui.ready()
        check(readFileSync(readme, 'utf8').includes('Version 2'), 'l’agent a modifié le README')

        // Modifier le second message.
        await ui.ev(`${users}[1].scrollIntoView({ block: 'center' })`)
        await ui.click(`${users}[1].querySelector('[data-testid=message-edit]')`)
        await ui.waitFor(`!!${ui.$('message-edit-input')}`)
        check(
          (await ui.ev(`${ui.$('message-edit-input')}.value`)) === '/scenario modifications',
          'modifier : le texte du message devient modifiable sur place'
        )
        await ui.ev(`${ui.$('message-edit-input')}.select()`)
        await ui.type('/scenario echo')
        await ui.shot('a0-message-modifie')
        await ui.enter()
        await ui.waitFor(`!!${ui.$('branch-dialog')}`)
        const files = await ui.ev(
          `[...document.querySelectorAll('[data-testid=branch-files] li')].map((li) => li.innerText)`
        )
        check(
          files.length === 2 &&
            files.some((f) => f.startsWith('README.md')) &&
            files.some((f) => f.startsWith('app.js') && f.includes(L('changes.badge.deleted'))) &&
            (await ui.ev(`${ui.$('branch-restore')}.checked`)),
          'fichiers modifiés depuis : proposés à la remise en état (case cochée)'
        )
        await ui.shot('a1-repartir-dialogue')
        await ui.click(ui.$('branch-confirm'))
        await ui.waitFor(`!!${ui.$('branch-banner')}`)
        await ui.waitFor(
          `[...document.querySelectorAll('.msg-agent')].at(-1)?.innerText.includes('earlier_conversation')`
        )
        await ui.ready()
        check(
          readFileSync(readme, 'utf8') === initial && !existsSync(join(workspace, 'src', 'app.js')),
          'fichiers remis dans leur état d’alors (README restauré, fichier créé supprimé)'
        )
        check(
          (await ui.ev(`${users}.map((m) => m.querySelector('.msg-user').innerText.trim())`)).join(
            '|'
          ) === '/scenario streaming-texte|/scenario echo',
          'branche : échange repris jusqu’au message, puis le nouveau message'
        )
        check(
          (await ui.lastAgentText()).includes('User: /scenario streaming-texte'),
          'l’agent a reçu l’échange repris en contexte'
        )
        // Repère « branche » qui ne se coupe pas, titre complet en infobulle (fiche 125) ; le titre
        // que l'agent donne à sa session (« /scenario echo This conversation continues… ») ne
        // remplace pas celui de l'app.
        const active = `document.querySelector('.history-item.active')`
        check(
          (await ui.ev(`${active}.querySelector('.label').innerText`)) ===
            '/scenario streaming-texte' &&
            (await ui.ev(
              `${active}.querySelector('[data-testid=history-branch-tag] svg')?.tagName`
            )) === 'svg' &&
            (await conversationTooltip(ui, `${active}.querySelector('.history-open')`)).startsWith(
              `/scenario streaming-texte · ${L('conversations.branchSuffix')}\n${L('sidebar.branchOf', { title: '/scenario streaming-texte' })}`
            ),
          'la branche est dans l’historique : icône de fork, titre complet en infobulle'
        )
        // Son origine dans l'en-tête (fiche 131) : elle n'est plus rangée sous elle dans la liste.
        check(
          (await ui.ev(`${ui.$('title-branch-origin')}?.innerText`)) ===
            L('conversationTitle.branchFrom', { title: '/scenario streaming-texte' }),
          'en-tête de la branche : « ↳ branche de « … » »'
        )
        await ui.waitFor(`(${ui.$('title-menu')}?.innerText ?? '').length > 0`)
        const page = await ui.ev(
          `document.querySelector('.sidebar').innerText + ${ui.$('branch-banner')}.innerText + ${ui.$('title-menu')}.innerText`
        )
        check(
          !page.includes('This conversation') && !page.includes('earlier_conversation'),
          'titre de l’agent avec le contexte de la branche : ni dans la liste, ni dans le titre, ni dans la carte'
        )
        await ui.shot('a2-branche')

        // Retour à l'original : intact.
        await ui.ev(`${ui.$('branch-original')}.scrollIntoView({ block: 'center' })`)
        await ui.shot('a3-bandeau-branche')
        await ui.click(ui.$('branch-original'))
        await ui.waitFor(`!document.querySelector('[data-testid=branch-banner]')`)
        await ui.ready()
        check(
          (await ui.ev(`${users}.map((m) => m.querySelector('.msg-user').innerText.trim())`)).join(
            '|'
          ) === '/scenario streaming-texte|/scenario modifications',
          '« Voir l’original » : la conversation d’origine est intacte'
        )

        // Réessayer le dernier message : rien n'a changé depuis sur le disque → pas de dialogue.
        await ui.ev(`${users}.at(-1).scrollIntoView({ block: 'center' })`)
        await ui.click(`${users}.at(-1).querySelector('[data-testid=message-retry]')`)
        await ui.waitFor(`!!${ui.$('branch-banner')}`)
        await ui.ready()
        await ui.waitFor(`document.querySelectorAll('[data-testid=history-item]').length === 3`)
        check(
          readFileSync(readme, 'utf8').includes('Version 2') &&
            !(await ui.ev(`!!${ui.$('branch-dialog')}`)),
          '« Réessayer » : nouvelle branche avec le même message, rejoué par l’agent'
        )

        // Branches à plat (fiche 131) : des conversations à part entière, plus rangées sous leur
        // original ni décalées ; leur repère « branche », leurs titres au même bord.
        const rows = await ui.ev(
          `[...document.querySelectorAll('[data-testid=history-item]')].map((row) => ({
            nested: row.classList.contains('nested'),
            slot: !!row.querySelector('.row-slot'),
            tag: !!row.querySelector('[data-testid=history-branch-tag]'),
            title: row.querySelector('.label').innerText,
            left: Math.round(row.querySelector('.label').getBoundingClientRect().left)
          }))`
        )
        const original = rows.find((row) => !row.tag)
        const branches = rows.filter((row) => row.tag)
        check(
          rows.length === 3 &&
            branches.length === 2 &&
            rows.every((row) => !row.nested && !row.slot && row.left === rows[0].left) &&
            branches.every((row) => row.title.startsWith(original.title)),
          `liste : les branches à plat, repère « branche », titres au même bord (${JSON.stringify(rows)})`
        )
        await ui.shot('a4-branches-a-plat')
      },
      undefined,
      'demo',
      { BOBINE_WORKSPACE: workspace, MOCK_AGENT_TITLES: 'prompt' }
    )
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}
