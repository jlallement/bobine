# ADR-0051 — Linux en préversion : `.deb` seul, sans AppImage

- **Statut** : accepté (décision de Jérôme le 2026-11-15 : « .deb seul »)
- **Date** : 2026-11-15
- **Remplace** : le point « Formats (D1) : AppImage et `.deb` » d'[ADR-0032](0032-bobine-multiplateforme.md)
  (le reste d'ADR-0032 vaut toujours)

## Contexte

ADR-0032 (D1 de la fiche 145) livrait Linux en AppImage et en `.deb`. L'essai réel sur Ubuntu
récent (VM 26.04 ARM64, fiche 145, 2026-11-15) a montré l'AppImage inutilisable sans
manipulation :

- **Bac à sable de Chromium** : depuis Ubuntu 24.04, AppArmor refuse les espaces de noms
  utilisateur aux programmes sans profil (`kernel.apparmor_restrict_unprivileged_userns = 1`).
  Le `.deb` installe un profil pour `/opt/Bobine/bobine` (`/etc/apparmor.d/bobine`, posé par
  electron-builder) ; une AppImage est montée à un chemin temporaire, qu'aucun profil ne vise : le
  bac à sable ne démarre pas. Les seules issues seraient `--no-sandbox` (refusé, jamais) ou un
  réglage du système par l'utilisateur, avec des droits d'administrateur.
- **FUSE et bibliothèques** : une AppImage demande `libfuse2` (absente d'une installation neuve
  d'Ubuntu 24.04), et son lanceur cherchait `libz.so` (paquet de développement).

L'argument d'origine de l'AppImage (« partout, sans droits ») ne tient donc plus sur la
distribution visée (D6), et le `.deb` s'installe en une commande.

## Décision

La préversion Linux ne produit et ne publie que le **`.deb`**, en x64 et arm64 (D2 inchangée) :
`electron-builder.yml` (`linux.target: deb`), `pnpm package --linux`, `release.yml` (artefacts,
sommes SHA-256 `SHA256SUMS-linux-<arch>.txt` du seul `.deb`). L'AppImage pourra revenir si on la
demande, avec une réponse au bac à sable qui ne passe pas par `--no-sandbox`.

## Alternatives écartées

- **Garder l'AppImage en disant « réglez AppArmor »** — demande des droits d'administrateur et
  affaiblit le système pour tous les programmes : pire que le `.deb`, qui en demande une fois.
- **AppImage avec `--no-sandbox`** — refusé (Chromium sans bac à sable lit des pages web).
- **Flatpak, Snap** — déjà écartés par D1 (bac à sable qui empêche de lancer agents, terminal, git).

## Conséquences

- Installer Bobine sous Linux demande `sudo` (`sudo apt install ./Bobine-<version>-<arch>.deb`) ;
  pas d'installation sans droits d'administrateur sous Linux pour l'instant.
- Distributions sans `apt` (Fedora…) : pas de paquet ; les sources restent (`pnpm package --linux`
  construit le `.deb`, `dist/linux-*-unpacked` pour essayer). `.rpm` plus tard si on le demande.
- Rien ne change sur macOS ni sous Windows.
