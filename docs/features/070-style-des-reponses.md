# 070 — Style des réponses : police de l'app, titres et traits sobres

- **Statut** : fait
- **Dépend de** : 003, 027
- **Agents** : les deux (mise en forme du Markdown envoyé par tout agent)

## Pourquoi

Retour de l'utilisateur sur une longue réponse très mise en forme (« # 🌍 Titre », « --- » entre
les parties) : « la police est nulle, le style des titres et du texte bizarre, ça ne va pas dans le
style de l'app ». L'agent n'envoie que du Markdown ; c'est l'app qui le met en forme, et ses titres
gardaient la taille du navigateur (un `#` à deux fois le texte), ses traits le double filet par
défaut, et le fil une police à empattements alors que toute l'app est en police système.

## Critères d'acceptation

- [x] Fil en police de l'app (système, sans empattements) par défaut, 15 px ; « À empattements »
      reste au choix (Réglages › Conversation), comme avant pour qui l'a choisie.
- [x] Titres à peine plus grands que le texte (h1 1,3 ×, h2 1,18 ×, h3 1,06 ×, h4–h6 1 ×),
      graisse 600 ; pas de double espace après un trait.
- [x] Trait `---` : une ligne fine de la couleur des bordures ; citation : filet à gauche, texte
      atténué ; listes imbriquées resserrées, puces atténuées ; cases à cocher sans puce en plus.
- [x] Testé : scénario `mise-en-forme` de l'agent factice ; e2e `tables` (police, proportions des
      titres, trait, citation, cases), `settings` (choix « À empattements » et taille), captures
      clair et sombre.

## Plan

1. Scénario `mise-en-forme` (agent factice) : titres avec émojis, traits, citation, listes
   imbriquées, cases, code, lien.
2. `styles.css` : titres h1–h6, `hr`, `blockquote`, listes, `strong`, cases à cocher ;
   `--conv-font` et `--conv-size` par défaut.
3. `preferences.ts` : `conversationFont: 'sans'`, `conversationFontSize: 15` par défaut ; ordre des
   choix dans Réglages › Conversation.
4. e2e `tables` (vérifications et capture `h1-mise-en-forme`), `settings` mis à jour.

Pas de nouvelle dépendance.

## Journal

- 2026-10-15 — Fait selon le plan. Capture « avant » prise avec l'ancien style (police
  `ui-serif`, h1 2 ×, h2 1,5 ×, trait `1px 1px inset`), puis « après » : toutes les vérifications
  passent. Un réglage déjà enregistré (police ou taille choisie par l'utilisateur) est gardé : seul
  le défaut change.
