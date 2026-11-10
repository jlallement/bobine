# ADR-0025 — Journal de consommation en SQLite (`node:sqlite`), séparé du fil

- **Statut** : accepté (format choisi par Jérôme le 2026-10-23, relecture des maquettes)
- **Date** : 2026-10-23
- **Précise** : ADR-0021 (le fil de Bobine fait foi), ADR-0024 (continuer avec un autre agent),
  ADR-0015 (coût hors protocole dans le profil)

## Contexte

La consommation d'une conversation vit dans son fil (`TranscriptState.usage`, fiches 019 et 109) :
cumul, et détail des 100 derniers tours. C'est fait pour afficher **une** conversation. Le tableau
de consommation à venir (fiche 137) demande autre chose : des totaux par jour, par agent, par
modèle et par projet, sur des semaines. Le fil ne s'y prête pas :

- supprimer une conversation supprime sa consommation ; passer à un autre agent la remet à zéro
  (ADR-0024) ;
- le détail par tour est borné à 100 tours, et le modèle n'y figure pas ;
- répondre à « combien cette semaine avec tel modèle » obligerait à relire tous les fils.

Chaque jour sans collecte est perdu : il faut décider du format maintenant, avant l'interface.

## Décision

**Une base SQLite par utilisateur, `userData/usage.sqlite`, ouverte par `node:sqlite` dans le main
process, avec une ligne par tour terminé. Elle est écrite à partir du flux d'évènements du
gestionnaire de conversations, jamais à partir du fil, et rien n'y est supprimé avec une
conversation.**

- Une table `turns` ; identifiant stable `<conversation>:<début du tour en ms>` ; heures en
  millisecondes UTC (le découpage par jour se fait à la lecture, dans le fuseau de l'utilisateur).
- Coût : montant **et** unité sur chaque ligne ; des unités différentes ne s'additionnent jamais ;
  aucun prix n'est estimé (fiche 019). Une valeur que l'agent ne donne pas reste `NULL`.
- Un coût connu après la fin du tour (Bob l'écrit dans sa base juste après sa réponse) réécrit la
  ligne du même tour.
- Schéma versionné par `PRAGMA user_version`, migrations en tête du module ; mode WAL.
- Ouverture tolérante : une base illisible est journalisée, mise de côté
  (`usage.sqlite.broken-<date>`) et recréée ; une base d'une version plus récente de l'app n'est
  jamais touchée (journal muet) ; en dernier recours, le journal se tait. Il ne fait jamais tomber
  l'app.
- Le journal reste local : ni l'export de Diagnostic ni un signalement n'en contiennent quoi que ce
  soit (il porte les chemins des dossiers).

### Ce qui fait foi pour quoi

| Question | Fait foi | Pourquoi |
|---|---|---|
| Ce qui s'est dit dans une conversation, et sa consommation affichée (puce, cartes des filles) | **Le fil** (ADR-0021) | Il est ce que l'utilisateur voit ; il suit les branches, le rejeu, la bascule d'agent |
| La consommation dans le temps (par jour, agent, modèle, projet), y compris des conversations supprimées ou passées à un autre agent | **Le journal** | Il ne perd rien et se lit par requête |
| Le quota de Bob (plafond, consommation sur toutes les machines) | **Le serveur de Bob**, par `/status` (ADR-0017) | Le journal ne connaît que ce Mac |

Les deux sources lisent les mêmes évènements ; elles peuvent diverger sans que l'une corrige
l'autre : un fil dont on a supprimé la conversation, une conversation d'avant le journal (reprise
une seule fois depuis les fils en fiche 137, l'identifiant évite les doublons), une session
continuée hors de Bobine (le journal ne voit que les tours faits dans Bobine).

## Alternatives écartées

- **Un fichier JSONL par mois** — simple à écrire, mais chaque requête du tableau relit et regroupe
  tout en mémoire ; mettre à jour le coût d'un tour après coup oblige à réécrire le fichier ou à
  ajouter une ligne correctrice à fusionner à la lecture ; un fichier tronqué par un arrêt brutal
  est à réparer à la main. SQLite donne les requêtes par période, agent et modèle, la mise à jour
  d'une ligne et la tenue aux arrêts (WAL) sans rien écrire.
- **Garder tout dans le fil** (lever la limite de 100 tours, ajouter le modèle) — ne survit ni à la
  suppression ni à la bascule d'agent, et le tableau devrait relire tous les fils.
- **Un résumé de plus dans l'index des conversations** (`index.json`) — même défaut à la
  suppression, et pas de découpage par jour ou par modèle.
- **Une dépendance SQLite** (`better-sqlite3`) — module natif à recompiler pour Electron ;
  `node:sqlite` est déjà dans le runtime et déjà utilisé pour lire la base de Bob (`bob-costs.ts`).

## Conséquences

- Une seconde source de vérité, bornée à la consommation ; le tableau (fiche 137) ne lit que le
  journal, la puce d'une conversation ne lit que le fil.
- `node:sqlite` est encore marqué expérimental dans Node : à chaque montée d'Electron, les tests
  du journal (`src/main/usage/*.test.ts`) le vérifient. S'il disparaissait, seul `usage-db.ts`
  serait à remplacer.
- La base grossit d'une ligne par tour (quelques centaines d'octets) : aucune purge prévue ;
  « Remettre à zéro » viendra avec le tableau (fiche 137).
- Toute évolution du schéma passe par une migration numérotée ; une base plus récente que l'app
  n'est jamais réécrite.
