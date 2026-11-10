# 033 — Émulateur Android : flux vidéo fluide

- **Statut** : fait
- **Dépend de** : 032

## Pourquoi

Comme la fiche 009 pour iOS : suivre animations et transitions, et interagir directement.

## Critères d'acceptation

- [x] Flux vidéo dans le panneau (≥ 15 images/s : 50 relevées) ; clic → toucher. Molette → défilement : non fait.
- [x] Repli sur les captures si le flux échoue.
- [x] Testé : essai réel ; e2e (extrait H.264 réel rejoué).

## Notes

Pistes : `adb exec-out screenrecord --output-format=h264 -` décodé dans le renderer, ou scrcpy
(nouvelle dépendance, à justifier).

## Plan

À remplir avant de coder.

## Journal

- 2026-10-11 — Fiche créée (inventaire calqué sur Claude Code Desktop, à trier).
- 2026-10-12 — Livré avec la fiche 032 : `screenrecord --output-format=h264` (aucune dépendance),
  découpé en images dans le main (`h264.ts`), décodé par WebCodecs dans l'onglet ; relancé tout seul
  à la limite de durée de `screenrecord`. 50 images/s relevées.
