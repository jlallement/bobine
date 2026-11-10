import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

/**
 * Générique d'abord (AGENTS.md, ADR-0011, ADR-0015) : ce qui est propre à Bob ou à OpenCode vit
 * dans leurs modules (`bob-*.ts`, `opencode-*.ts`), branchés par leur profil (`profiles.ts`) et
 * appelés ailleurs par les points d'extension génériques (`agent/adapters.ts`).
 */
const AGENT_MODULES = {
  group: ['**/bob-*', '**/opencode-*'],
  message:
    'Module propre à un agent : le brancher dans son profil (profiles.ts), appeler ici le point d’extension générique (ADR-0015).'
}
/**
 * SDK ACP derrière un seul module (ADR-0038, fiche 181) : monter ou redescendre sa version ne
 * touche que `src/shared/acp-sdk.mts`. Ailleurs, l'importer depuis ce module.
 */
const ACP_SDK = {
  group: ['@agentclientprotocol/sdk', '@agentclientprotocol/sdk/*'],
  message:
    'SDK ACP : importer depuis src/shared/acp-sdk.mts, seul module qui le connaît (ADR-0038).'
}
/** Le renderer ne connaît aucun agent : pas de test sur un identifiant de profil (fiche 088). */
const NO_PROFILE_ID_TEST = {
  selector:
    "BinaryExpression[operator=/^[!=]==?$/]:matches([left.property.name='profileId'][right.type='Literal'], [right.property.name='profileId'][left.type='Literal'])",
  message:
    'Test sur l’identifiant d’un agent dans l’UI : le profil doit le déclarer, côté main (AGENTS.md, ADR-0011).'
}

/**
 * Pas de « si c'est Bob » hors des modules d'agent (fiche 140) : un littéral `'bob'` ou
 * `'opencode'` (identifiant de profil, étiquette de format) n'a sa place que dans `profiles.ts`,
 * `bob-*.ts`, `opencode-*.ts`, les tests, la grille de conformité et l'agent factice.
 */
const NO_AGENT_LITERAL = {
  selector: 'Literal[value=/^(bob|opencode)$/i], TemplateElement[value.raw=/^(bob|opencode)$/i]',
  message:
    'Nom d’agent en dur : le déclarer dans son profil ou dans ses modules (bob-*.ts, opencode-*.ts), ADR-0015.'
}

export default tseslint.config(
  // `.claude/worktrees/` : worktrees des sessions parallèles, chacun vérifié chez lui ;
  // `.worktrees/` : worktrees de conversations créés ici (essai réel, fuite d'un test).
  {
    ignores: [
      'out/',
      'dist/',
      'node_modules/',
      'vendor/',
      'coverage/',
      '.claude/worktrees/',
      '.worktrees/'
    ]
  },
  ...tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }
      ],
      // Un module importé une fois ; `import type` à part reste permis (fiche 087).
      'no-duplicate-imports': ['error', { allowSeparateTypeImports: true }]
    }
  },
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', '*.config.ts', 'scripts/**/*.{ts,mts}'],
    languageOptions: { globals: globals.node }
  },
  {
    // Tout le code TypeScript, tests, agent factice et sondes compris ; les blocs plus bas qui
    // reposent `no-restricted-imports` reprennent `ACP_SDK`.
    files: ['src/**/*.{ts,tsx,mts}', 'scripts/**/*.{ts,mts}', 'e2e/**/*.{mts,mjs}'],
    ignores: ['src/shared/acp-sdk.mts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [ACP_SDK] }] }
  },
  {
    files: ['src/main/**/*.ts', 'src/shared/**/*.ts'],
    ignores: [
      'src/main/agent/profiles.ts',
      'src/main/**/bob-*.ts',
      'src/main/**/opencode-*.ts',
      '**/*.test.ts'
    ],
    rules: { 'no-restricted-imports': ['error', { patterns: [AGENT_MODULES, ACP_SDK] }] }
  },
  {
    files: ['src/**/*.{ts,tsx,mts}'],
    ignores: [
      'src/main/agent/profiles.ts',
      'src/main/**/bob-*.ts',
      'src/main/**/opencode-*.ts',
      'src/mock-agent/**',
      // Grille de conformité (fiche 139) : harnais d'essai seulement, qui charge exprès les vrais
      // profils `bob` et `opencode` pour ses personas.
      'src/main/conformance/**',
      '**/*.test.{ts,tsx}',
      '**/*.generated.d.ts'
    ],
    rules: { 'no-restricted-syntax': ['error', NO_AGENT_LITERAL] }
  },
  {
    // Scripts JavaScript (essais de bout en bout…) : sans TypeScript, une variable non définie ne
    // se voit qu'à l'exécution.
    files: ['**/*.mjs'],
    languageOptions: { globals: { ...globals.node, WebSocket: 'readonly' } },
    rules: { 'no-undef': 'error' }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Le renderer ne doit jamais accéder à Node ni à Electron directement (voir AGENTS.md).
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['electron', 'node:*'],
              message: 'Le renderer passe par window.api (preload).'
            },
            AGENT_MODULES,
            ACP_SDK
          ]
        }
      ],
      // Types du SDK seulement : aucun code du SDK dans le renderer (il ne parle pas ACP).
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/acp-sdk.mts'],
              allowTypeImports: true,
              message: 'Le renderer ne lit que des types du SDK ACP (import type).'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/renderer/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: { 'no-restricted-syntax': ['error', NO_PROFILE_ID_TEST, NO_AGENT_LITERAL] }
  },
  {
    // Garde-fous contre les objets-dieux (fiche 089) : seuils posés sur la mesure de fin du
    // découpage, à baisser quand un fichier est assaini (cliquet). Tests, agent factice et types
    // générés à part ; chaque exception de fonction dit pourquoi, à côté de la fonction.
    files: ['src/**/*.{ts,tsx,mts}'],
    ignores: ['**/*.test.{ts,tsx}', 'src/mock-agent/**', '**/*.generated.d.ts'],
    rules: {
      complexity: ['error', 40],
      'max-lines-per-function': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines': ['error', { max: 800, skipBlankLines: true, skipComments: true }]
    }
  },
  {
    // Tables : une longue liste de déclarations (outils de l'agent, canaux IPC, API du preload),
    // pas une complexité ; les découper serait artificiel.
    files: ['src/main/**/*-tools.ts', 'src/main/ipc.ts', 'src/preload/api.ts'],
    rules: { 'max-lines-per-function': 'off' }
  },
  {
    // Encore au-dessus de 800 lignes après le découpage (fiche 089) : plafonnés à leur taille.
    files: ['src/main/agent/agent-host.ts', 'src/main/conversations/manager.ts'],
    rules: { 'max-lines': ['error', { max: 1050, skipBlankLines: true, skipComments: true }] }
  },
  {
    files: ['src/main/index.ts'],
    rules: { 'max-lines': ['error', { max: 850, skipBlankLines: true, skipComments: true }] }
  },
  {
    // Textes de l'interface : jamais en dur, toujours par les ressources (fiche 074, ADR-0014).
    files: ['src/renderer/**/*.tsx'],
    ignores: ['**/*.test.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXText[value=/[A-Za-zÀ-ÿ]/]',
          message: 'Texte de l’interface en dur : passer par t() (fiche 074, ADR-0014).'
        },
        {
          selector:
            'JSXAttribute[name.name=/^(title|placeholder|aria-label|alt|label|hint|description)$/] > Literal[value=/[A-Za-zÀ-ÿ]/]',
          message: 'Texte de l’interface en dur : passer par t() (fiche 074, ADR-0014).'
        },
        NO_PROFILE_ID_TEST,
        NO_AGENT_LITERAL
      ]
    }
  }
)
