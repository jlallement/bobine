# Essais de bout en bout sous Linux, en local (fiche 145) : `pnpm e2e:linux [suites…]`.
# Ubuntu 24.04 (cible D6), node 24, pnpm par corepack, outils de compilation de node-pty, écran
# virtuel (xvfb) avec un gestionnaire de fenêtres léger (openbox), bibliothèques d'Electron.
# Rien du dépôt n'est copié dans l'image : les sources arrivent au lancement (`entrypoint.sh`).
# Image épinglée par digest (index multi-architecture, relevé le 2026-11-19, fiche 252) ; Dependabot
# (écosystème `docker`) propose la mise à jour du digest.
FROM ubuntu:24.04@sha256:73b999393d07f2bf65a40373778a44dc9a6d54ad7718d29247d8ff9413c4d6a8

ARG NODE_MAJOR=24
ARG PNPM_VERSION

# SHELL : posé par toute session Linux (et par la machine de GitHub) ; sans lui, l'app retombe sur
# /bin/zsh, absent ici.
ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    SHELL=/bin/bash \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl xz-utils git rsync procps \
      build-essential python3 \
      xvfb xauth openbox x11-utils \
      libgtk-3-0t64 libnss3 libasound2t64 libgbm1 libxss1 libxtst6 libatk-bridge2.0-0t64 \
      libdrm2 libxkbcommon0 libxshmfence1 libcups2t64 libsecret-1-0 libnotify4 xdg-utils \
      fonts-dejavu-core fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# node : archive officielle de nodejs.org, somme SHA-256 vérifiée.
RUN set -eu; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in amd64) arch=x64 ;; arm64) arch=arm64 ;; *) echo "architecture $arch" >&2; exit 1 ;; esac; \
    base="https://nodejs.org/dist/latest-v${NODE_MAJOR}.x"; \
    cd /tmp; \
    curl -fsSLO "$base/SHASUMS256.txt"; \
    file="$(grep -o "node-v[0-9.]*-linux-${arch}\.tar\.xz" SHASUMS256.txt | head -1)"; \
    curl -fsSLO "$base/$file"; \
    grep " $file\$" SHASUMS256.txt | sha256sum -c -; \
    tar -xJf "$file" -C /usr/local --strip-components=1 --exclude='*.md' --exclude=LICENSE; \
    rm -f "$file" SHASUMS256.txt; \
    node -v

# corepack épinglé (image reproductible) ; pnpm à la version de `packageManager` (passée par
# `scripts/e2e-linux`).
RUN npm install -g corepack@0.36.0 && corepack enable && corepack install -g "pnpm@${PNPM_VERSION}"

# Un utilisateur ordinaire : Electron refuse de tourner en root avec son bac à sable, et c'est le
# cas d'un vrai poste. Son dossier personnel est un volume Docker (sources copiées, node_modules
# Linux, magasin pnpm, cache d'Electron), gardé d'un lancement à l'autre.
RUN userdel -r ubuntu 2>/dev/null || true; useradd -m -u 1000 -s /bin/bash bobine
COPY --chmod=755 entrypoint.sh /usr/local/bin/bobine-e2e
USER bobine
WORKDIR /home/bobine
ENTRYPOINT ["/usr/local/bin/bobine-e2e"]
