# ADR-0024 — Continuer une conversation avec un autre agent : même conversation, nouvelle session, échange en texte

- **Statut** : accepté
- **Date** : 2026-10-21
- **Précise** : ADR-0021 (le fil de Bobine fait foi), ADR-0011 (générique d'abord)

## Contexte

Une conversation est liée à un agent (`profileId` de son enregistrement) et à une session de cet
agent. Changer d'agent dans une conversation commencée ouvrait une conversation **vide** : tout
était à réexpliquer. Or on veut pouvoir passer de Bob (facturé en bobcoins) à OpenCode avec un
modèle interne (gratuit), ou l'inverse, en un geste (audit du 2026-10-21, section 9, point 3).
ACP n'a aucun moyen de transmettre une session d'un agent à un autre ; Bob n'annonce pas
`session/fork`, et `session/fork` ne passe de toute façon pas d'un agent à l'autre.

## Décision

**La conversation reste la même ; son agent change ; une nouvelle session s'ouvre chez lui.**

- Le fil n'est pas touché (il fait foi, ADR-0021). Un élément `handover` y est posé : agent d'avant,
  agent d'après, modèle choisi. L'agent d'avant est arrêté ; sa session reste chez lui (Bobine ne la
  supprime pas).
- L'échange d'avant part **en texte**, dans le bloc placé avant le prochain message de l'utilisateur
  (comme le contexte d'une branche, fiche 023, et les nouvelles des filles, fiche 097). Il se déduit
  du fil : « dernière bascule qu'aucun message de l'utilisateur ne suit ». Rien n'est tenu à part ;
  un redémarrage entre la bascule et le message ne perd rien. Rien ne part avant ce message.
- Le modèle choisi est réglé par le réglage ACP de catégorie `model`, s'il existe (OpenCode) ;
  sinon l'agent garde le sien (Bob, qui n'en expose pas). Aucun `_meta`, aucune option ni drapeau
  propre à un agent.
- La réconciliation du rejeu (ADR-0021) ne compte que les messages d'après la dernière bascule : ceux
  d'avant appartiennent à une autre session.
- La consommation affichée (contexte, coût de la session) repart de zéro à la bascule.

## Alternatives écartées

- **Conversation fille** (ADR-0019) — une fille tourne dans un autre worktree et rend compte à sa
  mère : c'est du travail en parallèle, pas une suite. Le même travail se retrouverait sur deux
  lignes de la liste, dans deux dossiers.
- **Branche** (fiche 023) — duplique le fil dans une nouvelle conversation : même dispersion, et
  l'originale, devenue inutile, reste à archiver à la main.
- **Envoyer l'échange tout de suite** (un tour « voici le contexte ») — coûte un tour (des bobcoins
  vers Bob) sans rien demander, et la réponse de l'agent à ce tour n'apporte rien.
- **Mémoriser « contexte à envoyer »** dans l'enregistrement — un état de plus à garder cohérent
  (branche, redémarrage, file d'attente) quand le fil suffit à le déduire.

## Conséquences

- Une conversation peut avoir eu plusieurs agents ; seul le dernier est dans son enregistrement. Les
  sessions des agents d'avant ne sont pas supprimées avec la conversation (« Supprimer aussi chez
  l'agent » ne vise que la session en cours).
- L'agent d'après ne reçoit qu'un résumé des outils (titre, statut, fichiers touchés), pas leurs
  résultats : il relit les fichiers s'il en a besoin. Le texte est borné à 60 000 caractères (le
  début est omis au-delà).
- Branche juste après une bascule : la bascule n'est pas reprise, le contexte de la branche porte
  déjà tout l'échange (il ne part pas deux fois).
