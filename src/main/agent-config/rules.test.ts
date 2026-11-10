import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { activeRules } from './rules'
import { BOB_RULES } from './bob-rules'
import { OPENCODE_RULES } from './opencode-rules'

function tree(files: Record<string, string>): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'regles-')))
  for (const [path, content] of Object.entries(files)) {
    if (path.endsWith('/')) {
      mkdirSync(join(root, path), { recursive: true })
      continue
    }
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  return root
}

const labels = (rules: { label: string; scope: string; mode?: string }[]) =>
  rules.map((r) => `${r.scope}${r.mode ? `:${r.mode}` : ''} ${r.label}`)

describe('règles actives (fiche 056)', () => {
  it('Bob : AGENTS.md du dossier, rules/ et rules-<mode>/ du projet, des greffons et de ~/.bob', async () => {
    const root = tree({
      'projet/AGENTS.md': 'a',
      'projet/sous/AGENTS.md': 'pas lu : Bob ne descend pas',
      'projet/.bob/rules/style.md': 's',
      'projet/.bob/rules/details/tests.md': 't',
      'projet/.bob/rules/.DS_Store': 'ignoré',
      'projet/.bob/rules-plan/plan.md': 'p',
      'projet/.bob/rules-ask/ask.md': 'autre mode',
      'projet/.bob/plugins/outil/rules/outil.md': 'o',
      'maison/.bob/rules/moi.md': 'm',
      'maison/.bob/rules-plan/moi-plan.md': 'mp'
    })
    const ctx = { workspace: join(root, 'projet'), home: join(root, 'maison') }
    expect(labels(await activeRules(BOB_RULES, { ...ctx, mode: 'plan' }))).toEqual([
      'project AGENTS.md',
      'project:plan .bob/rules-plan/plan.md',
      'project .bob/rules/details/tests.md',
      'project .bob/rules/style.md',
      'project .bob/plugins/outil/rules/outil.md',
      'personal:plan ~/.bob/rules-plan/moi-plan.md',
      'personal ~/.bob/rules/moi.md'
    ])
    // Sans mode connu : seulement les règles de tous les modes.
    expect(labels(await activeRules(BOB_RULES, ctx)).some((l) => l.includes('rules-'))).toBe(false)
    expect(await activeRules(BOB_RULES, { workspace: join(root, 'vide'), home: root })).toEqual([])
  })

  it('OpenCode 1.19 : AGENTS.md jusqu’à la racine du dépôt, pas au-dessus ; CLAUDE.md seulement à défaut', async () => {
    // Même arbre que l'essai réel (OpenCode 1.19).
    const root = tree({
      'AGENTS.md': 'ECHO, au-dessus du dépôt',
      'repo/.git/': '',
      'repo/AGENTS.md': 'ALPHA',
      'repo/sub/AGENTS.md': 'BRAVO',
      'repo/sub/CLAUDE.md': 'CHARLIE, ignoré',
      'repo/docs/regles.md': 'DELTA',
      'repo/opencode.json':
        '{ // commentaire\n "instructions": ["docs/regles.md", "https://exemple.org/regles.md"] }',
      'maison/.claude/CLAUDE.md': 'personnel'
    })
    const rules = await activeRules(OPENCODE_RULES, {
      workspace: join(root, 'repo', 'sub'),
      home: join(root, 'maison'),
      version: '1.19.0'
    })
    expect(labels(rules)).toEqual([
      `project ${join(root, 'repo', 'AGENTS.md')}`,
      'project AGENTS.md',
      'personal ~/.claude/CLAUDE.md',
      `project ${join(root, 'repo', 'docs', 'regles.md')}`,
      'project https://exemple.org/regles.md'
    ])
    expect(rules.at(-1)).toMatchObject({ url: true })
  })

  it('OpenCode 1.19 : hors dépôt, remonte au-delà du dossier ; CLAUDE.md à défaut ; désactivable', async () => {
    const root = tree({
      'haut/AGENTS.md': 'FOXTROT',
      'haut/sub/CLAUDE.md': 'GOLF, ignoré',
      'seul/CLAUDE.md': 'à défaut',
      'config/opencode/AGENTS.md': 'global',
      'maison/.claude/CLAUDE.md': 'masqué par le global'
    })
    const home = join(root, 'maison')
    const env = { XDG_CONFIG_HOME: join(root, 'config') }
    const v1 = { version: '1.19.0' }
    const up = await activeRules(OPENCODE_RULES, {
      workspace: join(root, 'haut', 'sub'),
      home,
      env,
      ...v1
    })
    expect(up.map((r) => r.path)).toContain(join(root, 'haut', 'AGENTS.md'))
    expect(up.map((r) => r.path)).not.toContain(join(root, 'haut', 'sub', 'CLAUDE.md'))
    expect(up.find((r) => r.scope === 'personal')?.path).toBe(
      join(root, 'config', 'opencode', 'AGENTS.md')
    )
    const alone = await activeRules(OPENCODE_RULES, { workspace: join(root, 'seul'), home, ...v1 })
    expect(labels(alone)).toEqual(['project CLAUDE.md', 'personal ~/.claude/CLAUDE.md'])
    const off = await activeRules(OPENCODE_RULES, {
      workspace: join(root, 'seul'),
      home,
      env: { OPENCODE_DISABLE_CLAUDE_CODE: '1' },
      ...v1
    })
    expect(off).toEqual([])
  })

  it('OpenCode 2 : AGENTS.md jusqu’au dossier personnel, plus de CLAUDE.md ; instructions', async () => {
    // Même arbre que l'essai réel sur OpenCode 2.0.31 (fiche 078) : chargés ALPHA, CHARLIE, DELTA,
    // ECHO, FOXTROT, HOTEL, INDIA ; pas BRAVO ni GOLF.
    const root = tree({
      'maison/.config/opencode/AGENTS.md': 'ALPHA',
      'maison/.config/opencode/opencode.json': '{ "instructions": ["~/perso/*.md"] }',
      'maison/perso/india.md': 'INDIA',
      'maison/.claude/CLAUDE.md': 'BRAVO, ignoré',
      'maison/AGENTS.md': 'CHARLIE',
      'maison/parent/AGENTS.md': 'DELTA, au-dessus du dépôt',
      'maison/parent/repo/.git/': '',
      'maison/parent/repo/AGENTS.md': 'ECHO',
      'maison/parent/repo/sub/AGENTS.md': 'FOXTROT',
      'maison/parent/repo/sub/CLAUDE.md': 'GOLF, ignoré',
      'maison/parent/repo/docs/regles.md': 'HOTEL',
      'maison/parent/repo/opencode.json': '{ "instructions": ["docs/regles.md"] }'
    })
    const home = join(root, 'maison')
    const rules = await activeRules(OPENCODE_RULES, {
      workspace: join(home, 'parent', 'repo', 'sub'),
      home,
      env: { XDG_CONFIG_HOME: join(home, '.config') },
      version: '2.0.31'
    })
    expect(labels(rules)).toEqual([
      'project ~/AGENTS.md',
      'project ~/parent/AGENTS.md',
      'project ~/parent/repo/AGENTS.md',
      'project AGENTS.md',
      'personal ~/.config/opencode/AGENTS.md',
      'project ~/parent/repo/docs/regles.md',
      'personal ~/perso/india.md'
    ])
  })

  it('OpenCode 2 : hors du dossier personnel, jusqu’à la racine du dépôt ; sans dépôt, le dossier seul', async () => {
    const root = tree({
      'AGENTS.md': 'JULIETT, jamais',
      'a/AGENTS.md': 'KILO',
      'a/b/AGENTS.md': 'LIMA',
      'git/.git/': '',
      'git/AGENTS.md': 'KILO',
      'git/b/AGENTS.md': 'LIMA',
      'maison/': ''
    })
    const home = join(root, 'maison')
    // Version inconnue : celle d'OpenCode 2.
    const alone = await activeRules(OPENCODE_RULES, { workspace: join(root, 'a', 'b'), home })
    expect(labels(alone)).toEqual(['project AGENTS.md'])
    const repo = await activeRules(OPENCODE_RULES, {
      workspace: join(root, 'git', 'b'),
      home,
      version: '2.0.31'
    })
    expect(labels(repo)).toEqual([`project ${join(root, 'git', 'AGENTS.md')}`, 'project AGENTS.md'])
  })
})
