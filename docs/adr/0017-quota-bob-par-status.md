# ADR-0017 — Quota de bobcoins lu par la commande `/status` de Bob Shell

- **Statut** : accepté
- **Date** : 2026-10-20

## Contexte

Bob IDE affiche le quota de bobcoins et la part consommée ; Bobine ne le peut pas, ce qui freine son
adoption (demande de l'utilisateur, fiche 091). Bob n'envoie rien de sa consommation par ACP (son
`ACP.md` n'en parle pas), et sa base locale `~/.bob/db/bob.db` ne connaît que le coût des tâches de
ce Mac (ADR-0015). Un calcul local ne tient pas : l'utilisateur peut travailler sur plusieurs
ordinateurs, et son plafond peut changer en cours de mois. Seul le service de Bob connaît le plafond
et la consommation.

Bob Shell les affiche lui-même : sa commande `/status` (« View Bob Shell task status, along with usage
and version information ») montre « Monthly Budget » et « Monthly Usage », que Bob lit auprès
de son service avec la connexion de l'utilisateur. Essai du 2026-10-20 (Bob 2.0.6, SSO) : `bob
chat`, puis `/status` dans un pseudo-terminal → budget et consommation affichés, 0 bobcoin ; mais
`bob chat` crée une tâche vide (« Task ID » affiché par `/status`), supprimée ensuite par
`session/delete` sur `bob acp` (initialize, puis delete, sans ouvrir de session).

## Décision

Au démarrage de Bobine, si Bob est installé, un adaptateur de son profil (`quotaSource`, point
d'extension générique de `adapters.ts`) lance `bob chat` en tâche de fond dans un pseudo-terminal
(`node-pty`, écran relu par `@xterm/headless`, déjà dans l'app), tape `/status`, relit le plafond, la
consommation et l'identifiant de la tâche, puis quitte. La tâche vide est aussitôt supprimée de
l'historique de Bob par `session/delete` (un `bob acp` lancé pour l'occasion). Bobine ne lit ni ne
manipule aucun identifiant de Bob : c'est Bob qui se connecte. La moindre surprise (écran inattendu,
délai dépassé, Bob non connecté, licence à accepter) donne « quota inconnu », jamais un chiffre faux.

## Alternatives écartées

- **Interroger soi-même le service de Bob** : rien de documenté pour cela, et il faudrait reprendre
  la connexion de Bob. Contraire à « ne rien supposer de non documenté sur Bob » (AGENTS.md),
  fragile.
- **Plafond saisi à la main, consommation calculée depuis `bob.db`** : faux dès qu'on utilise Bob sur
  une autre machine, et à chaque relèvement du plafond.
- **Attendre une extension ACP de Bob** (`_bob/usage`) : la vraie solution, à demander à IBM ; Bobine
  passera dessus dès qu'elle existe. Rien d'ici là.

## Conséquences

- Les chiffres sont ceux du serveur de Bob, toutes machines et recharges comprises, pour 0 bobcoin.
- Bobine lit un écran fait pour un humain : un changement de libellés de Bob casse la lecture (le
  quota devient inconnu). Le format est figé dans un test sur une capture de `/status` (valeurs
  inventées) ; à revérifier après chaque mise à jour de Bob, avec la sonde (`pnpm bob-probe`).
- Chaque lecture coûte un processus `bob chat` (une dizaine de secondes) et une tâche créée puis
  supprimée : lecture au démarrage seulement (et sur demande), pas à chaque message.
- `bob chat` est lancé avec `--trust` dans un dossier vide de Bobine (Bob y demanderait sinon
  confiance) : une ligne de plus dans `~/.bob/trustedFolders.json`, pour ce dossier seulement.
- Fonction propre à Bob : déclarée dans son profil, listée dans Réglages › Agents et dans la matrice
  de `docs/agents.md` (ADR-0011).

---

Texte expurgé le 2026-11-10 pour la publication du dépôt ; la décision est inchangée.
