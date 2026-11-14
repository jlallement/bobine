# 225 — Vitrine GitHub : README illustré, captures reproductibles, image de partage, vidéo

- **Statut** : en cours
- **Dépend de** : 186 (captures du guide), 219 (README public), 223 (rôles)
- **Agents** : aucun (documentation et outillage) ; les captures utilisent l'agent factice en mode
  vitrine, jamais un vrai agent ni un faux IBM Bob ou OpenCode

## Pourquoi

Le dépôt public montre une seule image, une capture d'essai (`/scenario lent`, « Agent factice »,
français dans l'interface anglaise). Un visiteur ne voit ni les rôles en parallèle, ni les outils
visuels, ni rien qui bouge. Plan et audit : [`docs/promotion-github.md`](../promotion-github.md).

## Critères d'acceptation

- [ ] `pnpm build && pnpm vitrine [--lang fr]` régénère toutes les images du README, le GIF, la
      vidéo et l'image de partage, sans modèle ni donnée personnelle, et refuse une capture qui
      montre « factice », « mock », `/scenario` ou un chemin de la machine.
- [ ] L'agent s'appelle « Agent de démo » / « Demo agent » partout dans les captures (profil,
      `agentInfo.title`, modèles « Démo … ») ; jamais un faux IBM Bob ou OpenCode.
- [ ] README anglais restructuré (accroche, badges, téléchargement, image de tête claire et
      sombre, « Why Bobine », visite illustrée, FAQ, feuille de route) ; `README.fr.md` complet.
- [ ] GIF ≤ 5 Mo ; MP4 < 10 Mo (dépôt par l'éditeur web de GitHub).
- [ ] Notes de version : image en tête et ligne d'installation non signée.
- [ ] Testé contre l'agent factice : `src/mock-agent/vitrine.test.ts` (scénario `vitrine`,
      `--vitrine`).

## Plan

1. Agent factice : étape `by-language` (textes longs dans les deux langues) ; scénario `vitrine`
   (`src/mock-agent/scenarios-vitrine.mts`) qui choisit sa suite d'après le message, pour que
   l'invite affichée soit une vraie phrase ; option `--vitrine` (nom et modèles « de démo »).
2. App : `MOCK_AGENT_SHOWCASE=1` (profil factice seulement, jamais dans l'app packagée) : libellé
   « Agent de démo » (`profiles.mock.showcaseLabel`), pas d'invitation à `/scenario` à l'accueil.
3. `e2e/vitrine-captures.mjs` (`pnpm vitrine`), sur le modèle de `e2e/guide-captures.mjs` ;
   `ui.cdp` exposé par `e2e/lib.mjs` pour filmer la fenêtre (images JPEG horodatées).
4. README, `README.fr.md`, `.github/workflows/release.yml` (en tête des notes), AGENTS.md (ligne
   de commande), `docs/mock-agent.md`, plan de promotion.

**Outils de développement, non livrés** (installés avec l'accord de l'utilisateur le 2026-11-14) :
`ffmpeg` (encodage MP4, découpe du GIF, bande clair/sombre) et `gifski` (GIF), par Homebrew ;
`sips` (macOS) réduit les images. Aucune dépendance npm ajoutée.

## Journal

- 2026-11-14 — Plan et audit (`docs/promotion-github.md`) ; décisions de l'utilisateur : agent
  « Demo agent » / « Agent de démo », README anglais en tête et français complet, page d'accueil et
  publications à la 1.0, Discussions et liste des clients ACP préparées (textes dans le plan) mais
  pas faites.
- 2026-11-14 — Scénario `vitrine`, option `--vitrine`, profil de démo, script de captures, README
  anglais et français, en-tête des notes de version. Captures : en attente du feu vert (une suite
  e2e complète tournait sur la machine).
- Écart au plan : simulateur iOS et émulateur Android non capturés (leurs faux outils d'essai
  montrent un iPhone factice et un flux interrompu) ; le README les décrit en texte. Thèmes : clair
  et sombre seulement, le thème « Aurore » en préparation pourra s'ajouter à `SCHEMES` du script
  et à `themes.png`, puis tout se régénère.
