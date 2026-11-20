# ADR-0063 — Navigateur intégré : avertissement de certificat et exception étroite, décidée par l'utilisateur seul

- **Statut** : proposé (fiche 269)
- **Date** : 2026-11-20
- **Complète** : ADR-0006 (navigateur piloté par le CDP), fiche 072 (accord par site, isolement de
  la session `persist:bob-browser`), fiche 114 (émetteur de l'IPC vérifié), fiche 249
  (navigations gardées pendant une action de l'agent)

## Contexte

Un testeur ne peut pas ouvrir dans le panneau Navigateur son serveur de développement en HTTPS au
certificat auto-signé (`@vitejs/plugin-basic-ssl`, `server.https` de Vite, `devServer.https` de
Webpack). Il n'est pas administrateur du Mac : il ne peut pas ajouter le certificat au trousseau.
Chrome et Edge affichent une page d'avertissement avec « Continuer quand même » ; Bobine n'affiche
qu'une ligne rouge `ERR_CERT_AUTHORITY_INVALID (-202) loading 'https://localhost:5199/'`.

Cause : Electron émet `app.on('certificate-error')` pour chaque certificat refusé d'un
`webContents` ; sans gestionnaire, le refus est silencieux et `loadURL` rejette. Personne ne
l'écoute dans Bobine, et le panneau n'a pas de page d'erreur.

Essai fait sur Electron 45 (Vite `basic-ssl` sur `https://localhost:5199`, session `x`) :

- l'évènement donne l'URL entière (schéma, hôte, **port**), le code (`net::ERR_CERT_AUTHORITY_INVALID`),
  le certificat (PEM, sujet, émetteur, `fingerprint` au format `sha256/<base64>`), `isMainFrame`,
  et le `webContents` (donc sa session) ;
- Electron **ne retient aucune décision** : après `closeAllConnections()`, l'évènement revient pour
  le même certificat ; tant qu'une connexion acceptée reste ouverte, elle est réutilisée sans
  nouvelle vérification ;
- les sous-ressources passent par le même évènement (`isMainFrame: false`), y compris le
  `wss://` du rechargement à chaud de Vite.

Le risque est connu : un « continuer quand même » trop large ouvre la porte à une interception
(attaquant sur le réseau, faux point d'accès) ; un agent qui pourrait l'accepter seul le ferait
sans que l'utilisateur sache ce qu'il accepte.

## Décision

1. **Le refus reste le défaut, et seule la session du panneau Navigateur a une exception.**
   Le gestionnaire `certificate-error` ne touche qu'aux pages du navigateur intégré : `webContents`
   de la session du panneau (`persist:bob-browser` ou sa variante en mémoire) **et** connu du
   gestionnaire (onglet ou popup de l'utilisateur). Pour tout autre `webContents` (fenêtres de
   l'app, aide, fenêtre rapide), il ne fait rien : Electron refuse, comme avant. Ni
   `setCertificateVerifyProc`, ni `--ignore-certificate-errors`, ni changement des appels réseau du
   main (`net`, `fetch` de Node), des agents ou des mises à jour : ils ne passent pas par cet
   évènement.
2. **Exception étroite** : hôte **et** port **et** empreinte SHA-256 exacte du certificat (calculée
   par Bobine depuis le PEM, `X509Certificate.fingerprint256`). Pas de joker, pas d'hôte seul : un
   autre port, un autre hôte (`127.0.0.1` n'est pas `localhost`) ou un certificat régénéré
   redemandent.
3. **Seulement pour une adresse locale ou privée** : `localhost`, `*.localhost`, `127.0.0.0/8`,
   `::1`, `*.test`, `*.local`, et les IPv4 privées de la RFC 1918 (`10/8`, `172.16/12`,
   `192.168/16`). C'est le cas d'usage (serveur de développement) ; pour un site public, un
   certificat refusé est presque toujours un vrai problème, et l'avertissement ne propose pas de
   continuer (il conseille le navigateur habituel). La règle est appliquée par le main au moment
   d'accorder, pas seulement par l'interface.
4. **Page d'avertissement dans l'interface de l'app, pas dans la page.** Un échec du cadre principal
   note le problème sur l'onglet (hôte, port, code, sujet, émetteur, empreinte, jeton aléatoire) et
   le panneau l'affiche à la place de la vue native, masquée : « Votre connexion n'est pas privée »,
   la raison, « Retour », et derrière « Avancé » l'empreinte et « Continuer vers <hôte> (non
   sécurisé) ». La page affichée n'a ni preload ni accès à l'IPC : ni `postMessage`, ni lien forgé,
   ni script de la page ne peuvent l'atteindre.
5. **Seul un clic de l'utilisateur accorde l'exception.** Canal `browser:allowCertificate(conversation,
   jeton, retenir)` : comme tout canal, refusé si l'émetteur n'est pas le cadre principal d'une
   fenêtre de l'app (`trustedSender`, fiche 114) ; le main ne reçoit **ni l'hôte ni l'empreinte**
   du renderer, seulement le jeton de l'avertissement qu'il a lui-même noté, et reprend tout le
   reste de sa propre note. Un jeton inconnu ou périmé (autre navigation entre-temps) est refusé.
6. **L'agent ne peut jamais accepter.** Ses outils (`browser-tools.ts`) n'ont aucune fonction qui
   accorde ; quand la page est sous un avertissement, `browser_navigate` et tout outil qui lit la
   page ou y agit échouent avec un message clair (seul l'utilisateur peut décider, dans le panneau).
   Ses clics passent par le CDP de la page, jamais par l'interface de l'app ; aucune commande
   `Security.*` du CDP n'est envoyée (refusée dans `CdpTab`). Une exception déjà accordée par
   l'utilisateur vaut aussi pour l'agent sur ce même hôte, port et certificat (c'est la page de
   l'utilisateur).
7. **Durée** : pour la session de l'app par défaut (en mémoire du main, perdue à la fermeture) ;
   case « Se souvenir de ce certificat » pour la garder dans `approvals.json`, à côté des sites et
   commandes « toujours autorisés ». Les deux genres sont listés dans Réglages › Confidentialité ›
   Autorisé sans demander (« Certificats acceptés », « cette session » ou « retenu »), révocables
   une à une ; révoquer ferme les connexions de la session du panneau et recharge les onglets de
   cet hôte et port, qui retombent sur l'avertissement.
8. **Visible ensuite** : la barre d'adresse porte « Non sécurisé » tant que l'onglet affiche un
   hôte et port entrés sous une exception encore valable.

## Alternatives écartées

- **`session.setCertificateVerifyProc` sur la session du panneau** — la demande ne donne ni le port
  ni le `webContents` : impossible de tenir « hôte et port », ni d'afficher l'avertissement dans le
  bon onglet. Et la décision y serait prise avant toute page d'erreur.
- **Page d'avertissement chargée dans la vue native** (`data:` ou protocole maison) — son bouton
  devrait parler au main : il faudrait un canal ouvert à une page web, que la page suivante (ou un
  script injecté par l'agent via `browser_javascript`) pourrait imiter. Dans l'interface de l'app,
  la question ne se pose pas.
- **Exception par hôte seul, ou pour tout hôte avec un avertissement renforcé** — plus large que
  le besoin ; un site public au certificat refusé ne doit pas devenir un clic de routine.
- **Retenir par défaut** — un serveur de développement régénère son certificat (Vite `basic-ssl` le
  garde un mois, Webpack aussi) : retenir l'empreinte exacte sert, mais seulement si l'utilisateur
  le choisit ; par défaut rien ne survit à la fermeture.
- **Laisser l'agent demander l'accord par une carte (comme l'accord par site)** — la carte
  dirait ce que l'agent veut, pas ce que le certificat est ; la décision doit se prendre devant
  l'avertissement, empreinte sous les yeux.

## Conséquences

- Le panneau sait ouvrir un serveur de développement en HTTPS auto-signé sans droits
  d'administrateur, sans rien installer dans le trousseau, et sans affaiblir TLS ailleurs.
- `approvals.json` gagne un champ `certificates` (hôte, port, empreinte) ; une version plus ancienne
  le garde tel quel (champs inconnus réécrits, fiche 196).
- Les sous-ressources d'un autre hôte ou port (ex. `wss://127.0.0.1:5199` du rechargement à chaud
  quand la page est sur `localhost:5199`) restent refusées tant qu'elles n'ont pas leur propre
  exception : c'est voulu (étroit), et dit dans la fiche.
- « Non sécurisé » suit le cadre principal seulement ; une sous-ressource acceptée sous une
  exception dans une page par ailleurs saine ne l'allume pas.
- À surveiller : une version d'Electron qui retiendrait elle-même les décisions (révocation sans
  effet avant fermeture) ; l'essai e2e de révocation le verrait.
