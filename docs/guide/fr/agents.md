# Agents

Bobine pilote **IBM Bob** et **OpenCode**, et tout agent qui parle le protocole ACP. L'essentiel
marche de la même façon avec tous ; certaines fonctions dépendent de ce que l'agent propose.

Ici, vous pouvez :

- [comparer IBM Bob et OpenCode](#comparer) ;
- lire la [page d'un agent](#page-agent) dans les réglages ;
- [donner une clé d'API à IBM Bob](#cle-bob) ;
- [déclarer un fournisseur de modèles pour OpenCode](#fournisseurs) ;
- [ajouter un autre agent ACP](#autre-agent) ;
- [régler le réseau d'entreprise](#reseau).

<a id="comparer"></a>

## IBM Bob et OpenCode : ce qui change

| | IBM Bob | OpenCode |
|---|---|---|
| Connexion | SSO ou clé d'API, dans Bobine | `opencode auth login`, dans un terminal |
| Avant de commencer | dossier à approuver, licence à accepter | rien |
| Modes | Agent, Plan, Ask | `build`, `plan` (réglage « Session Mode ») |
| Choix du modèle | non | oui, et « Effort » selon le modèle |
| Autorisations | avant d'écrire et de lancer une commande | aucune par défaut |
| Coût | en Bobcoins, quota du mois affiché | en dollars (0 avec un modèle gratuit), avec les jetons |
| Remplissage du contexte | non communiqué | affiché |
| [Plusieurs dossiers](plusieurs-dossiers.md) | pas encore | oui (2.0.31 et plus) |
| Modèle d'une conversation fille | l'agent choisit | à choisir, ou suggéré par la mère |
| Fichiers exclus | `.gitignore`, `.bobignore` et `.env` : non proposés avec `@` | aucun |
| Fichiers de consignes | `AGENTS.md`, `.bob/rules/` | `AGENTS.md` (jusqu'au dossier personnel) |
| Serveurs MCP | `.bob/mcp.json`, `~/.bob/settings/mcp.json` | `opencode.json` |
| Commandes « / » et skills | `.bob/commands`, `.bob/skills` | `.opencode/commands`, `.opencode/skills`, `.claude/skills`… |

<a id="autorisations"></a>

**OpenCode et les autorisations.** Par défaut, OpenCode ne demande rien, même pour écrire hors du
dossier. Pour qu'il demande avant de toucher un autre dossier, ajoutez cette règle à
`permissions` dans `opencode.json` :

```json
{ "action": "external_directory", "resource": "*", "effect": "ask" }
```

**Le quota d'IBM Bob** s'affiche sous son nom, en bas de la barre latérale : part consommée du
mois (orange à 80 %, rouge à 95 %). Un clic donne le détail et **Actualiser**. Les chiffres viennent
du serveur de Bob, toutes machines confondues.

<a id="page-agent"></a>

## La page d'un agent

Réglages › Agents, puis cliquez sur un agent :

- son état, sa version, sa commande, et **Relancer** (redémarre l'agent de la conversation en
  cours) ;
- **Connexion** : ses clés d'API, quand il en a ;
- **Fournisseurs de modèles** (OpenCode) ;
- **Ce qu'il annonce** : ce que l'agent dit savoir faire (reprendre une conversation, images,
  fichiers joints, outils de l'app, autres dossiers…), relevé à son dernier démarrage ;
- **Propre à …** : ce que Bobine fait en plus avec lui, dont les **versions vérifiées**.

Quand un agent annonce une version que Bobine n'a pas vérifiée, Réglages › Diagnostic le dit : ses
fonctions propres peuvent ne pas marcher.

<a id="cle-bob"></a>

## Donner une clé d'API à IBM Bob

À la place de la connexion SSO : Réglages › Agents › IBM Bob › **Connexion** › **Clé d'API Bob
Shell** › **Définir**. Il faut une clé personnelle. Elle est chiffrée dans le trousseau macOS.
Vous pouvez aussi la saisir sur la carte « Connexion requise » (**Utiliser une clé d'API**).

<a id="fournisseurs"></a>

## Déclarer un fournisseur de modèles pour OpenCode

Pour utiliser un point d'accès compatible OpenAI (les modèles internes de votre entreprise) :

1. Réglages › Agents › OpenCode › **Fournisseurs de modèles** › **Ajouter un fournisseur**.
2. Donnez son identifiant, son nom, son adresse de base, ses modèles et sa clé.
3. **Tester** dit s'il répond, combien de modèles il liste, ou pourquoi pas (connexion refusée,
   proxy, certificat, clé refusée).

**Seulement ces fournisseurs** cache les autres. La clé est chiffrée dans le trousseau macOS,
jamais écrite dans `opencode.json`.

<a id="autre-agent"></a>

## Ajouter un autre agent ACP

Réglages › Agents › **Ajouter un agent ACP…** : nom, commande avec ses arguments, variables
d'environnement, et au besoin la variable de sa clé d'API et sa commande de compaction. Il a
ensuite sa page comme les autres, avec **Modifier…** et **Supprimer cet agent**.

Un tel agent a tout ce que permet le protocole ACP : conversation, outils et autorisations, plan,
modes, commandes « / », consommation, reprise, outils de Bobine.

<a id="reseau"></a>

## Régler le réseau d'entreprise

Réglages › Agents › **Réseau d'entreprise** : proxy, hôtes sans proxy et certificats de
l'entreprise, repris du shell de connexion ou saisis ici. Ils sont transmis à tous les agents à
leur prochain démarrage.
