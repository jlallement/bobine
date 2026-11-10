import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import type { PermissionRisk } from '@shared/permissions'
import { permissionRisks, type RiskToolCall } from './permission-risk'

/** Disque fictif : rien n'existe, aucun lien n'est suivi. */
const noDisk = (): string => {
  throw new Error('absent')
}
const WS = '/projets/app'
const HOME = '/maison/ada'
const risksOf = (toolCall: RiskToolCall, workspace: string | undefined = WS) =>
  permissionRisks(toolCall, { workspace, home: HOME, realpath: noDisk })
const command = (text: string) =>
  risksOf({ kind: 'execute', title: text, rawInput: { command: text } })

const out = (path: string): PermissionRisk => ({ kind: 'outside-folder', path })
const dot = (path: string): PermissionRisk => ({ kind: 'home-dotfile', path })
const sys = (path: string): PermissionRisk => ({ kind: 'system-path', path })
const priv = (via: 'sudo' | 'su' | 'doas' | 'pkexec'): PermissionRisk => ({
  kind: 'privilege',
  via
})

describe('risques d’une commande (fiche 211)', () => {
  it.each<[string, PermissionRisk[]]>([
    // Le cas réel de l'essai avec Bob 2.0.9 (fil enregistré, item 71).
    [
      'echo "docker.host=unix:///var/run/docker.sock" > ~/.testcontainers.properties && cat ~/.testcontainers.properties',
      [dot('~/.testcontainers.properties')]
    ],
    ['echo x >> ~/.zshrc', [dot('~/.zshrc')]],
    ['echo x >> $HOME/.zshrc', [dot('~/.zshrc')]],
    ['echo x >> "${HOME}/.zshrc"', [dot('~/.zshrc')]],
    ['echo x > ../voisin/notes.txt', [out('/projets/voisin/notes.txt')]],
    ['cd sous && echo x > ../../y.txt', [out('/projets/y.txt')]],
    ['cd sous && echo x > ../y.txt', []],
    ['cd /tmp && touch a', [out('/tmp/a')]],
    ['(cd /tmp && touch a) && touch b', [out('/tmp/a')]],
    ['echo x > "/autre dossier/f.txt"', [out('/autre dossier/f.txt')]],
    ["echo x > '/autre dossier/f.txt'", [out('/autre dossier/f.txt')]],
    ['echo x > /autre\\ dossier/f.txt', [out('/autre dossier/f.txt')]],
    ['echo x &> /tmp/log', [out('/tmp/log')]],
    ['make 2> /tmp/err.log', [out('/tmp/err.log')]],
    ['echo x | tee -a /tmp/a /tmp/b', [out('/tmp/a'), out('/tmp/b')]],
    ['cp build/app /usr/local/bin/app', [sys('/usr/local/bin/app')]],
    ['mv a.txt b.txt /srv', [out('/srv')]],
    ['cp -t /srv a b', [out('/srv')]],
    ['ln -sf ~/x /etc/hosts', [sys('/etc/hosts')]],
    ['rm -rf ~/.cache/outil', [dot('~/.cache/outil')]],
    ['mkdir -p /opt/outil && chmod 755 /opt/outil', [sys('/opt/outil')]],
    ['chown ada:staff /srv/f', [out('/srv/f')]],
    ['dd if=/dev/zero of=/tmp/disque bs=1m count=1', [out('/tmp/disque')]],
    ["sed -i '' 's/a/b/' ~/.bashrc", [dot('~/.bashrc')]],
    ['sed -i.bak -e s/a/b/ /etc/hosts', [sys('/etc/hosts')]],
    ['rsync -a dist/ serveur:/var/www', []],
    // Heredoc (cas réel, item 77 de l'essai) : la cible de la redirection, pas le corps.
    [
      "cat > ~/.testcontainers.properties << 'EOF'\ndocker.host=unix:///x.sock\nEOF\ncat ~/.testcontainers.properties",
      [dot('~/.testcontainers.properties')]
    ],
    ['cat <<EOF > notes.md\n> /etc/passwd\nEOF', []],
    // Droits d'administrateur : en position de commande seulement.
    ['sudo -n true', [priv('sudo')]],
    [
      'sudo ln -sf /x/docker.sock /var/run/docker.sock && ls -la /var/run/docker.sock',
      [priv('sudo'), sys('/var/run/docker.sock')]
    ],
    ['git pull && sudo -u root make install', [priv('sudo')]],
    ['env FOO=1 doas reboot', [priv('doas')]],
    ['pkexec --user root id', [priv('pkexec')]],
    ["su -c 'rm -rf /etc'", [priv('su')]],
    ['/usr/bin/sudo id', [priv('sudo')]],
    ['echo sudo', []],
    ['grep -r sudo .', []],
    // Lectures : jamais signalées.
    ['ls -la /var/run/docker.sock 2>/dev/null || echo absent', []],
    ['cat ~/.ssh/config', []],
    ['find / -name x 2>&1 | head', []],
    ['make >/dev/null 2>&1', []],
    ['make > /dev/stderr', []],
    ['echo x >&2', []],
    ['wc -l < /etc/hosts', []],
    // Dans le dossier : rien.
    ['echo x > notes.md && mkdir -p src/a', []],
    ['echo SECRET=1 > .env', []],
    ['cp a b', []],
    // Doute : pas d'écriture inventée.
    ['echo x > $(mktemp)', []],
    ['echo x > `mktemp`', []],
    ['eval "echo x > ~/.zshrc"', []],
    ['bash -c "echo x > ~/.zshrc"', []],
    ['sh -lc "sudo id"', []],
    ['echo x > ~/.zshrc && echo $(date)', []],
    // … mais les droits d'administrateur en tête d'un segment restent dits.
    ['sudo bash -c "echo x > /etc/hosts"', [priv('sudo')]],
    ["sudo sh -c 'cat > /etc/x << EOF'", [priv('sudo')]],
    ['sudo $(which rm) -rf /etc', [priv('sudo')]],
    ['sudo `which rm` -rf /etc', [priv('sudo')]],
    ['echo $(date) && sudo tee /etc/hosts', [priv('sudo')]],
    ['cat x | doas tee $(cible)', [priv('doas')]],
    ["echo $'\\x41' ; pkexec id", [priv('pkexec')]],
    ['make; su -c "$(cat script)"', [priv('su')]],
    ['echo "pas fermé ; sudo id', []],
    ['echo $(sudo id)', []],
    ['echo x > $DEST/f', []],
    ['echo x > ~autre/f', []],
    ["echo $'a' > ~/.zshrc", []],
    ['echo "pas fermé > ~/.zshrc', []],
    ['diff <(ls) <(ls ..) > ~/.zshrc', []]
  ])('%j', (text, expected) => {
    expect(command(text)).toEqual(expected)
  })

  it('la commande dans le titre seulement (Bob) : lue aussi', () => {
    expect(risksOf({ kind: 'execute', title: 'sudo -n true' })).toEqual([priv('sudo')])
  })

  it('le dossier de la commande (`cwd`, relatif ou absolu) sert de base', () => {
    const at = (cwd: string) =>
      risksOf({ kind: 'execute', title: 'shell', rawInput: { command: 'touch a', cwd } })
    expect(at('/srv')).toEqual([out('/srv/a')])
    expect(at('docs')).toEqual([])
    expect(at('../autre')).toEqual([out('/projets/autre/a')])
  })

  it('un outil d’un autre genre (lecture, recherche) : jamais signalé', () => {
    expect(risksOf({ kind: 'read', locations: [{ path: '/etc/hosts' }] })).toEqual([])
    expect(risksOf({ kind: 'search', rawInput: { path: '~/.ssh' } })).toEqual([])
    expect(risksOf({ kind: 'fetch', title: 'sudo' })).toEqual([])
  })

  it('sans dossier de conversation : pas de « hors du dossier », le reste reste dit', () => {
    expect(
      permissionRisks(
        { kind: 'execute', title: 'echo x > ~/.zshrc' },
        { home: HOME, realpath: noDisk }
      )
    ).toEqual([dot('~/.zshrc')])
  })
})

describe('risques d’une écriture de fichier (fiche 211)', () => {
  it('Bob 2.0.9 : rawInput.path et diff absolus, une seule mention par chemin', () => {
    const path = `${HOME}/.zshrc`
    expect(
      risksOf({
        kind: 'edit',
        title: `Writing file ${path}`,
        rawInput: { path, content: 'x', line_count: 1 },
        locations: [{ path }],
        content: [{ type: 'diff', path }]
      })
    ).toEqual([dot('~/.zshrc')])
  })

  it('OpenCode : filePath ; dans le dossier, rien', () => {
    expect(risksOf({ kind: 'edit', rawInput: { filePath: `${WS}/notes.md` } })).toEqual([])
    expect(risksOf({ kind: 'edit', rawInput: { filePath: 'notes.md' } })).toEqual([])
    expect(risksOf({ kind: 'delete', locations: [{ path: '/etc/hosts' }] })).toEqual([
      sys('/etc/hosts')
    ])
  })

  it('déplacement : source et destination', () => {
    expect(
      risksOf({ kind: 'move', rawInput: { source: 'a.txt', destination: '/srv/a.txt' } })
    ).toEqual([out('/srv/a.txt')])
  })

  it('dossiers temporaires : hors du dossier, pas du système', () => {
    expect(risksOf({ kind: 'edit', locations: [{ path: '/var/folders/x/f' }] })).toEqual([
      out('/var/folders/x/f')
    ])
  })
})

describe('liens symboliques (vrai disque, dossier jetable)', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'bobine-risques-')))
  afterAll(() => rmSync(root, { recursive: true, force: true }))
  const workspace = join(root, 'projet')
  const home = join(root, 'maison')
  mkdirSync(workspace)
  mkdirSync(join(home, '.ssh'), { recursive: true })
  symlinkSync(join(home, '.ssh'), join(workspace, 'cles'))

  it('un lien du projet vers ~/.ssh : hors du dossier, là où il mène', () => {
    expect(
      permissionRisks(
        { kind: 'execute', title: 'echo x >> cles/authorized_keys' },
        { workspace, home }
      )
    ).toEqual([dot('~/.ssh/authorized_keys')])
  })

  it('un fichier neuf dans un dossier qui n’existe pas encore, dans le projet : rien', () => {
    expect(
      permissionRisks(
        { kind: 'execute', title: 'mkdir -p a/b/c && touch a/b/c/d' },
        { workspace, home }
      )
    ).toEqual([])
  })
})
