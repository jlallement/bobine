import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { check, L, withApp } from '../lib.mjs'

/**
 * Continuer une conversation avec un autre agent (fiche 108) : deux agents factices
 * (`BOBINE_MOCK_PEER=1`), un fournisseur de modèles déclaré dans le fichier d'OpenCode d'un dossier
 * personnel jetable (lu pour le second agent), ses modèles proposés par l'agent (`MOCK_MODELS`).
 * Menu « Continuer avec », destination affichée, bascule dans la même conversation, contexte reçu
 * une seule fois (scénario `contexte-recu`), menu inchangé sur une conversation vide. Les deux
 * agents titrent leur session avec le début du texte reçu, comme Bob (`MOCK_AGENT_TITLES=prompt`) :
 * le titre de la conversation ne devient pas « … This conversation started with another… » (fiche
 * 125, D24).
 */
export async function handoverSuite(scheme) {
  console.log(`\n— Continuer avec un autre agent (${scheme})`)
  const home = mkdtempSync(join(tmpdir(), 'bob-e2e-handover-home-'))
  mkdirSync(join(home, '.config', 'opencode'), { recursive: true })
  writeFileSync(
    join(home, '.config', 'opencode', 'opencode.json'),
    JSON.stringify({
      provider: {
        llmaas: {
          npm: '@ai-sdk/openai-compatible',
          name: 'LLMaaS',
          options: { baseURL: 'https://llmaas.example.com/v1', apiKey: '{env:LLMAAS_API_KEY}' },
          models: { 'qwen3-32b': { name: 'Qwen3 32B' } }
        }
      }
    })
  )
  const peer = L('profiles.mockPeer.label')
  const mock = L('profiles.mock.label')
  const item = `document.querySelector('[data-testid="handover-mock-peer-llmaas/qwen3-32b"]')`
  try {
    await withApp(
      scheme,
      async (ui) => {
        await ui.ready()
        await ui.send('/scenario streaming-texte')
        await ui.ready()

        // Nom que l'agent d'avant s'est donné (celui de la puce), qui ne recevra plus rien.
        const before = (await ui.ev(`${ui.$('agent-menu')}.innerText`)).trim()
        // Menu de l'agent d'une conversation commencée : « Continuer avec », puis comme avant.
        // Les destinations arrivent après l’ouverture : un clic CDP lent peut relâcher sur
        // une ligne apparue sous le pointeur. Ouvrir au clavier, puis choisir à la souris.
        await ui.ev(`${ui.$('agent-menu')}.focus()`)
        await ui.press('Enter')
        await ui.waitFor(`!!${item}`)
        const menu = await ui.ev(`${ui.$('agent-menu-content')}.innerText`)
        check(
          menu.includes(L('handover.menu.continue')) &&
            menu.includes(L('handover.menu.newConversation')) &&
            (await ui.ev(`${item}.innerText`)).includes(`${peer} · Qwen3 32B`) &&
            (await ui.ev(`${item}.innerText`)).includes('LLMaaS') &&
            menu.includes(L('handover.menu.otherModel', { agent: peer })),
          'menu : l’autre agent avec le modèle de son fournisseur déclaré, puis « autre modèle… »'
        )
        await ui.shot('h1-menu-continuer')

        // Confirmation : où partiront les messages, ce qui part, ce qui s'arrête.
        await ui.click(item)
        await ui.waitFor(`!!${ui.$('handover-dialog')}`)
        await ui.waitFor(`!!${ui.$('handover-sent')}`)
        const where = await ui.ev(`${ui.$('handover-where')}.innerText`)
        check(
          where.includes(peer) &&
            where.includes('Qwen3 32B') &&
            where.includes('LLMaaS') &&
            where.includes('https://llmaas.example.com/v1'),
          'destination affichée : agent, modèle, fournisseur et adresse'
        )
        check(
          (await ui.ev(`${ui.$('handover-sent')}.innerText`)) ===
            L('handover.dialog.sent', { count: 2 }) &&
            (await ui.ev(`${ui.$('handover-dialog')}.innerText`)).includes(
              L('handover.dialog.stops', { agent: before })
            ),
          'ce qui part (2 messages, avec le prochain message) et ce qui s’arrête'
        )
        await ui.shot('h2-confirmation')
        await ui.click(ui.$('handover-confirm'))
        await ui.waitFor(`!!${ui.$('handover-divider')}`)
        await ui.waitFor(`!${ui.$('handover-dialog')}`)
        await ui.ready()
        await ui.waitFor(`${ui.$('model-chip')}?.innerText.includes('Qwen3 32B')`)
        check(
          (await ui.ev(`${ui.$('handover-divider')}.innerText`)).includes(
            L('handover.thread.title', { agent: `${peer} · Qwen3 32B` })
          ) &&
            (await ui.ev(`${ui.$('agent-menu')}.innerText`)).includes(peer) &&
            (await ui.ev(`document.querySelectorAll('.msg-user').length`)) === 1,
          'même conversation : fil gardé, trait « Suite avec », nouvel agent et son modèle'
        )
        await ui.shot('h3-suite-dans-le-fil')

        // Le premier message emporte l'échange d'avant, une seule fois.
        await ui.send('/scenario contexte-recu')
        await ui.ready()
        check(
          (await ui.lastAgentText()).includes(
            `Contexte reçu de « ${mock} » : 1 message(s) de l'utilisateur, 1 réponse(s).`
          ),
          'premier message : l’échange précédent reçu en contexte, avec l’agent d’avant'
        )
        // Le nouvel agent a titré sa session avec le message et l'échange joint après lui : le titre
        // que l'utilisateur reconnaît reste, dans la liste et en tête.
        const shown = await ui.ev(
          `document.querySelector('.history-item.active .label').innerText + '|' + ${ui.$('title-menu')}.innerText`
        )
        check(
          shown === '/scenario streaming-texte|/scenario streaming-texte',
          `titre gardé malgré celui du nouvel agent (${shown})`
        )
        await ui.send('/scenario contexte-recu')
        await ui.ready()
        check(
          (await ui.lastAgentText()).includes('Aucun contexte reçu'),
          'message suivant : plus de contexte'
        )
        await ui.shot('h4-contexte-recu')

        // Conversation vide : le menu reste celui du choix de l'agent.
        await ui.click(ui.$('new-conversation'))
        await ui.waitFor(`!!${ui.$('welcome')}`)
        await ui.ready()
        await ui.click(ui.$('agent-menu'))
        await ui.waitFor(`!!${ui.$('agent-menu-content')}`)
        const empty = await ui.ev(`${ui.$('agent-menu-content')}.innerText`)
        check(
          !empty.includes(L('handover.menu.continue')) && empty.includes(L('agentMenu.title')),
          'conversation vide : pas de « Continuer avec »'
        )
        await ui.key('Escape')
      },
      undefined,
      'demo',
      {
        BOBINE_CONFIG_HOME: home,
        BOBINE_MOCK_PEER: '1',
        MOCK_AGENT_TITLES: 'prompt',
        MOCK_MODELS: 'llmaas/qwen3-32b=LLMaaS/Qwen3 32B'
      }
    )
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}
