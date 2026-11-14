/**
 * Scénario « vitrine » (fiche 225) : de quoi montrer Bobine au travail dans le README et sur
 * GitHub, sans modèle ni donnée personnelle. Le texte est réaliste, en anglais et en français
 * (étape `by-language`), sur un petit projet de café, « La Bobinette », écrit par
 * `e2e/vitrine-captures.mjs` d'après `SHOWCASE_PROJECT`.
 *
 * Un seul scénario de lancement, `vitrine`, choisit sa suite d'après le message reçu, pour que
 * l'invite affichée soit une vraie phrase (jamais `/scenario …`) :
 * - consigne d'un rôle d'expert sécurité ou de relecteur (filles `@rôle`) : leur compte rendu ;
 * - « export » : une question à choix avant d'agir ;
 * - « the shop » / « la boutique » : la page du café ouverte dans le navigateur intégré ;
 * - sinon : le test de la remise qui échoue, la correction soumise à autorisation (diff), les
 *   tests qui repassent.
 */
import type { Scenario, Step } from './scenario.mts'

type Lang = 'fr' | 'en'

/** Fichiers du projet de démonstration, par langue (lus par le script de captures). */
export const SHOWCASE_PROJECT: Record<Lang, Record<string, string>> = {
  en: {
    'README.md':
      '# La Bobinette\n\nThe website and cart maths of a small coffee shop.\n\nRun the tests: `python3 -m unittest`\n',
    'cart.py': cartSource('en', '>'),
    'test_cart.py': testSource('en')
  },
  fr: {
    'README.md':
      '# La Bobinette\n\nLe site et les calculs du panier d’un petit café.\n\nLancer les tests : `python3 -m unittest`\n',
    'panier.py': cartSource('fr', '>'),
    'test_panier.py': testSource('fr')
  }
}

/** Nom du fichier corrigé, par langue. */
const CART: Record<Lang, string> = { en: 'cart.py', fr: 'panier.py' }

function cartSource(lang: Lang, comparison: '>' | '>='): string {
  return lang === 'en'
    ? `"""Cart maths for La Bobinette: subtotal, discount and total."""

DISCOUNT_THRESHOLD = 20.0
DISCOUNT_RATE = 0.10


def subtotal(lines):
    """Sum of price × quantity for each line."""
    return round(sum(line["price"] * line["quantity"] for line in lines), 2)


def discount(amount):
    """10% off from 20 € of purchases."""
    if amount ${comparison} DISCOUNT_THRESHOLD:
        return round(amount * DISCOUNT_RATE, 2)
    return 0.0


def total(lines):
    """Subtotal minus the discount."""
    amount = subtotal(lines)
    return round(amount - discount(amount), 2)
`
    : `"""Calculs du panier de La Bobinette : sous-total, remise et total."""

SEUIL_REMISE = 20.0
TAUX_REMISE = 0.10


def sous_total(lignes):
    """Somme de prix × quantité pour chaque ligne."""
    return round(sum(ligne["prix"] * ligne["quantite"] for ligne in lignes), 2)


def remise(montant):
    """10 % de remise à partir de 20 € d'achats."""
    if montant ${comparison} SEUIL_REMISE:
        return round(montant * TAUX_REMISE, 2)
    return 0.0


def total(lignes):
    """Sous-total moins la remise."""
    montant = sous_total(lignes)
    return round(montant - remise(montant), 2)
`
}

function testSource(lang: Lang): string {
  return lang === 'en'
    ? `import unittest

from cart import discount, subtotal, total


class TestCart(unittest.TestCase):
    def test_subtotal(self):
        self.assertEqual(subtotal([{"price": 2.5, "quantity": 2}]), 5.0)

    def test_no_discount_below_threshold(self):
        self.assertEqual(discount(19.99), 0.0)

    def test_discount_at_threshold(self):
        self.assertEqual(discount(20.0), 2.0)

    def test_discount_above_threshold(self):
        self.assertEqual(discount(30.0), 3.0)

    def test_total_with_discount(self):
        self.assertEqual(total([{"price": 2.5, "quantity": 8}]), 18.0)
`
    : `import unittest

from panier import remise, sous_total, total


class TestPanier(unittest.TestCase):
    def test_sous_total(self):
        self.assertEqual(sous_total([{"prix": 2.5, "quantite": 2}]), 5.0)

    def test_pas_de_remise_sous_le_seuil(self):
        self.assertEqual(remise(19.99), 0.0)

    def test_remise_au_seuil(self):
        self.assertEqual(remise(20.0), 2.0)

    def test_remise_au_dessus_du_seuil(self):
        self.assertEqual(remise(30.0), 3.0)

    def test_total_avec_remise(self):
        self.assertEqual(total([{"prix": 2.5, "quantite": 8}]), 18.0)
`
}

/** Même suite dans les deux langues, construite par `build`. */
const bilingual = (build: (lang: Lang) => Step[]): Step => ({
  kind: 'by-language',
  fr: build('fr'),
  en: build('en')
})

const text = (fr: string, en: string): Step => ({
  kind: 'by-language',
  fr: [{ kind: 'text', text: fr }],
  en: [{ kind: 'text', text: en }]
})

const TASKS: Record<Lang, string[]> = {
  en: ['Run the tests', 'Fix the discount threshold', 'Run the tests again'],
  fr: ['Lancer les tests', 'Corriger le seuil de la remise', 'Relancer les tests']
}

const plan = (lang: Lang, statuses: ('pending' | 'in_progress' | 'completed')[]): Step => ({
  kind: 'update',
  update: {
    sessionUpdate: 'plan',
    entries: TASKS[lang].map((content, i) => ({
      content,
      priority: 'medium',
      status: statuses[i] ?? 'pending'
    }))
  }
})

/** Commande au format de l'extension de terminal (`_meta.terminal_*`), sortie en morceaux. */
function command(id: string, line: string, chunks: string[], exitCode: number): Step[] {
  return [
    {
      kind: 'update',
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: id,
        title: line,
        kind: 'execute',
        status: 'in_progress',
        content: [{ type: 'terminal', terminalId: id }],
        rawInput: { command: line },
        _meta: { terminal_info: { terminal_id: id } }
      }
    },
    ...chunks.flatMap((data): Step[] => [
      { kind: 'pause', ticks: 4 },
      {
        kind: 'update',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: id,
          _meta: { terminal_output_delta: { terminal_id: id, data } }
        }
      }
    ]),
    {
      kind: 'update',
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId: id,
        status: exitCode === 0 ? 'completed' : 'failed',
        _meta: { terminal_exit: { terminal_id: id, exit_code: exitCode, signal: null } }
      }
    }
  ]
}

/** Lecture d'un fichier du dossier de la session (carte d'outil terminée). */
function read(id: string, path: string, title: string): Step[] {
  return [
    {
      kind: 'update',
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: id,
        title,
        kind: 'read',
        status: 'in_progress',
        locations: [{ path: `{cwd}/${path}` }],
        rawInput: { path: `{cwd}/${path}` }
      }
    },
    { kind: 'pause', ticks: 6 },
    {
      kind: 'update',
      update: { sessionUpdate: 'tool_call_update', toolCallId: id, status: 'completed' }
    }
  ]
}

function failingRun(lang: Lang): Step[] {
  const test = lang === 'en' ? 'test_discount_at_threshold' : 'test_remise_au_seuil'
  const module = lang === 'en' ? 'test_cart.TestCart' : 'test_panier.TestPanier'
  const call = lang === 'en' ? 'discount' : 'remise'
  return command(
    'vitrine_tests_1',
    'python3 -m unittest',
    [
      '..F..\n',
      `======================================================================\nFAIL: ${test} (${module}.${test})\n`,
      `----------------------------------------------------------------------\nTraceback (most recent call last):\n  File "${lang === 'en' ? 'test_cart.py' : 'test_panier.py'}", line 15, in ${test}\n    self.assertEqual(${call}(20.0), 2.0)\nAssertionError: 0.0 != 2.0\n`,
      '\n----------------------------------------------------------------------\nRan 5 tests in 0.001s\n\nFAILED (failures=1)\n'
    ],
    1
  )
}

const passingRun = (): Step[] =>
  command(
    'vitrine_tests_2',
    'python3 -m unittest',
    [
      '.....\n',
      '----------------------------------------------------------------------\nRan 5 tests in 0.001s\n\nOK\n'
    ],
    0
  )

/** La correction, soumise à autorisation avec son diff, puis écrite pour de vrai. */
function fix(lang: Lang): Step[] {
  const file = CART[lang]
  const oldText = cartSource(lang, '>')
  const newText = cartSource(lang, '>=')
  const title = lang === 'en' ? `Edit ${file}` : `Modification de ${file}`
  const diff = { type: 'diff' as const, path: `{cwd}/${file}`, oldText, newText }
  const done: Step[] = [
    { kind: 'write-file', path: file, content: newText },
    {
      kind: 'update',
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'vitrine_fix',
        status: 'completed',
        content: [diff]
      }
    },
    plan(lang, ['completed', 'completed', 'in_progress']),
    ...passingRun(),
    plan(lang, ['completed', 'completed', 'completed']),
    {
      kind: 'text',
      text:
        lang === 'en'
          ? 'Fixed: the discount now starts at exactly 20 €, as the test expects. All 5 tests pass.'
          : 'C’est corrigé : la remise commence à 20 € pile, comme le test l’attend. Les 5 tests passent.'
    }
  ]
  return [
    {
      kind: 'update',
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 'vitrine_fix',
        title,
        kind: 'edit',
        status: 'pending',
        locations: [{ path: `{cwd}/${file}` }],
        content: [diff]
      }
    },
    {
      kind: 'permission',
      toolCall: { toolCallId: 'vitrine_fix', title, kind: 'edit' },
      options:
        lang === 'en'
          ? [
              { optionId: 'allow', name: 'Allow', kind: 'allow_once' },
              { optionId: 'allow_always', name: 'Always allow', kind: 'allow_always' },
              { optionId: 'reject', name: 'Reject', kind: 'reject_once' }
            ]
          : [
              { optionId: 'allow', name: 'Autoriser', kind: 'allow_once' },
              { optionId: 'allow_always', name: 'Toujours autoriser', kind: 'allow_always' },
              { optionId: 'reject', name: 'Refuser', kind: 'reject_once' }
            ],
      branches: {
        allow: done,
        allow_always: done,
        reject: [
          {
            kind: 'update',
            update: {
              sessionUpdate: 'tool_call_update',
              toolCallId: 'vitrine_fix',
              status: 'failed'
            }
          },
          {
            kind: 'text',
            text:
              lang === 'en'
                ? 'All right, I leave the file as it is.'
                : 'Entendu, je n’y touche pas.'
          }
        ]
      }
    }
  ]
}

/** Le test de la remise qui échoue, corrigé avec l'accord de l'utilisateur. */
const FIX_THE_TEST: Step = bilingual((lang) => [
  plan(lang, ['in_progress']),
  {
    kind: 'text',
    text: lang === 'en' ? 'Let me run the tests first.\n\n' : 'Je lance d’abord les tests.\n\n'
  },
  ...failingRun(lang),
  { kind: 'pause', ticks: 6 },
  ...read(
    'vitrine_read',
    CART[lang],
    lang === 'en' ? `Read ${CART[lang]}` : `Lecture de ${CART[lang]}`
  ),
  plan(lang, ['completed', 'in_progress']),
  {
    kind: 'text',
    text:
      lang === 'en'
        ? 'The discount starts **above** 20 €, but the test expects it **at** 20 €: `>` should be `>=`.\n\n'
        : 'La remise commence **au-dessus** de 20 €, mais le test l’attend **à** 20 € : `>` doit devenir `>=`.\n\n'
  },
  ...fix(lang)
])

/** Compte rendu de l'expert sécurité (fille d'un rôle en lecture seule). */
const SECURITY_REVIEW: Step = bilingual((lang) => [
  ...read(
    'vitrine_sec_1',
    CART[lang],
    lang === 'en' ? `Read ${CART[lang]}` : `Lecture de ${CART[lang]}`
  ),
  ...read('vitrine_sec_2', 'README.md', lang === 'en' ? 'Read README.md' : 'Lecture de README.md'),
  {
    kind: 'text',
    text:
      lang === 'en'
        ? '**Security review of the cart — nothing blocking.**\n\n- Prices are computed on the server, in `cart.py`: the page cannot change them.\n- `subtotal()` trusts `quantity`: a negative quantity would lower the total. Reject quantities below 1.\n- No secret in the repository.'
        : '**Audit de sécurité du panier — rien de bloquant.**\n\n- Les prix sont calculés côté serveur, dans `panier.py` : la page ne peut pas les changer.\n- `sous_total()` fait confiance à `quantite` : une quantité négative baisserait le total. Refuser les quantités inférieures à 1.\n- Aucun secret dans le dépôt.'
  }
])

/** Compte rendu du relecteur de code (fille d'un rôle en lecture seule). */
const CODE_REVIEW: Step = bilingual((lang) => [
  ...read(
    'vitrine_rev_1',
    CART[lang],
    lang === 'en' ? `Read ${CART[lang]}` : `Lecture de ${CART[lang]}`
  ),
  {
    kind: 'text',
    text:
      lang === 'en'
        ? '**Review — ready to merge after one small change.**\n\n- The threshold is now tested at exactly 20 €: good.\n- `total()` rounds twice; rounding once at the end is enough.\n- Add a test for an empty cart.'
        : '**Relecture — prête à fusionner après un petit changement.**\n\n- Le seuil est maintenant testé à 20 € pile : très bien.\n- `total()` arrondit deux fois ; un seul arrondi à la fin suffit.\n- Ajouter un test pour un panier vide.'
  }
])

/** Question à choix avant d'ajouter un export. */
const ASK_FIRST: Step = bilingual((lang) => {
  const en = lang === 'en'
  return [
    {
      kind: 'text',
      text: en
        ? 'Before I add the export, one question.\n\n'
        : 'Avant d’ajouter l’export, une question.\n\n'
    },
    {
      kind: 'update',
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 'vitrine_ask',
        title: 'AskUserQuestion',
        kind: 'other',
        status: 'pending'
      }
    },
    {
      kind: 'elicitation',
      toolCallId: 'vitrine_ask',
      message: en ? 'Please answer the following question.' : 'Merci de répondre à cette question.',
      schema: {
        type: 'object',
        properties: {
          question_0: {
            type: 'string',
            title: en ? 'Format' : 'Format',
            description: en
              ? 'Which format for the order export?'
              : 'Quel format pour l’export des commandes ?',
            oneOf: [
              {
                const: 'CSV',
                title: 'CSV',
                description: en ? 'Opens in any spreadsheet' : 'S’ouvre dans tous les tableurs'
              },
              {
                const: 'Excel',
                title: 'Excel (.xlsx)',
                description: en ? 'Keeps the formatting' : 'Garde la mise en forme'
              },
              {
                const: 'PDF',
                title: 'PDF',
                description: en ? 'Ready to print' : 'Prêt à imprimer'
              }
            ]
          }
        },
        required: ['question_0']
      },
      onAccept: (content) => [
        {
          kind: 'text',
          text: en
            ? `${String(content['question_0'] ?? 'CSV')} it is: I add the export.`
            : `Va pour ${String(content['question_0'] ?? 'CSV')} : j’ajoute l’export.`
        }
      ],
      onDecline: [
        { kind: 'text', text: en ? 'No export for now.' : 'Pas d’export pour l’instant.' }
      ]
    }
  ]
})

/** La boutique du café ouverte dans le navigateur intégré (`MOCK_BROWSER_URL`). */
const OPEN_THE_SHOP: Step[] = [
  text('J’ouvre la boutique dans le navigateur. ', 'Opening the shop in the browser. '),
  {
    kind: 'mcp-tool',
    tool: 'browser_navigate',
    args: { url: process.env['MOCK_BROWSER_URL'] ?? 'http://127.0.0.1:9/' },
    onResult: () => [
      {
        kind: 'mcp-tool',
        tool: 'browser_screenshot',
        args: { scale: 0.5 },
        onResult: () => [
          text(
            '\n\nLa page s’affiche bien : trois produits, le panier en haut à droite. Le bouton « Ajouter » de la tarte est trop près du bord sur un petit écran ; je peux le corriger.',
            '\n\nThe page looks right: three products, the cart at the top right. The “Add” button of the tart is too close to the edge on a small screen; I can fix it.'
          )
        ]
      }
    ]
  }
]

/** Espace Discussion (fiche 224) : un e-mail rédigé, gardé comme document de la discussion. */
const WRITE_AN_EMAIL: Step = bilingual((lang) => {
  const en = lang === 'en'
  const file = en ? 'Email to the roaster.md' : 'E-mail au torréfacteur.md'
  const draft = en
    ? 'Subject: 10 kg more for Friday\n\nHello Marc,\n\nOur Saturday market went better than planned: could you add **10 kg of the house blend** to Friday’s delivery? Same grind as usual.\n\nThank you, and see you on Friday!\n\nLéa, La Bobinette'
    : 'Objet : 10 kg de plus pour vendredi\n\nBonjour Marc,\n\nLe marché de samedi a mieux marché que prévu : pourriez-vous ajouter **10 kg du mélange maison** à la livraison de vendredi ? Même mouture que d’habitude.\n\nMerci, et à vendredi !\n\nLéa, La Bobinette'
  const id = 'vitrine_email'
  const title = en ? `Writing ${file}` : `Écriture de ${file}`
  const status = (value: 'completed' | 'failed'): Step => ({
    kind: 'update',
    update: { sessionUpdate: 'tool_call_update', toolCallId: id, status: value }
  })
  const written: Step[] = [
    { kind: 'write-file', path: file, content: `${draft}\n` },
    status('completed')
  ]
  return [
    {
      kind: 'text',
      text: en
        ? 'Here is a short, friendly draft:\n\n'
        : 'Voici un brouillon court et cordial :\n\n'
    },
    {
      kind: 'text',
      text: `${draft
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n')}\n\n`
    },
    {
      kind: 'update',
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: id,
        title,
        kind: 'edit',
        status: 'pending',
        locations: [{ path: `{cwd}/${file}` }]
      }
    },
    {
      kind: 'permission',
      toolCall: { toolCallId: id, title, kind: 'edit' },
      options: [
        { optionId: 'allow', name: 'Allow once', kind: 'allow_once' },
        { optionId: 'always', name: 'Always allow', kind: 'allow_always' },
        { optionId: 'reject', name: 'Reject', kind: 'reject_once' }
      ],
      branches: { allow: written, always: written, reject: [status('failed')] }
    },
    {
      kind: 'text',
      text: en
        ? `I also saved it in your documents: **${file}**.`
        : `Je l’ai aussi gardé dans vos documents : **${file}**.`
    }
  ]
})

/** Choisit la suite d'après le message reçu (sans tenir compte de la casse). */
const when = (includes: string[], then: Step[], otherwise: Step[]): Step[] => {
  const [first, ...rest] = includes
  if (!first) return otherwise
  return [{ kind: 'when-prompt', includes: first, then, else: when(rest, then, otherwise) }]
}

export const showcaseScenarios: Record<string, Scenario> = {
  vitrine: {
    description:
      'Vitrine du README (fiche 225), anglais ou français selon `--langue` : test de la remise corrigé avec autorisation et diff ; « export » : question à choix ; « the shop » / « la boutique » : page MOCK_BROWSER_URL dans le navigateur ; « email » / « e-mail » : brouillon d’e-mail gardé en document (espace Discussion) ; consigne d’un rôle expert sécurité ou relecteur : leur compte rendu',
    steps: when(
      ['application security expert', 'expert en sécurité applicative'],
      [SECURITY_REVIEW],
      when(
        ['careful code reviewer', 'relecteur de code attentif'],
        [CODE_REVIEW],
        when(
          ['export'],
          [ASK_FIRST],
          when(
            ['the shop', 'la boutique'],
            OPEN_THE_SHOP,
            when(['email', 'e-mail'], [WRITE_AN_EMAIL], [FIX_THE_TEST])
          )
        )
      )
    )
  }
}
