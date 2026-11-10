# 046 — Recherche dans le contenu sans charger tous les fils en mémoire

- **Statut** : fait
- **Dépend de** : 026, 043

## Pourquoi

Revue du 2026-10-14 : la recherche dans le contenu (⌘K, fiche 026) appelait `transcriptOf` sur
toutes les conversations. Chaque fil était lu en synchrone (`readFileSync` + `JSON.parse`) dans le
main process, puis gardé en mémoire pour toujours. La première recherche figeait donc le main
(flux de l'agent, IPC, serveur MCP) et défaisait le chargement à la demande de la fiche 043. Plus
largement, un fil chargé n'était jamais libéré : il suffisait de parcourir l'historique pour que
la mémoire ne fasse que monter.

## Critères d'acceptation

- [x] La recherche est asynchrone : un fil qui n'est pas en mémoire est lu sur le disque sans
      bloquer la boucle d'évènements entre deux fichiers, et **n'est pas gardé** ; seul son texte
      cherchable l'est, dans un cache borné, invalidé quand le fichier change (taille, date).
- [x] Une conversation ouverte est cherchée dans sa version en mémoire (la plus fraîche).
- [x] Deux recherches simultanées ne lisent pas deux fois le même fichier ; une recherche répétée
      ne relit aucun fichier inchangé (tant que le cache peut les garder).
- [x] Une recherche ne replie plus (casse, accents) le contenu à chaque frappe : texte plié gardé
      en cache, pliage plus rapide (ajouté en cours de route, voir journal).
- [x] Un fil abîmé est ignoré par la recherche (ni mis de côté ni signalé : c'est le rôle de
      l'ouverture de la conversation).
- [x] Les fils des conversations ni affichées, ni rattachées à un agent vivant, ni en cours
      d'écriture sont libérés au-delà des 4 lus le plus récemment, puis relus à la demande.
- [x] Aucune perte : un fil n'est jamais libéré tant qu'une écriture est prévue, en cours ou en
      échec ; après libération, le fil relu est identique.
- [x] Testé contre l'agent factice (conversations réelles, agent évincé) et par un test de charge
      (fils de plusieurs Mo, écart maximal de la boucle d'évènements mesuré).
- [x] e2e `history` (recherche ⌘K) vert.

## Plan

1. `store.ts` : `readTranscriptAsync(id)` (lecture asynchrone, sans mise de côté) et
   `transcriptStamp(id)` (taille + date de modification, `undefined` si absent).
2. `content-search.ts` : `search` asynchrone ; fil en mémoire si fourni, sinon texte lu sur le
   disque par une source injectée ; cache de textes par conversation (empreinte, LRU borné en
   caractères), lectures en cours partagées ; `forget(id)`.
3. `history-writer.ts` : suivi par fil (écritures en cours, dernière écriture en échec),
   `idle(id)`, rappel `onIdle(id)` quand le fil est à jour sur le disque.
4. `manager.ts` : `search` asynchrone qui ne charge plus rien ; `readAt` par conversation ;
   `releaseTranscripts()` (sélection, ouverture côte à côte, fermeture, archivage, éviction d'un
   agent, fin d'écriture) ; option `maxIdleTranscripts` (défaut 4) ; `loadedTranscripts()` pour
   les tests ; `forget` à la suppression.
5. `ipc.ts` : le canal `conversations:search` attend la promesse (contrat inchangé).
6. Tests : `content-search.test.ts` (cache, invalidation, lectures partagées, fil abîmé),
   `history-writer.test.ts` (`idle`, échec), `manager.test.ts` (recherche sans rétention, test de
   charge, libération et relecture identique, aucune libération pendant une écriture).

Aucune nouvelle dépendance. Un worker pour `JSON.parse` a été envisagé : écarté si le test de
charge montre des écarts acceptables (une seule lecture par fichier modifié, ensuite le cache).

## Journal

- 2026-10-14 — Fiche créée après la revue du projet ; plan validé avec l'utilisateur (chantiers
  046, puis 047 et 048, l'un après l'autre, sans worktree).
- 2026-10-14 — **Fait.**
  - `store.ts` : `readTranscriptAsync` (aucune mise de côté), `transcriptStamp` (taille + date).
  - `content-search.ts` : recherche asynchrone ; fil en mémoire si la conversation est ouverte,
    sinon lu sur le disque et **non gardé** ; texte cherchable (et plié) en cache par empreinte,
    lectures en cours partagées, `forget` à la suppression.
  - `history-writer.ts` : `idle(id)` (ni écriture prévue, ni en cours, ni en échec) et `onIdle`.
  - `manager.ts` : `search` asynchrone qui ne charge rien ; `releaseTranscripts()` appelé à la
    sélection, à l'ouverture et la fermeture côte à côte, à l'archivage, à l'éviction d'un agent, au
    chargement d'un fil et à la fin d'une écriture ; `maxIdleTranscripts` (4) ;
    `loadedTranscripts()` pour les tests.
  - **Trouvé en route** (antérieur à cette fiche) : le vrai coût n'était pas la lecture
    (`JSON.parse` d'un fil de 1 Mo : 0,4 ms) mais le pliage des accents `foldSameLength`, ≈ 140 ms
    par Mo de texte, **refait à chaque recherche** pour toutes les conversations : avec 10 Mo de
    texte dans l'historique, chaque frappe dans ⌘K figeait le main ≈ 1,4 s. Corrigé : passages
    ASCII pliés d'un bloc, pliage des autres caractères mémorisé (≈ 8 à 18 ms par Mo, résultat
    identique, test d'équivalence sur des textes variés : ligatures, coréen, emoji, surrogat
    seul…) ; texte plié gardé avec le texte (`matchContent` accepte le pli déjà fait), donc une
    recherche répétée ne replie rien (≈ 2 ms par Mo).
  - **Écart au plan** : cache « résistant au parcours » plutôt qu'un LRU simple. Un LRU se chassait
    lui-même dès que l'historique dépassait le cache (chaque recherche relisait tout) ; désormais
    les textes de la recherche en cours ne s'évincent pas entre eux, la place est prise aux
    recherches précédentes, et les conversations les plus récentes (parcourues d'abord) restent.
    Le cache compte le texte et le texte plié (16 M caractères au total).
  - **Mesures** (test de charge de `manager.test.ts`, 10 fils de 0,7 Mo de texte) : écart
    maximal de la boucle d'évènements pendant une première recherche ≈ 16 ms (seuil du test :
    100 ms) ; avant le pliage rapide, ≈ 130 ms avec des fils de 1 Mo. Deuxième recherche : aucune
    lecture de fichier. Worker pour `JSON.parse` : inutile.
  - Tests : `content-search.test.ts` (5), `history-writer.test.ts` (`idle`, échec puis succès),
    `conversation-search.test.ts` (équivalence du pliage), `manager.test.ts` (recherche sans
    rétention + charge ; agent factice : fil libéré après éviction de l'agent puis relu identique,
    jamais libéré tant que l'écriture échoue — dossier en lecture seule — et écrit à la fermeture).
    `./scripts/verify` vert (549 tests) ; `pnpm e2e history` vert (clair et sombre).
  - Reste : la lecture d'un fil à l'ouverture d'une conversation est toujours synchrone (non
    mesurée sur un très gros fil) ; à reprendre seulement si ça se voit.
