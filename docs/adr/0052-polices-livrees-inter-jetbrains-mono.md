# ADR-0052 — Polices livrées : Inter et JetBrains Mono sur les trois systèmes

- **Statut** : accepté (Jérôme, 2026-11-15 : option C, « embarque aussi pour le mac, je ne vois pas
  pk on ne le ferait pas de la meme maniere »)
- **Date** : 2026-11-15
- **Fiche** : [145](../features/145-preversion-linux.md), décision D9

## Contexte

L'interface prenait les polices du système par des familles génériques : SF Pro et SF Mono sur
macOS, mais DejaVu Sans sur beaucoup de Linux (plus large : boutons qui bougent, en-têtes étroits,
retours à la ligne, relevés par les e2e Linux) et Segoe UI sous Windows. Le même écran n'avait pas
la même largeur d'un système à l'autre, et ce qui tenait sur le Mac débordait ailleurs.

## Décision

Bobine livre ses polices et les utilise par défaut **sur macOS, Linux et Windows** : **Inter**
(rsms/inter 4.1, variable) pour l'interface et **JetBrains Mono** (2.304 : 400 à 700 et italique)
pour le code et les diffs. Fichiers `woff2` publiés, non modifiés, chargés depuis l'app (aucun
réseau), licence OFL 1.1 livrée et citée dans les avis. Les polices du système restent en repli et
au choix dans Réglages › Apparence ; le terminal garde la sienne (MesloLGS Nerd Font pour les
icônes). Les ligatures sont coupées : dans le texte (Inter dessinerait `=>` en flèche) et, par
défaut, dans le code, où un réglage les active.

## Alternatives écartées

- **Polices du système partout** (avant) — largeurs différentes selon le système, débordements
  sous Linux ; corriger chaque écran pour la police la plus large ne garantit rien pour la suivante.
- **Polices livrées hors macOS seulement** (option B, mise en œuvre puis remplacée le même jour) —
  deux apparences à maintenir et à vérifier, une capacité de plateforme de plus pour un choix de
  style ; Jérôme ne voyait pas de raison de traiter le Mac à part.

## Conséquences

- Changement d'apparence voulu sur le Mac : captures e2e et vitrine à refaire ; les préférences
  `sans` (réponses) et `system` (code) désignent désormais Inter et JetBrains Mono ; « Système
  (sans serif) » (`system-sans`) et « Chasse fixe du système » (`system-mono`) rendent SF Pro et
  SF Mono.
- ≈ 820 Ko de plus dans chaque paquet ; les contrôles des paquets (`e2e:packaged`, `.deb`,
  Windows) vérifient la présence des polices et de leurs licences.
- Une mise à jour d'Inter ou de JetBrains Mono : nouveaux fichiers publiés, empreintes vérifiées
  contre le dépôt au tag, avis de licence régénérés (`pnpm third-party-notices`).
- Les e2e ne doivent plus supposer les métriques de SF Pro.
