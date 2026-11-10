# 058 — Installation : agents installés, proxy, quarantaine

- **Statut** : fait
- **Dépend de** : 004, 012, 043
- **Agents** : les deux

## Pourquoi

Installée depuis les sources derrière un proxy et sans droits administrateur, l'app a coincé à
chaque étape : Electron non téléchargé, Bob jamais lancé (l'app partait sur l'agent factice), AXe
bloqué par la quarantaine d'un dépôt récupéré en zip, modèles d'OpenCode non voulus proposés.

## Critères d'acceptation

- [x] L'agent factice n'est proposé que sur demande (`BOB_AGENT_PROFILE=mock`, `BOB_MOCK_AGENT=1`),
      jamais dans l'app installée ; au premier lancement, l'app part sur le premier agent installé.
- [x] Bob et OpenCode ne sont proposés que s'ils sont installés (menu des agents, réglages) ; les
      réglages nomment ceux qui manquent, avec quoi installer.
- [x] `fetch-axe` tente de retirer l'attribut de quarantaine après avoir vérifié empreinte et
      signature.
- [x] `docs/installation.md` : dépôt cloné avec `git`, proxy et Electron, AXe, sans droits
      administrateur, Bob (confiance, SSO, licence), OpenCode (`enabled_providers`), app installable
      signée ad hoc.
- [x] Testé : premier lancement simulé (dossier personnel vide), tests unitaires, e2e.

## Pistes (fiches à venir, au choix de l'utilisateur)

- Diagnostic dans l'app : agents trouvés et versions, connexion / licence / confiance de Bob, Xcode,
  AXe et quarantaine, avec la marche à suivre.
- Bouton « Tester » pour chaque serveur MCP (connexion faite par l'app, outils comptés).
- `.dmg` signé ad hoc construit par GitHub Actions.

## Journal

- 2026-10-14 — Premier lancement simulé en mode preview (dossier personnel vide : Bob sans jeton,
  sans licence, sans dossier approuvé) : l'app partait sur « Agent factice », Bob jamais lancé ;
  une fois Bob choisi, « Dossier non approuvé » puis « Connexion requise » (SSO ou clé) s'affichent
  bien. Quarantaine reproduite : l'attribut d'une archive marquée passe aux fichiers extraits par
  `tar` ; un dépôt récupéré en zip par un navigateur est entièrement marqué, `git clone` non.
- 2026-10-14 — Fait. `mockAgentWanted` (agent factice sur demande, après les vrais agents), choix
  par défaut = premier agent installé (`profileOrDefault`), menu des agents et réglages limités aux
  agents installés (les autres nommés), retrait de la quarantaine tenté par `fetch-axe`, doc
  `installation.md`. Rejoué : premier lancement simulé → Bob directement, « Dossier non approuvé » ;
  archive marquée → AXe extrait sans quarantaine. `verify`, e2e complet.
