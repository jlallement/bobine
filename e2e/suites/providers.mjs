import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { L, Lpart, check, withApp } from '../lib.mjs'
import { startOpenAiCompatible } from '../fixtures/openai-compatible.mts'

const BASE_PATH = '/usr/bin:/bin:/usr/sbin:/sbin'

/** Fichier d'OpenCode lu sans ses commentaires (JSON avec commentaires). */
const jsonc = (file) =>
  JSON.parse(
    readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n')
  )

/**
 * Fournisseurs de modèles (fiche 104) : Réglages › Agents › Fournisseurs de modèles, sur le
 * fichier d'OpenCode d'un dossier personnel jetable (l'agent factice en déclare le format) : clé
 * en clair remplacée par une variable et chiffrée, ajout, « Tester » contre un faux point d'accès
 * compatible OpenAI, « Seulement ces fournisseurs », réseau d'entreprise, Diagnostic. PATH sans
 * OpenCode réel, pour ne pas dépendre de la machine.
 */
export async function providersSuite(scheme) {
  console.log(`\n— Fournisseurs de modèles (${scheme})`)
  const home = mkdtempSync(join(tmpdir(), 'bob-e2e-providers-home-'))
  const bin = mkdtempSync(join(tmpdir(), 'bob-e2e-providers-bin-'))
  const shell = join(bin, 'zsh')
  writeFileSync(shell, `#!/bin/sh\nPATH=${BASE_PATH}\nexport PATH\nexec /bin/sh -c "$2"\n`)
  chmodSync(shell, 0o755)
  const file = join(home, '.config', 'opencode', 'opencode.jsonc')
  mkdirSync(join(home, '.config', 'opencode'), { recursive: true })
  writeFileSync(
    file,
    `{
  // réglage écrit à la main
  "model": "existant/ancien",
  "provider": {
    "existant": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Existant",
      "options": { "baseURL": "http://127.0.0.1:9/v1", "apiKey": "sk-en-clair" },
      "models": { "ancien": { "name": "Ancien", "limit": { "context": 8000 } } }
    }
  }
}
`
  )
  const server = await startOpenAiCompatible({ models: ['qwen3-32b', 'mistral-small'] })
  try {
    await withApp(
      scheme,
      async (ui) => {
        const provider = (id) => `document.querySelector('[data-testid=provider][data-id="${id}"]')`
        const within = (id, testId) => `${provider(id)}?.querySelector('[data-testid=${testId}]')`
        const fill = async (selector, text) => {
          await ui.ev(`${selector}.focus(); ${selector}.select?.(); true`)
          await ui.type(text)
        }
        await ui.ready()
        await ui.click(ui.$('open-settings'))
        await ui.waitFor(`!!${ui.$('settings')}`)
        await ui.click(ui.$('settings-agents'))
        await ui.click(
          `document.querySelector('[data-testid="settings-agent"][data-agent="mock"]')`
        )
        await ui.waitFor(`!!${ui.$('providers-list')}`)
        check(
          (await ui.ev(`${within('existant', 'provider-key-state')}?.innerText`)) ===
            L('settings.providers.key.plain') &&
            (await ui.ev(`${ui.$('providers-mock')}?.innerText`)).includes(
              '~/.config/opencode/opencode.jsonc'
            ),
          'fournisseur du fichier listé, clé en clair signalée, fichier nommé'
        )
        await ui.ev(`${ui.$('providers-list')}.scrollIntoView({ block: 'center' }); true`)
        await ui.shot('86-fournisseurs')

        // Clé : remplacée par {env:EXISTANT_API_KEY} dans le fichier, chiffrée dans l'app.
        await ui.click(within('existant', 'provider-key'))
        await ui.waitFor(`!!${within('existant', 'provider-key-value')}`)
        await ui.shot('86-fournisseurs-cle')
        await fill(within('existant', 'provider-key-value'), 'sk-nouvelle-cle')
        await ui.enter()
        await ui.waitFor(
          `${within('existant', 'provider-key-state')}?.innerText === ${JSON.stringify(L('settings.providers.key.stored'))}`
        )
        const text = readFileSync(file, 'utf8')
        check(
          text.includes('// réglage écrit à la main') &&
            text.includes('"apiKey": "{env:EXISTANT_API_KEY}"') &&
            !text.includes('sk-') &&
            jsonc(file).provider.existant.models.ancien.limit.context === 8000 &&
            existsSync(`${file}.bak`),
          'clé définie : {env:VAR} dans le fichier, commentaire et champs gardés, copie .bak'
        )

        // Ajout d'un fournisseur sur le faux point d'accès.
        await ui.click(ui.$('providers-add'))
        await ui.waitFor(`!!${ui.$('provider-form')}`)
        await fill(ui.$('provider-id'), 'llmaas')
        await fill(ui.$('provider-name'), 'LLMaaS interne')
        await fill(ui.$('provider-url'), server.url)
        await fill(ui.$('provider-models'), 'qwen3-32b = Qwen 3 32B\nmistral-small')
        await ui.shot('86-fournisseurs-formulaire')
        await ui.click(ui.$('provider-save'))
        await ui.waitFor(`!!${provider('llmaas')}`)
        const added = jsonc(file).provider.llmaas
        check(
          added.npm === '@ai-sdk/openai-compatible' &&
            added.options.baseURL === server.url &&
            added.options.apiKey === '{env:LLMAAS_API_KEY}' &&
            added.models['qwen3-32b'].name === 'Qwen 3 32B' &&
            added.models['mistral-small'].name === 'mistral-small' &&
            (await ui.ev(`${provider('llmaas')}.innerText`)).includes(
              L('settings.providers.models', { count: 2 })
            ),
          'fournisseur ajouté au format d’OpenCode, deux modèles'
        )

        // « Tester » : répond avec ses modèles ; l'autre, injoignable, dit quoi faire.
        await ui.click(within('llmaas', 'provider-test'))
        await ui.waitFor(
          `${within('llmaas', 'provider-test-result')}?.dataset.state === 'ok'`,
          15_000
        )
        const ok = await ui.ev(`${within('llmaas', 'provider-test-result')}.innerText`)
        check(
          ok.includes(L('settings.providers.models', { count: 2 })) &&
            server.requests.some((r) => r.path === '/v1/models' && r.authorization === undefined),
          `« Tester » : répond, 2 modèles, GET /models sans clé (${ok})`
        )
        await ui.click(within('existant', 'provider-test'))
        await ui.waitFor(
          `${within('existant', 'provider-test-result')}?.dataset.state === 'error'`,
          15_000
        )
        const failed = await ui.ev(
          `(() => { const r = ${within('existant', 'provider-test-result')}; return r.dataset.cause + ' | ' + r.innerText })()`
        )
        check(
          failed.startsWith('refused |') && failed.includes(Lpart('providers.fix.refused')),
          `« Tester » : connexion refusée, marche à suivre (${failed.slice(0, 80)}…)`
        )
        await ui.shot('86-fournisseurs-teste')

        // « Seulement ces fournisseurs », puis un désactivé : enabled_providers suit.
        await ui.click(ui.$('providers-only'))
        await ui.waitFor(`${ui.$('providers-only')}.checked === true`)
        await ui.click(within('existant', 'provider-enabled'))
        await ui.waitFor(`${within('existant', 'provider-enabled')}.checked === false`)
        check(
          JSON.stringify(jsonc(file).enabled_providers) === '["llmaas"]',
          '« Seulement ces fournisseurs » : enabled_providers = les activés'
        )

        // Réseau d'entreprise (Agents › Avancé, fiche 136) : proxy enregistré, résumé quand
        // « Avancé » est fermé, et « Tester » passe par lui (ici : injoignable).
        const advanced = ui.$('settings-agents-advanced')
        const openAdvanced = async () => {
          await ui.click(ui.$('settings-agent-back'))
          await ui.waitFor(`!!${advanced}`)
          await ui.click(`${advanced}.querySelector('summary')`)
          await ui.waitFor(`${advanced}.open === true`)
        }
        const openMock = async () => {
          await ui.click(
            `document.querySelector('[data-testid="settings-agent"][data-agent="mock"]')`
          )
          await ui.waitFor(`!!${provider('llmaas')}`)
        }
        await openAdvanced()
        await fill(ui.$('network-proxy'), 'http://127.0.0.1:9')
        await fill(ui.$('network-noProxy'), 'rien.test')
        await ui.ev(`${ui.$('network-noProxy')}.blur(); true`)
        await ui.waitFor(`!!${ui.$('network-note')}`)
        await ui.ev(`${ui.$('network-proxy')}.scrollIntoView({ block: 'center' }); true`)
        await ui.shot('86-fournisseurs-reseau')
        await ui.click(`${advanced}.querySelector('summary')`)
        await ui.waitFor(`${advanced}.open === false`)
        check(
          (await ui.ev(`${advanced}.querySelector('summary').innerText`)).includes(
            L('settings.network.summary.noProxy')
          ),
          'réseau d’entreprise : « Avancé » fermé résume ce qui est défini'
        )
        await openMock()
        await ui.click(within('llmaas', 'provider-test'))
        await ui.waitFor(
          `${within('llmaas', 'provider-test-result')}?.dataset.cause === 'proxy'`,
          15_000
        )
        check(true, 'réseau d’entreprise : proxy enregistré, « Tester » passe par lui')
        await openAdvanced()
        await fill(ui.$('network-proxy'), ' ')
        await ui.ev(`${ui.$('network-proxy')}.blur(); true`)
        await fill(ui.$('network-noProxy'), ' ')
        await ui.ev(`${ui.$('network-noProxy')}.blur(); true`)
        await ui.waitFor(`${ui.$('network-proxy')}.value === ''`)
        await ui.waitFor(
          `${advanced}.querySelector('summary').innerText.includes(${JSON.stringify(L('settings.network.summary.none'))})`
        )

        // Diagnostic : une ligne par fournisseur activé (toutes les vérifications finies, pour
        // une capture stable).
        await ui.click(ui.$('settings-diagnostics'))
        await ui.waitFor(
          `!!document.querySelector('[data-testid="diag-group-providers"]') && !document.querySelector('[data-testid=diag-check][data-level=pending]')`,
          30_000
        )
        const rows = await ui.ev(
          `[...document.querySelectorAll('[data-testid="diag-group-providers"] [data-testid=diag-check]')].map((r) => r.dataset.id + ':' + r.dataset.level).join(' ')`
        )
        check(
          rows === 'mock:existant:optional mock:llmaas:ok',
          `diagnostic : fournisseur désactivé facultatif, l’autre joint (${rows})`
        )
        await ui.ev(
          `document.querySelector('[data-testid="diag-group-providers"]').scrollIntoView({ block: 'center' }); true`
        )
        await ui.shot('86-fournisseurs-diagnostic')

        // Suppression confirmée dans la ligne (fiche 126).
        await ui.click(ui.$('settings-agents'))
        await ui.click(
          `document.querySelector('[data-testid="settings-agent"][data-agent="mock"]')`
        )
        await ui.waitFor(`!!${provider('existant')}`)
        await ui.click(within('existant', 'provider-remove'))
        await ui.waitFor(`!!${within('existant', 'confirm-row')}`)
        await ui.ev(`${provider('existant')}.scrollIntoView({ block: 'center' })`)
        await ui.shot('87-fournisseur-confirmer-suppression')
        await ui.click(within('existant', 'confirm-row-confirm'))
        await ui.waitFor(`!${provider('existant')}`)
        check(
          jsonc(file).provider.existant === undefined && jsonc(file).model === 'existant/ancien',
          'fournisseur supprimé, le reste du fichier intact'
        )
        check(
          (await ui.ev(`${ui.$('settings-agent-page')}?.dataset.agent === 'mock'`)) === true,
          'réglages › agents : la page de l’agent toujours là'
        )
        await ui.key('Escape')
      },
      undefined,
      'demo',
      { BOBINE_CONFIG_HOME: home, PATH: BASE_PATH, SHELL: shell }
    )
  } finally {
    await server.close()
    rmSync(home, { recursive: true, force: true })
    rmSync(bin, { recursive: true, force: true })
  }
}
