/**
 * Faux serveur de versions (fiche 274) : répond comme `GET /repos/jlallement/bobine/releases` de
 * l'API de GitHub, sur la machine seulement (127.0.0.1, port libre). Jamais GitHub dans un essai.
 * La réponse se change en cours d'essai (`respond`) ; les requêtes reçues sont gardées (chemin,
 * en-têtes) pour vérifier ce que l'app envoie.
 */
import { createServer } from 'node:http'

/** Une Release comme l'API la rend ; nom et notes piégés : jamais rendus en HTML par l'app. */
export function release(tag, extra = {}) {
  return {
    tag_name: tag,
    html_url: `https://github.com/jlallement/bobine/releases/tag/${encodeURIComponent(tag)}`,
    draft: false,
    prerelease: tag.includes('-'),
    name: `<img src=x onerror="document.title='piege'"> ${tag}`,
    body: '<script>document.title = "piege"</script>',
    ...extra
  }
}

/**
 * Versions de l'essai pour la version installée `installed` : celle à annoncer (même ligne pour
 * une préversion, correctif pour une finale), et des pièges plus hauts qui doivent être ignorés.
 */
export function releasesFor(installed) {
  const [, x, y, z, pre] = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/.exec(installed) ?? []
  if (x === undefined) throw new Error(`version installée illisible : ${installed}`)
  const next = pre
    ? `${x}.${y}.${z}-${pre.replace(/(\d+)$/, (n) => String(Number(n) + 1))}`
    : `${x}.${y}.${Number(z) + 1}`
  const higher = `${Number(x) + 1}.0.0`
  return {
    next,
    list: [
      // Brouillon : ignoré.
      release(`v${higher}`, { draft: true }),
      // Page d'ailleurs : ignorée.
      release(`v${x}.${Number(y) + 5}.0`, {
        html_url: `https://evil.example/jlallement/bobine/releases/tag/v${x}.${Number(y) + 5}.0`
      }),
      // Préversion d'une autre ligne : ignorée (préversion ou finale installée).
      release(`v${x}.${Number(y) + 1}.0-beta.1`),
      // Étiquette qui n'est pas du semver strict : ignorée.
      release('latest'),
      release(`v${next}`),
      release(`v${installed}`)
    ]
  }
}

/** Lance le serveur ; `respond(fn)` change la réponse (`fn(req) → { status, body }`). */
export async function startFakeReleases() {
  const seen = []
  let handler = () => ({ status: 200, body: [] })
  const server = createServer((req, res) => {
    seen.push({ path: req.url, headers: { ...req.headers } })
    const { status, body, delayMs = 0 } = handler(req)
    setTimeout(() => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(typeof body === 'string' ? body : JSON.stringify(body))
    }, delayMs)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  return {
    url: `http://127.0.0.1:${port}/repos/jlallement/bobine/releases`,
    seen,
    respond: (fn) => {
      handler = fn
    },
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections()
        server.close(resolve)
      })
  }
}
