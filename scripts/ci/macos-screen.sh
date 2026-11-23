#!/usr/bin/env bash
# Agrandit l'écran d'un runner macOS de GitHub avant les essais de bout en bout (fiche 250).
#
# Pourquoi : l'écran du runner `macos-15` fait 1024 × 768. La fenêtre de l'app (1280 × 820 par
# défaut) y est ramenée à 1024 × 688, et une quarantaine de suites qui supposent la taille
# habituelle tombent chaque nuit (`startup`, `panel`, `session`, `composer`…), loin de la cause.
# On change donc le mode de l'écran avec `displayplacer` (Homebrew officiel, formule
# `homebrew/core`, licence MIT), puis on VÉRIFIE ce que macOS donne vraiment aux fenêtres : si la
# zone utile ne contient pas la fenêtre par défaut, le job s'arrête ici, rouge, avec la liste des
# modes offerts, plutôt que de laisser les suites échouer une à une.
#
#   scripts/ci/macos-screen.sh            installe displayplacer, change le mode, vérifie
#   scripts/ci/macos-screen.sh --verifier vérifie seulement (zone utile de l'écran principal)
#   scripts/ci/macos-screen.sh --choisir  lit la sortie de `displayplacer list` sur l'entrée
#                                         standard et écrit « <id> <mode> <largeur>x<hauteur> »
#
# Rien n'est téléchargé hors de Homebrew (bouteille vérifiée par sa somme SHA-256), rien
# n'est exécuté depuis une URL.
set -uo pipefail

# Version de la formule relue (homebrew/core, 2026-11-23). Une autre version arrête le job :
# on la relit avant de changer cette ligne.
DISPLAYPLACER_VERSION='1.4.0'
# Mode visé (points, pas pixels) ; à défaut, le plus grand mode offert.
TARGET='1920x1080'
# Fenêtre par défaut de l'app (`createMainBrowserWindow`) : la zone utile (sans la barre des menus
# ni le Dock) doit la contenir, sinon macOS la réduit.
NEED_W=1280
NEED_H=820

fail() {
  echo "::error::$1"
  exit 1
}

# Sortie de `displayplacer list` → « <id> <mode> <largeur>x<hauteur> » pour l'écran principal :
# le mode TARGET s'il existe (sans mise à l'échelle de préférence), sinon le plus grand.
choose_mode() {
  awk -v target="$TARGET" '
    /^Persistent screen id:/ { id = $4; main = 0; next }
    /^Origin:.*main display/ { main = 1; mainId = id; next }
    main && /^[ \t]*mode [0-9]+: res:[0-9]+x[0-9]+/ {
      n = $2; sub(":", "", n)
      res = $3; sub("res:", "", res)
      split(res, wh, "x"); area = wh[1] * wh[2]
      scaled = ($0 ~ /scaling:on/)
      if (res == target && (best == "" || bestRes != target || (bestScaled && !scaled))) {
        best = n; bestRes = res; bestArea = area; bestScaled = scaled
      } else if (bestRes != target && (best == "" || area > bestArea || (area == bestArea && bestScaled && !scaled))) {
        best = n; bestRes = res; bestArea = area; bestScaled = scaled
      }
    }
    END { if (mainId != "" && best != "") print mainId, best, bestRes; else exit 1 }
  '
}

# Zone utile de l'écran principal, en points, comme l'app la reçoit (`screen.workArea` d'Electron
# = `NSScreen.visibleFrame`) : « <écran l>x<h> <utile l>x<h> ».
screen_sizes() {
  osascript -l JavaScript -e '
    ObjC.import("AppKit")
    var s = $.NSScreen.mainScreen
    var f = s.frame
    var v = s.visibleFrame
    f.size.width + "x" + f.size.height + " " + v.size.width + "x" + v.size.height'
}

verify() {
  local sizes frame visible w h
  sizes=$(screen_sizes) || fail "Taille de l'écran illisible (osascript, NSScreen)."
  read -r frame visible <<< "$sizes"
  w=${visible%x*}
  h=${visible#*x}
  w=${w%.*}
  h=${h%.*}
  echo "Écran principal : ${frame} points ; zone utile (sans barre des menus ni Dock) : ${visible}."
  if ((w < NEED_W || h < NEED_H)); then
    fail "Écran trop petit pour les essais : zone utile ${visible}, il faut au moins ${NEED_W}x${NEED_H} (fenêtre par défaut de l'app). Le mode de l'écran n'a pas changé ; voir les modes offerts plus haut (fiche 250)."
  fi
}

case "${1:-}" in
  --choisir)
    choose_mode || fail "Aucun mode trouvé pour l'écran principal dans la sortie de displayplacer list."
    exit 0
    ;;
  --verifier)
    verify
    exit 0
    ;;
  '') ;;
  *) fail "Option inconnue : $1 (--choisir, --verifier)." ;;
esac

echo "::group::Avant : system_profiler SPDisplaysDataType"
system_profiler SPDisplaysDataType
echo "::endgroup::"

# Pas de mise à jour de Homebrew pendant l'installation : seulement displayplacer.
export HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_UPGRADE=1 HOMEBREW_NO_INSTALLED_DEPENDENTS_CHECK=1
brew install displayplacer || fail "Installation de displayplacer (Homebrew) impossible."
version=$(brew list --versions displayplacer | awk '{ print $2 }')
[ "$version" = "$DISPLAYPLACER_VERSION" ] ||
  fail "displayplacer ${version:-absent} installé, ${DISPLAYPLACER_VERSION} attendu : relire la nouvelle version, puis changer DISPLAYPLACER_VERSION dans scripts/ci/macos-screen.sh."

list=$(displayplacer list) || fail "displayplacer list a échoué."
echo "::group::Modes offerts : displayplacer list"
printf '%s\n' "$list"
echo "::endgroup::"

choice=$(printf '%s\n' "$list" | choose_mode) ||
  fail "Aucun mode trouvé pour l'écran principal (voir displayplacer list plus haut)."
read -r id mode res <<< "$choice"
echo "Mode choisi : ${mode} (${res}) pour l'écran ${id}."
# displayplacer peut finir à 0 sans avoir changé le mode : seule la vérification qui suit compte.
displayplacer "id:${id} mode:${mode} origin:(0,0) degree:0" ||
  echo "::warning::displayplacer a fini en erreur ; on vérifie quand même la taille obtenue."
sleep 2

echo "::group::Après : system_profiler SPDisplaysDataType"
system_profiler SPDisplaysDataType
echo "::endgroup::"
verify
