# ADR-0018 — Téléchargements du navigateur intégré : « Enregistrer sous » à chaque fois

- **Statut** : accepté
- **Date** : 2026-10-20

## Contexte

Le navigateur intégré (fiche 007) refusait tout téléchargement, en silence (`will-download` →
`preventDefault`), règle reconduite par la fiche 072 « comme Claude Code ». Elle n'était posée par
aucun ADR. À l'essai libre du 2026-10-20, le bouton « Exporter » (CSV) d'une page du projet ne
faisait rien, sans un message : impossible de tester un export.

Le risque est connu : l'agent pilote la page, et une page peut lancer un téléchargement. L'arbitrage
sécurité / usage a été fait par l'utilisateur le 2026-10-20 : une fenêtre « Enregistrer sous » à
chaque téléchargement, rien sur le disque sans son clic, même si c'est l'agent qui le déclenche.

## Décision

Chaque téléchargement ouvre la **fenêtre native « Enregistrer sous »** de macOS, en feuille sur la
fenêtre de l'app (`dialog.showSaveDialog`, dossier Téléchargements, nom proposé par la page, et d'où
vient le fichier : « Téléchargement lancé par l'agent depuis … » ou « Fichier proposé par … »).

- Pendant que la fenêtre est ouverte, les données arrivent dans un **dossier propre à l'app**
  (`<données de l'app>/downloads-pending`), jamais dans un dossier de l'utilisateur.
- « Enregistrer » : le fichier y est déplacé à l'endroit choisi. « Annuler » : le téléchargement est
  arrêté et son dossier d'attente supprimé ; rien n'est affiché.
- Le dossier d'attente est vidé au démarrage du navigateur (app arrêtée pendant la fenêtre).

L'agent qui déclenche un téléchargement en est informé dans le résultat de son outil (en anglais,
ADR-0014) : la décision revient à l'utilisateur, réessayer ne sert à rien ; à son outil suivant, il
apprend ce que l'utilisateur a fait (enregistré et où, annulé, échec).

## Alternatives écartées

- **Garder le blocage** — sûr, mais un export ne se teste plus, et rien ne dit pourquoi.
- **Enregistrer d'office dans Téléchargements** (Chrome par défaut) — une action de l'agent
  écrirait chez l'utilisateur sans son accord.
- **La fenêtre « Enregistrer sous » d'Electron** (celle qu'il ouvre si `setSavePath` n'est pas
  appelé) — mesuré sur Electron 44.7.2 : pendant qu'elle est ouverte, Chromium écrit déjà les
  données dans un fichier caché de ~/Downloads (`.com.github.Electron.XXXX`), supprimé si l'on
  annule mais laissé après un plantage ; `session.setDownloadPath` ne le déplace pas. Elle ne se
  remplace pas non plus dans les essais.
- **Annuler, puis retélécharger après le choix** — rien n'est écrit avant le clic, mais un export
  `blob:` (révoqué aussitôt par la page), une réponse à un POST ou un lien à usage unique ne se
  retéléchargent pas : c'est justement le cas d'un bouton « Exporter ».
- **Accord dans le fil** (question à l'utilisateur, comme pour les sites) — plus lent qu'une fenêtre
  « Enregistrer sous », qui demande le même accord et l'emplacement en un geste.

## Conséquences

- Au sens strict, des octets touchent le disque avant le clic : ceux du téléchargement en cours,
  dans le dossier d'attente de l'app, comme dans tout navigateur. Aucun fichier n'arrive dans un
  dossier de l'utilisateur sans son clic, et rien ne reste s'il annule.
- Un téléchargement lancé par l'agent ouvre une fenêtre sur l'app, même si l'utilisateur regarde une
  autre conversation : c'est le prix du consentement.
- Notre fenêtre se remplace dans les essais de bout en bout (`dialog.showSaveDialog` dans le main) ;
  la vraie fenêtre de macOS s'essaie à la souris.
- Ce qui ne change pas : popups (fiche 072) ; permissions des sites (caméra, micro, position,
  notifications, presse-papiers) refusées.
- Tout nouveau chemin d'écriture déclenché par une page (glisser-déposer vers le Finder, API
  d'accès aux fichiers…) suit la même règle : un geste de l'utilisateur avant ses dossiers.
