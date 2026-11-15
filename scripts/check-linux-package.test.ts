import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { asarEntries, asarProblems, packageProblems } from './check-linux-package.mts'
import { BUNDLED_FONT_FILES, FONT_LICENSES } from './bundled-fonts.mjs'
import { HICOLOR_DIRS, LINUX_ICON_SIZES } from './linux-icons.mjs'

const root = join(__dirname, '..')
const icons = [
  ...HICOLOR_DIRS.map(
    (dir) => `/usr/share/icons/hicolor/${dir}/apps/bobine.${dir === 'scalable' ? 'svg' : 'png'}`
  ),
  ...FONT_LICENSES.map((f) => `/opt/Bobine/resources/licenses/fonts/${f}`)
]
const desktop =
  '[Desktop Entry]\nName=Bobine\nExec=/opt/Bobine/bobine %U\nIcon=bobine\nStartupWMClass=bobine\n'

describe('paquet Linux (fiche 145)', () => {
  it('complet : icônes de 16 à 512, SVG, entrée de bureau rattachée', () => {
    expect(packageProblems(['/opt/Bobine/bobine', ...icons], desktop)).toEqual([])
  })

  it('dit ce qui manque : icône 1024 seule, entrée absente ou mal rattachée', () => {
    const only1024 = ['/usr/share/icons/hicolor/1024x1024/apps/bobine.png']
    const problems = packageProblems(only1024, undefined)
    expect(problems).toContain('icône absente : /usr/share/icons/hicolor/scalable/apps/bobine.svg')
    expect(problems).toContain('icône absente : /usr/share/icons/hicolor/512x512/apps/bobine.png')
    expect(problems).toContain(
      'licence absente : /opt/Bobine/resources/licenses/fonts/JetBrainsMono-LICENSE.txt'
    )
    expect(problems.at(-1)).toBe(
      'entrée de bureau absente : /usr/share/applications/bobine.desktop'
    )
    expect(
      packageProblems(icons, desktop.replace('StartupWMClass=bobine', 'StartupWMClass=Bobine'))
    ).toEqual(['StartupWMClass=Bobine, attendu bobine'])
  })

  it('build/icons : chaque taille, à sa taille (scripts/make-icon.mjs --linux)', () => {
    for (const size of LINUX_ICON_SIZES) {
      const png = readFileSync(join(root, 'build', 'icons', `${size}x${size}.png`))
      // En-tête IHDR : largeur et hauteur aux octets 16 et 20.
      expect([size, png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([size, size, size])
    }
  })

  it('electron-builder et package.json : dossier des icônes, SVG, desktopName', () => {
    const config = readFileSync(join(root, 'electron-builder.yml'), 'utf8')
    expect(config).toMatch(/^ {2}icon: build\/icons$/m)
    expect(config).toMatch(/^ {2}syncDesktopName: true$/m)
    expect(config).toContain('build/icon.svg=/usr/share/icons/hicolor/scalable/apps/bobine.svg')
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      desktopName?: string
    }
    expect(pkg.desktopName).toBe('bobine.desktop')
  })

  it('app.asar : seulement le build, package.json et les dépendances ; polices livrées', () => {
    // Noms de Vite : le nom publié suivi d'une empreinte de 8 caractères.
    const fonts = Object.fromEntries(
      BUNDLED_FONT_FILES.map((f) => [f.replace('.woff2', '-x_Y-1234.woff2'), { size: 1 }])
    )
    const header = JSON.stringify({
      files: {
        'package.json': { size: 2 },
        out: {
          files: {
            main: { files: { 'index.js': { size: 1 } } },
            renderer: { files: { assets: { files: fonts } } }
          }
        },
        node_modules: { files: { 'node-pty': { files: { build: { files: {} } } } } }
      }
    })
    const json = Buffer.from(header)
    const archive = Buffer.alloc(16 + json.length)
    archive.writeUInt32LE(json.length, 12)
    json.copy(archive, 16)
    const entries = asarEntries(archive)
    expect(entries).toContain('out/main/index.js')
    expect(asarProblems(entries)).toEqual([])
    expect(
      asarProblems([...entries, 'docs/features/145.md', 'src/main/index.ts', '.pilote/x'])
    ).toEqual(['hors du build dans app.asar : .pilote, docs, src'])
    expect(
      asarProblems([...entries, 'node_modules/node-pty/prebuilds/darwin-arm64/pty.node'])
    ).toEqual(["binaires de node-pty d'autres systèmes dans app.asar"])
    // Paquet construit avec la liste du Mac : polices absentes, chacune nommée.
    const withoutInter = entries.filter((e) => !e.includes('InterVariable'))
    expect(asarProblems(withoutInter)).toEqual([
      'police absente de app.asar : InterVariable.woff2',
      'police absente de app.asar : InterVariable-Italic.woff2'
    ])
  })

  it('electron-builder : `linux.files` reprend les `files` de la racine, sans les remplacer', () => {
    const config = parse(readFileSync(join(root, 'electron-builder.yml'), 'utf8')) as {
      files: string[]
      linux: { files: string[] }
    }
    expect(config.linux.files.slice(0, config.files.length)).toEqual(config.files)
    expect(config.linux.files.some((p) => !p.startsWith('!'))).toBe(true)
  })
})
