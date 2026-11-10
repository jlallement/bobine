/** Pages servies aux essais du navigateur intégré. */

/** Page d'essai du navigateur intégré, servie en local. */
export const TEST_PAGE = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Page d’essai</title>
<style>body{font:16px system-ui;margin:24px}button{padding:6px 14px}</style></head><body>
<h1>Bonjour</h1>
<label>Nom <input id="nom"></label>
<button onclick="document.getElementById('r').textContent = 'Bonjour, ' + document.getElementById('nom').value + ' !'">Valider</button>
<p id="r">En attente</p>
<p><a href="/deux">Page deux</a></p>
<div style="height:1500px"></div><p>Bas de page</p>
</body></html>`

/** Page à déboguer : une erreur en console, un appel d'API en échec (fiche 031). */
export const DEBUG_PAGE = `<!doctype html><meta name="viewport" content="width=device-width"><title>Débogage</title>
<ul><li>un</li><li>deux</li><li>trois</li></ul>
<script>console.error('Erreur volontaire'); fetch('/api').then((r) => r.text())</script>`

/**
 * Page longue du navigateur intégré (fiche 129) : bouton `#cible` qui compte les clics, contenu
 * de 3 000 px à faire défiler, compteur de chargements (⌘R) dans `sessionStorage`.
 */
export const VIEW_PAGE = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width"><title>Page longue</title>
<style>body{font:16px system-ui;margin:0;color:#223}h1{margin:16px 24px}p{margin:12px 24px}
#cible{position:absolute;left:40px;top:120px;width:160px;height:48px;font:inherit}
.bande{height:3000px;background:linear-gradient(#fff,#bcd 50%,#579)}</style></head><body>
<h1>Page longue</h1><button id="cible" onclick="window.clics = (window.clics || 0) + 1">Cible</button>
<div class="bande"><p style="padding-top:120px">Le texte suit la largeur de la colonne : il passe à la ligne quand le panneau rétrécit, et s’étale quand il s’agrandit.</p></div>
<p id="bas">Bas de page</p>
<script>sessionStorage.n = String(Number(sessionStorage.n || 0) + 1)</script></body></html>`
