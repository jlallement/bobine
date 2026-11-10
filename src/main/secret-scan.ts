/**
 * Détection des secrets, partagée par le journal (fiche 080, masquage) et la mémoire (fiche 182,
 * refus). Pur, pour les tests.
 *
 * Reconnus : les valeurs déclarées secrètes (clés d'API passées aux agents), les formes connues de
 * clés et de jetons (`sk-…`, `ghp_…`, `Bearer …`, clés AWS, clés privées), les champs nommés comme
 * des secrets (`apiKey`, `token`, `password`…), les adresses avec mot de passe et le jeton du
 * serveur d'outils de l'app (`/mcp/<jeton>`). Pas d'heuristique d'entropie : trop de faux positifs
 * (empreintes git, identifiants).
 */

const secrets = new Set<string>()

/** Valeur à ne jamais écrire (clé d'API donnée à un agent…) ; ignorée si trop courte. */
export function addSecret(value: string | undefined): void {
  if (value && value.length >= 8) secrets.add(value)
}

/**
 * Formes de secrets : motif global (le masquage remplace chaque occurrence), remplacement pour le
 * journal, et ce que c'est, en anglais (dit à l'agent qui tente de le retenir, ADR-0014).
 */
export interface SecretPattern {
  pattern: RegExp
  replacement: (mask: string) => string
  what: string
}

export const SECRET_PATTERNS: readonly SecretPattern[] = [
  {
    // Jeton du serveur d'outils de l'app dans son adresse.
    pattern: /\/mcp\/[0-9a-f]{16,}/g,
    replacement: (mask) => `/mcp/${mask}`,
    what: "the app's tool server token"
  },
  {
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
    replacement: (mask) => mask,
    what: 'a private key'
  },
  {
    // En-têtes d'autorisation.
    pattern: /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi,
    replacement: (mask) => `$1 ${mask}`,
    what: 'an authorization header'
  },
  {
    // Clés au format courant (OpenAI, Anthropic, GitHub, Slack…).
    pattern: /\b(sk|pk|rk|ghp|gho|ghs|ghu|github_pat|glpat|xox[abp])[-_][A-Za-z0-9_-]{12,}/g,
    replacement: (mask) => mask,
    what: 'an API key or access token'
  },
  {
    // Clés Google (`AIza…`), npm (`npm_…`), Hugging Face (`hf_…`).
    pattern: /\b(?:AIza[0-9A-Za-z_-]{35}|npm_[A-Za-z0-9]{36}|hf_[A-Za-z0-9]{30,})\b/g,
    replacement: (mask) => mask,
    what: 'an API key or access token'
  },
  {
    // Jeton JWT (en-tête et charge en base64url, signature).
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
    replacement: (mask) => mask,
    what: 'a JWT token'
  },
  {
    // Identifiant de clé AWS.
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    replacement: (mask) => mask,
    what: 'an AWS access key'
  },
  {
    // Adresse avec un mot de passe (`https://user:pass@hôte`).
    pattern: /\b([a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)[^\s@/]+@/gi,
    replacement: (mask) => `$1${mask}@`,
    what: 'a URL with a password'
  },
  {
    // Champs nommés comme des secrets, en JSON ou en variable d'environnement.
    pattern:
      /(["']?[A-Za-z0-9_]*(?:api[_-]?key|token|secret|password|passwd|authorization)["']?\s*[:=]\s*["']?)(?!(?:Bearer|Basic)\b|«)([^"',\s}]{4,})/gi,
    replacement: (mask) => `$1${mask}`,
    what: 'a value named like a secret (key, token, password)'
  }
]

/** Texte où chaque secret reconnu est remplacé par `mask`. */
export function maskSecrets(text: string, mask: string): string {
  let out = text
  for (const secret of secrets) out = out.split(secret).join(mask)
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    out = out.replace(pattern, replacement(mask))
  }
  return out
}

/** Premier secret reconnu dans le texte (ce que c'est, en anglais), ou `undefined`. */
export function findSecret(text: string): string | undefined {
  for (const secret of secrets) if (text.includes(secret)) return 'an API key given to an agent'
  for (const { pattern, what } of SECRET_PATTERNS) {
    // Motifs globaux : `lastIndex` remis à zéro par une copie sans `g`.
    if (new RegExp(pattern.source, pattern.flags.replace('g', '')).test(text)) return what
  }
  return undefined
}
