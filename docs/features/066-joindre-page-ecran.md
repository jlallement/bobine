# 066 — Joindre la page ou l'écran au message

- **Statut** : fait
- **Dépend de** : 005, 007, 008, 032, 062
- **Agents** : les deux (images jointes, génériques)

## Pourquoi

Pour montrer à l'agent ce qui ne va pas dans une page ou une app, il fallait une capture d'écran
de toute la zone. Le navigateur intégré et les simulateurs savent déjà ce qu'ils affichent : un
bouton suffit pour l'envoyer dans le message.

## Critères d'acceptation

- [x] Bouton « Joindre au message » dans la barre du navigateur intégré, du simulateur iOS et de
      l'émulateur Android : l'image de la page ou de l'écran arrive dans la zone de saisie de la
      conversation, à côté du texte en cours (qui n'est pas touché).
- [x] Nommée d'après la page (« Page <titre>.png ») ou l'appareil (« Simulateur <nom>.jpg »,
      « Émulateur <nom>.jpg ») ; page réduite à 2 000 px de large au plus, PNG sinon JPEG.
- [x] Sans page ouverte, le bouton du navigateur est inactif.
- [x] Testé : e2e `browser`, `simulator`, `android` (image jointe et nommée, puis retirée), clair et
      sombre ; essai réel avec une vraie page (image regardée).

## Plan

1. `shared/attachments.ts` : `ImageAttachment`. `main/screen-capture.ts` : `encodeImage` (nom
   donné), réutilisé par la capture d'écran.
2. `BrowserManager.capture` (`capturePage` de l'onglet actif) ; IPC `browser:capture`, preload.
3. Renderer : `AttachImageButton` (bouton, chargement), simulateurs par leur capture existante
   (`simulator:screenshot`, `android:screenshot`, JPEG en points) ; `SidePanel` → `onAttachImage`
   → `ComposerInbox.prefill` de la conversation affichée.
4. e2e dans les trois suites.

Pas de nouvelle dépendance.

## Journal

- 2026-10-15 — Fait selon le plan. `ComposerInbox` (fiche 062) sert aussi ici : un message rendu
  sans texte ne touche plus au texte en cours (avant, il ajoutait une ligne vide). Dans les e2e,
  le « × » d'une pièce jointe n'apparaît qu'au survol : retrait déclenché directement. Essai
  réel : page « Maquette du panier » ouverte dans le navigateur intégré, jointe : « Page Maquette
  du panier.png », image fidèle.
- 2026-10-23 — Écart (fiche 124, défaut D3) : la capture de l'écran depuis la zone de saisie dit
  sous celle-ci quand macOS n'autorise pas l'enregistrement de l'écran, avec le réglage à ouvrir.
