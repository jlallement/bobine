#!/usr/bin/env bash
# Dans le conteneur (voir `scripts/e2e-linux`) : sources copiées de /src (le dépôt du Mac, monté en
# lecture seule) vers ~/work, dépendances Linux, node-pty compilé, build, puis les essais sous xvfb
# avec openbox. Les captures vont dans /captures (e2e/captures/linux/ du Mac).
set -euo pipefail

work="$HOME/work"
mkdir -p "$work"
# Ce qui appartient à la machine (dépendances, build, captures, état des essais) n'est ni copié ni
# effacé : --delete ne touche pas aux chemins exclus.
rsync -a --delete \
  --exclude=/.git --exclude=/node_modules --exclude=/out --exclude=/dist --exclude=/coverage \
  --exclude=/e2e/captures --exclude=/e2e/.last-green.json --exclude=/e2e/.durations.json \
  --exclude=/.pilote --exclude=/vendor/axe --exclude=/.claude \
  /src/ "$work/"
cd "$work"
ln -sfn /captures e2e/captures

pnpm install --frozen-lockfile
# Pas de binaire précompilé de node-pty pour Linux (fiche 145, D3) : compilé comme dans ci.yml.
if [[ ! -f node_modules/node-pty/build/Release/pty.node ]]; then
  (cd node_modules/node-pty && npx --yes node-gyp@12 rebuild && node scripts/post-install.js)
fi

git config --global user.name >/dev/null || git config --global user.name "Bobine e2e"
git config --global user.email >/dev/null || git config --global user.email "e2e@localhost"

pnpm build
exec xvfb-run -a -s "-screen 0 1920x1200x24" scripts/with-wm pnpm e2e "$@"
