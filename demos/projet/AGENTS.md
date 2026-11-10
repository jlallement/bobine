# La Bobinette — consignes

- Réponds en français.
- `site/` : le site du café. Il se lance avec la configuration `site` de `.bob/launch.json`
  (outil `preview_start` de Bobine) et s'ouvre sur http://localhost:8765. Depuis l'émulateur
  Android, la même adresse est http://10.0.2.2:8765 ; depuis le simulateur iOS,
  http://localhost:8765.
- `calculs/` : calculs du panier en Python, tests avec `python3 -m unittest discover -s calculs -v`.
- `apps/ios/` : app SwiftUI « Pastilles » (projet `apps/ios/Pastilles.xcodeproj`, schéma `Pastilles`, bundle
  `fr.bobine.pastilles`).
- `apps/android/` : la même app en Java (projet Gradle `apps/android/`, module `app`, package
  `fr.bobine.pastilles`).
