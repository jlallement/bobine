# ADR-0065 — Une vue des fichiers à la demande, comme Claude Code ; lecture seule d'abord

- **Statut** : accepté (fiche 271)
- **Date** : 2026-11-20
- **Remplace en partie** : la règle de périmètre « pas d'explorateur de projet »
  (`docs/features/README.md`, Périmètre ; fiche 052), qui n'était pas un ADR. « Pas d'éditeur de
  fichiers » est **maintenu** : lecture seule d'abord (décision de l'utilisateur du 2026-11-20),
  l'édition légère seulement si elle manque, par un nouvel ADR.

## Contexte

Les utilisateurs veulent voir les fichiers et les ressources du dossier de travail, « dans
l'esprit de Claude Code […], pas de manière centrale » (l'utilisateur, 2026-11-20). Aujourd'hui,
un fichier ne se voit que s'il passe par la conversation (lien, modification, `@`) ou par git ;
le reste demande le Finder ou l'éditeur.

Claude Code (relevé sur l'app de bureau, cinq photos) offre un onglet Fichiers dans le panneau de
droite : filtre, arbre complet, ⌘P, ⇧⌘Y, fichier ouvert dans l'onglet avec fil d'Ariane et
coloration, commentaire sur une ligne, agrandi avec l'arbre de côté ; il permet aussi d'éditer.

Les réponses de l'utilisateur aux questions de la fiche (`docs/features/271-questions.md`) fixent
le reste.

## Décision

1. Bobine montre les fichiers des dossiers de la conversation dans un **onglet « Fichiers » du
   panneau, ouvert à la demande** (menu « + », ⌘P qui met le curseur dans le filtre, ⇧⌘Y, lien
   de fichier du fil) : jamais d'office, jamais une colonne permanente, jamais un fichier dans la
   zone de la conversation. Pas de palette de fichiers.
2. Un fichier s'y ouvre **en lecture seule** (fil d'Ariane, numéros, coloration syntaxique par
   highlight.js et les jetons `--syn-*` déjà livrés ; Markdown rendu avec une bascule « Source » ;
   images ; HTML en source, ouvert à la demande dans le navigateur intégré ; le reste dans l'app par
   défaut ou l'éditeur de l'utilisateur). L'onglet Aperçu de la fiche 052 est remplacé par lui.
3. Une remarque posée sur une ou plusieurs lignes est une remarque de diff (fiche 085) : elle part
   vers l'agent avec les autres, par « Envoyer à l'agent », jamais seule.
4. **Le main seul lit le disque** : le renderer demande `(conversation, racine, chemin relatif)` ;
   le main résout le chemin réel, refuse ce qui sort des dossiers de la conversation (liens
   symboliques compris), borne tailles et nombres, ne note jamais le contenu au journal.
5. **Les fichiers de secret s'affichent comme les autres** (`.env`, clés) : décision de
   l'utilisateur, plus simple et fidèle à Claude Code. Les essais et les captures n'utilisent que
   des valeurs factices.
6. **Pas de surveillance continue** : relecture à la fin des outils et des tours, au retour sur la
   fenêtre et à la demande.
7. Aucune écriture de fichier par l'interface (édition, création, renommage, déplacement,
   suppression). Une édition légère, comme celle de Claude Code, demandera un nouvel ADR qui dise
   comment elle traite les écritures concurrentes de l'agent et l'annulation.

## Alternatives écartées

- **Palette ⌘P seule, sans arbre** — on ne voit que ce qu'on sait nommer ; l'utilisateur l'a
  écartée, y compris en complément de l'onglet.
- **Explorateur permanent et éditeur au centre** (modèle « IDE d'abord », Bob IDE) — refusé par
  l'utilisateur.
- **Édition dès la première version** (comme Claude Code) — reportée : conflits d'écriture avec
  l'agent, annulation, nouvelle dépendance (CodeMirror 6), pente vers l'IDE.
- **Secret listé sans être affiché** — proposé, écarté par l'utilisateur (question Q8).

## Conséquences

- \+ Retrouver, regarder, commenter, ouvrir ailleurs sans quitter la conversation.
- \+ Aucune dépendance nouvelle ; aucun conflit d'écriture avec l'agent.
- − Corriger une ligne demande l'éditeur ou l'agent.
- − Une écriture faite hors d'un tour n'apparaît qu'au retour sur la fenêtre ou par « Relire ».
- − Un PDF ne s'affiche pas dans l'app.
- − Un secret peut apparaître sur un écran partagé ou une capture : c'est assumé ; les captures
  de Bobine (e2e, vitrine, guide) n'en contiennent que de factices.
- À surveiller : si l'édition manque à l'usage, un nouvel ADR (option B′ de la fiche 271).
