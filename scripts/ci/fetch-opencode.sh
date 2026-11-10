#!/usr/bin/env bash
# Télécharge la dernière release `vX.Y.Z` d'OpenCode (binaire Linux x64) et la vérifie avec le
# `SHA256SUMS` de la même release (fiche 198). Utilisé par `.github/workflows/opencode-probe.yml`.
# Chaque échec est dit (`::error::` dans GitHub Actions), jamais muet.
#
#   scripts/ci/fetch-opencode.sh <dossier> [tag]
#
# Écrit `<dossier>/opencode` et affiche le tag. Rien n'est exécuté ici.
set -uo pipefail

dir="${1:?dossier de destination}"
tag="${2:-}"
asset='opencode-linux-x64.tar.gz'
repo='anomalyco/opencode'

fail() {
  echo "::error::$1"
  exit 1
}

if [ -z "$tag" ]; then
  # Toutes branches confondues (1.x et 2.x sont publiées en parallèle) ; les autres releases du
  # dépôt (`process-daemon-…`) sont écartées.
  tags=$(gh release list --repo "$repo" --exclude-drafts --exclude-pre-releases --limit 50 \
    --json tagName --jq '.[].tagName') || fail "Releases d'OpenCode illisibles (gh release list)."
  tag=$(printf '%s\n' "$tags" | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1)
  [ -n "$tag" ] || fail "Aucune release vX.Y.Z d'OpenCode dans les 50 dernières."
fi
echo "OpenCode $tag"

mkdir -p "$dir" || fail "Dossier $dir impossible à créer."
gh release download "$tag" --repo "$repo" --dir "$dir" --clobber \
  --pattern "$asset" --pattern SHA256SUMS ||
  fail "Téléchargement de $tag impossible ($asset, SHA256SUMS)."
[ -f "$dir/$asset" ] || fail "$tag ne publie pas $asset."
[ -f "$dir/SHA256SUMS" ] || fail "$tag ne publie pas de SHA256SUMS : binaire non vérifiable."

# Ligne « somme  nom » ou « somme *nom » (mode binaire de sha256sum).
expected=$(awk -v name="$asset" '$2 == name || $2 == "*" name { print $1; exit }' "$dir/SHA256SUMS")
[ -n "$expected" ] || fail "SHA256SUMS de $tag sans ligne pour $asset."
if command -v sha256sum >/dev/null; then
  actual=$(sha256sum "$dir/$asset" | cut -d' ' -f1)
else
  actual=$(shasum -a 256 "$dir/$asset" | cut -d' ' -f1)
fi
[ "$expected" = "$actual" ] || fail "Somme de contrôle de $asset ($tag) : attendue $expected, obtenue $actual."

# Binaire à la racine de l'archive : `opencode` ou `./opencode`.
member=$(tar -tzf "$dir/$asset" | grep -E '^(\./)?opencode$' | head -1)
[ -n "$member" ] || fail "Archive $asset de $tag sans binaire opencode à la racine."
tar -xzf "$dir/$asset" -C "$dir" "$member" || fail "Extraction de $member impossible."
chmod +x "$dir/opencode" || fail "Binaire $dir/opencode absent après extraction."
