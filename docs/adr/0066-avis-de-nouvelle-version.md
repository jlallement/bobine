# ADR-0066 — Avis de nouvelle version : vérification des Releases GitHub, sans installation

- **Statut** : proposé (fiche 274 ; décisions de Jérôme du 2026-11-22, maquettes à valider)
- **Date** : 2026-11-22
- **Remplace en partie** : ADR-0023, sur un seul point : « ni contrôle de version dans l'app :
  aucun appel réseau pour cela ». Le reste de l'ADR-0023 reste valable : pas de mise à jour
  automatique, et une nouvelle version s'installe comme la première (fiche 073).

## Contexte

L'ADR-0023 a écarté toute mise à jour automatique et tout contrôle de version, le 2026-10-21 :
l'app n'est pas signée avec un Developer ID (choix assumé, pas de notarisation), et sur un poste
géré, l'utilisateur n'a pas toujours le droit d'installer lui-même. Conséquence notée alors : « les
utilisateurs peuvent rester sur une vieille version sans le savoir ».

L'audit d'avant la rc (fiche 187, R5, criticité 15) en fait un risque ouvert pour la 1.0 finale
(issue #19). Une version boguée reste installée tant que l'utilisateur ne va pas voir lui-même la
page Releases, et « Watch › Releases » sur GitHub suppose un compte et un geste que peu feront.

Les deux raisons de l'ADR-0023 visent l'**installation**, pas l'**information**. Prévenir sans
installer règle R5 sans toucher à ces contraintes.

## Décision

1. **Vérifier, ne jamais installer.** Bobine interroge l'API publique de GitHub, sans compte ni
   jeton : `GET https://api.github.com/repos/jlallement/bobine/releases?per_page=30`, par
   `net.fetch` d'Electron (proxy du système). La requête porte
   `User-Agent: Bobine/<version>`, a un délai court (10 s) et une réponse bornée (1 Mio). Rien ne
   se télécharge ni ne s'installe : l'avis ouvre la page de la version dans le navigateur du Mac.
2. **Automatique et facultative.** La vérification a lieu au lancement, au plus une fois par
   24 h, en arrière-plan, et pas dans un profil en lecture seule. La date de la dernière
   vérification réussie est gardée dans le profil (`update-check.json`). Un réglage de Réglages ›
   Nouveautés la coupe ; il est **activé par défaut**. « Vérifier maintenant » marche toujours.
3. **Silencieuse en cas d'échec.** Hors ligne, en cas d'erreur, de limite de débit ou de réponse
   illisible, rien ne s'affiche ; une ligne au journal. Seule une vérification lancée à la main
   dit qu'elle a échoué.
4. **Préversions selon la version installée.** Une version finale n'est avertie que des versions
   finales. Une préversion l'est des préversions suivantes et des versions finales. L'ordre est
   celui de semver strict, sur l'étiquette (`vX.Y.Z[-pré]`). Les brouillons et les étiquettes
   non conformes sont ignorés, et une release marquée `prerelease` compte comme une préversion.
5. **Une fois par version.** « Plus tard », ou la fermeture de l'avis, le masque pour cette
   version, même après relance. Une version plus récente le fait revenir.
6. **Confiance minimale dans la réponse.** La page ouverte doit être exactement
   `https://github.com/jlallement/bobine/releases/tag/<étiquette>`. Elle est vérifiée par le main
   à la réception, puis de nouveau avant `shell.openExternal`, et le renderer ne passe qu'un numéro
   de version. Le nom et les notes de la release ne sont jamais rendus : seule l'étiquette validée
   s'affiche, comme du texte.
7. **Sobre.** L'avis est une ligne discrète de la barre latérale (option recommandée de la fiche
   274, à valider), jamais une fenêtre modale.

## Alternatives écartées

- **Mise à jour automatique (electron-updater, ou `autoUpdater`/Squirrel.Mac)** — Elle demande
  une app signée par un Developer ID, ce qui est écarté. electron-updater ajoute aussi une
  dépendance livrée (environ 8 paquets) et des fichiers à publier (`.zip`, `latest-mac.yml`). Sur
  un poste géré, elle se heurte aux droits d'installation. Les raisons de l'ADR-0023 tiennent
  toujours.
- **Vérification au clic seule** (« Vérifier maintenant » sans contrôle automatique) — Elle ne
  règle pas R5 : l'utilisateur qui ne sait pas qu'il est en retard ne cliquera pas. Le bouton est
  gardé, mais en plus.
- **Vérification désactivée par défaut** — Elle revient presque à la précédente : peu de gens
  activent un réglage qu'ils ne cherchent pas. La requête ne transmet rien de l'utilisateur (sa
  version et son adresse IP, que tout accès web montre), et le réglage la coupe en un geste.
- **Flux RSS ou Atom des Releases** (`releases.atom`) — C'est du XML à analyser, sans champ
  `draft` ni `prerelease` fiable. Il faudrait un analyseur XML (une dépendance, ou du code fragile)
  pour moins d'informations. L'API JSON donne directement étiquette, brouillon, préversion et
  adresse de la page.
- **Serveur à nous** (petit JSON hébergé, ou service de mises à jour) — Il faudrait un service à
  héberger, surveiller et sécuriser, et un point de plus qui voit les adresses IP des
  utilisateurs. GitHub publie déjà les versions, et c'est là que l'utilisateur les télécharge.
- **`releases/latest`** (un seul objet, piste de la fiche 187) — Il ignore les préversions : un
  testeur en rc ne serait jamais averti de la rc suivante. La liste (`/releases`) couvre les deux
  cas pour le même coût d'une requête.

## Conséquences

- Premier et seul appel réseau de Bobine qui ne vient pas d'un agent ni d'une action de
  l'utilisateur. Il doit le rester : aucune autre donnée ne passe par ce chemin. La FAQ des README
  et le guide des Réglages le disent (« pas de télémétrie » reste vrai).
- GitHub voit l'adresse IP et la version installée au plus une fois par jour et par Mac. La
  limite de 60 requêtes par heure et par adresse sans compte est très loin, même derrière un NAT
  d'entreprise, mais une erreur 403 ou 429 reste silencieuse.
- Un renommage du dépôt ou du compte casse la vérification sans bruit : la page attendue ne
  correspondrait plus. Il faudra alors une version qui porte la nouvelle adresse, et les anciennes
  versions resteront muettes.
- Les essais ne contactent jamais GitHub : un faux serveur local, et par défaut une adresse locale
  fermée pour toutes les suites e2e (`BOBINE_RELEASES_URL`, acceptée seulement vers `127.0.0.1` ou
  `localhost`).
- Quand l'app sera signée un jour, cette vérification sera la base de la deuxième alternative de
  l'ADR-0023 (installation par Squirrel.Mac). Il faudra alors un nouvel ADR.
