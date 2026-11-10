# 104 — Fournisseurs de modèles d'OpenCode depuis les réglages (modèles internes, LLMaaS)

- **Statut** : fait
- **Dépend de** : 022 (clés d'API chiffrées), 025 (fichiers de configuration d'OpenCode),
  061 (diagnostic), 078 (OpenCode 2)
- **Agents** : OpenCode. Bob n'a pas de fournisseur à choisir (ADR-0011 : déclaré dans le profil,
  listé dans Réglages › Agents et dans `docs/agents.md`).

## Pourquoi

Des modèles internes (Qwen, Mistral…) sont souvent servis en LLMaaS par un point d'accès
compatible OpenAI. Les utiliser dans Bobine au lieu de brûler des bobcoins demande aujourd'hui
d'écrire à la main un bloc `provider` dans `~/.config/opencode/opencode.json` (adresse, clé,
modèles) et `enabled_providers`, puis de deviner pourquoi ça ne répond pas (proxy, certificat
d'entreprise, clé). La plupart des utilisateurs ne le feront pas. C'est le chantier 2 de l'audit du 2026-10-21
(`docs/audit-maturite-2026-10-21.md`).

## Critères d'acceptation

- [x] Réglages › Agents et dossiers › OpenCode › « Fournisseurs de modèles » : liste des
      fournisseurs du fichier d'OpenCode (nom, adresse, nombre de modèles, activé ou non) ;
      ajouter, modifier, retirer un fournisseur compatible OpenAI (nom, adresse de base, modèles
      avec leur identifiant et leur libellé) ; « Seulement ces fournisseurs » (`enabled_providers`).
- [x] La clé d'API du fournisseur est chiffrée dans le trousseau comme celles des agents
      (`ApiKeyStore`), jamais écrite en clair dans `opencode.json`, et posée dans l'environnement
      d'OpenCode au lancement par la variable que le fournisseur attend.
- [x] « Tester » : un appel `GET <adresse>/models` avec la clé, sans jeton de modèle, qui dit
      « répond, N modèles » ou l'erreur expliquée (connexion refusée, proxy, certificat non
      reconnu, clé refusée), avec la marche à suivre.
- [x] Proxy et certificats d'entreprise : `HTTPS_PROXY` / `NO_PROXY` et un fichier de certificats
      (`NODE_EXTRA_CA_CERTS` ou l'équivalent attendu par OpenCode) repris du shell de connexion ou
      renseignés dans ces réglages, transmis à OpenCode à son lancement.
- [x] Réglages › Diagnostic : une ligne par fournisseur activé (adresse jointe ou non, cause).
- [x] Le fichier d'OpenCode est modifié avec `jsonc-parser` (commentaires et autres clés
      conservés), copie de secours avant écriture, comme pour les serveurs MCP (fiche 025).
- [x] Déclaré dans le profil OpenCode (`specificItems`), dans Réglages › Agents (« Propre à
      OpenCode ») et dans la matrice de `docs/agents.md` ; `opencode-probe` vérifie le format
      attendu de `provider` sur la version installée.
- [x] Testé contre l'agent factice ou un faux serveur HTTP local pour « Tester » (répond, refuse
      la clé, certificat inconnu) ; suite e2e `settings` (ou nouvelle suite `providers`) verte,
      captures regardées en clair et sombre, FR et EN.

## Relevé (OpenCode 2.0.32, 2026-10-21, sans modèle)

Sondé par `pnpm opencode-probe --offline` (sondage « fournisseurs », faux point d'accès compatible
OpenAI de `e2e/fixtures/openai-compatible.mts`) :

- Format lu dans `~/.config/opencode/opencode.json` : `provider.<id>` = `{ npm:
  "@ai-sdk/openai-compatible", name, options: { baseURL, apiKey }, models: { <id>: { name } } }` ;
  `enabled_providers: [<id>]` ne laisse que ces fournisseurs (`opencode models` et le réglage
  « Model » de `session/new` ne proposent plus que `<id>/<modèle>`) ; `disabled_providers` existe
  aussi (prioritaire).
- `options.apiKey: "{env:VAR}"` est remplacé par la variable de l'environnement donné à
  `opencode acp` : la clé arrive en `Authorization: Bearer` au point d'accès
  (`POST <baseURL>/chat/completions`). Une variable absente devient une chaîne vide.
- `NODE_EXTRA_CA_CERTS=<pem>` fait accepter un certificat auto-signé (doc « Network » d'OpenCode :
  « works for both proxy connections and direct API access ») ; `HTTPS_PROXY=http://hôte:port`
  fait passer la connexion par un proxy `CONNECT` (`NO_PROXY=localhost,127.0.0.1` conseillé par la
  doc pour le trafic local). Pas d'autre variable documentée (`SSL_CERT_FILE` est propre à Bun, pas
  documenté par OpenCode : non utilisé).
- La connexion propre à OpenCode (`opencode auth login`, `~/.local/share/opencode/auth.json`) reste
  possible en parallèle : l'app ne touche pas à `auth.json`.

## Plan

Aucune nouvelle dépendance. Le fichier d'OpenCode reste la référence (comme les serveurs MCP, fiche
025) ; l'app n'en garde que les clés (trousseau) et les réglages réseau (`settings.json`).

**Choix** : les réglages réseau (proxy, certificats) sont **génériques** — posés dans
l'environnement de tous les agents, pas seulement d'OpenCode (Bob est aussi un programme Node
derrière le même proxy), dans une section « Réseau d'entreprise » de Réglages › Agents ; seuls les
fournisseurs de modèles sont propres à OpenCode (profil `providers: 'opencode'`). Fournisseurs
du fichier global seulement (`~/.config/opencode/opencode.json`), pas du projet : un point d'accès
interne vaut pour tous les dossiers.

1. `shared/providers.ts` : `ModelProvider` (id, nom, adresse, modèles `{ id, name }`, activé,
   clé : `{env:VAR}` / en clair dans le fichier / `{file:…}` / aucune), `ProvidersView` (par agent :
   fichier, fournisseurs, « seulement ceux-là », état des clés sans leurs valeurs, erreur de
   lecture), `ProviderTestResult` (répond + N modèles, ou cause : `refused`, `dns`, `timeout`,
   `proxy`, `certificate`, `unauthorized`, `http`, `other`), `NetworkSettings` (proxy, sans
   proxy, fichier de certificats), `parseModelProvider` (saisie vérifiée), `keyVariableFor(id)`
   (`LLMAAS_API_KEY` pour `llmaas`).
2. `main/agent-config/provider-files.ts` : `AgentProvidersConfig` (format `opencode`) — lecture
   (`readConfig` sorti de `mcp-files.ts`), `save` (nouveau : `npm` compatible OpenAI, clé en
   `{env:VAR}` ; existant : champs inconnus gardés, dont ceux de chaque modèle), `remove`,
   `setEnabled` (`enabled_providers` s'il existe, sinon `disabled_providers`), `setOnly`
   (`enabled_providers` = fournisseurs activés du fichier, ou retiré), `useKeyVariable` (remplace
   une clé en clair par `{env:VAR}`). `jsonc-parser` ; `writeFileAtomic(…, { backup: true })` :
   `opencode.json.bak` avant chaque écriture.
3. `main/agent-config/provider-probe.ts` : « Tester » — `GET <adresse>/models` avec la clé,
   `node:https` / `node:http` (tunnel `CONNECT` par le proxy, certificats système + fichier
   d'entreprise), 10 s ; réponse comptée (`data[]`), erreurs classées avec la marche à suivre.
4. `main/agent-config/providers-settings.ts` : `ProvidersSettings` (profils à `providers`,
   dossier personnel, `ApiKeyStore`, réglages réseau) — liste, enregistrement, clé (chiffrée sous
   `<agent>:<VAR>`, comme celles des agents), test, `keySpecs(profil)` (variables des fournisseurs
   du fichier, posées au lancement), `diagnose()` (une ligne par fournisseur activé).
   `providers-ipc.ts` : canaux `providers:*` et `settings:network` / `settings:setNetwork`.
5. Environnement des agents : `shell-env.ts` relit aussi `HTTPS_PROXY`, `HTTP_PROXY`, `NO_PROXY`,
   `NODE_EXTRA_CA_CERTS` du shell de connexion (posés dans l'app s'ils y manquent) ;
   `SettingsStore.credentials(profil)` ajoute les clés des fournisseurs (`providerKeys`) et les
   réglages réseau saisis (`HTTPS_PROXY` + `HTTP_PROXY`, `NO_PROXY` sinon `localhost,127.0.0.1`,
   `NODE_EXTRA_CA_CERTS`). Ni `manager.ts` ni `agent-host.ts` ne changent (fiche 103).
6. Profil OpenCode (et factice, pour les essais) : `providers: 'opencode'` ; `capabilities.ts` :
   repère `model-providers` ; `docs/agents.md` (matrice), `docs/acp.md` (compatibilité OpenCode),
   `docs/architecture.md`.
7. Renderer : `ProvidersSettings.tsx` (section « Fournisseurs de modèles » de Réglages › Agents :
   liste par agent, interrupteur, pastille et « Tester », modifier, supprimer en deux clics, clé
   « Définir / Remplacer / Supprimer », case « Seulement ces fournisseurs », formulaire nom /
   identifiant / adresse / modèles « id = libellé » par ligne) ; section « Réseau d'entreprise »
   (proxy, sans proxy, fichier de certificats, valeur du shell en indication) ; recherche dans les
   réglages ; Diagnostic : groupe « Fournisseurs de modèles » (`providers:diagnose`).
8. Essais : unitaires (fichier : commentaires et clés gardés, `.bak` ; test contre le faux serveur :
   N modèles, clé refusée, connexion refusée, certificat inconnu puis accepté, proxy ; variables
   posées au lancement), `e2e/suites/providers.mjs` (agent factice, dossier personnel jetable, faux
   serveur), captures clair / sombre / anglais.

## Journal

- 2026-10-21 — Fiche créée (audit de maturité, chantier 2).
- 2026-10-21 — **Implémenté** selon le plan, après le relevé sur OpenCode 2.0.32 (sondage
  « fournisseurs » de `pnpm opencode-probe --offline`, attentes enregistrées à la main dans
  `opencode-probe.expected.json`, trois vérifications de plus au contrat).
  - Main : `shared/providers.ts`, `provider-files.ts` (`readConfig` et `FORMATTING` sortis de
    `mcp-files.ts`), `provider-probe.ts`, `network-env.ts`, `providers-settings.ts`,
    `providers-ipc.ts` ; `shell-env.ts` relit les quatre variables réseau ;
    `SettingsStore.credentials` pose clés des fournisseurs et réseau ; `Settings.network`.
    Profils OpenCode et factice : `providers: 'opencode'` ; repère `model-providers`.
  - Renderer : `ProvidersSettings.tsx`, `NetworkSettings.tsx` (sections de Réglages › Agents,
    agents installés seulement), recherche dans les réglages, groupe « Fournisseurs de modèles » du
    Diagnostic (`providers:diagnose`, testé côté main).
  - Essais : unitaires (fichier, « Tester » contre le faux serveur avec certificat auto-signé et
    faux proxy `CONNECT`, réglages, composant), suite e2e `providers` (clair, sombre, anglais),
    `settings` et `diagnostic` relancées ; captures `86-fournisseurs-*`.
  - Écarts au plan : aucun. Réseau d'entreprise générique (tous les agents), pas propre à OpenCode.
  - Non vérifié : un vrai point d'accès interne derrière le vrai proxy de l'entreprise (seul
    l'utilisateur l'a) ; `NODE_EXTRA_CA_CERTS` et `HTTPS_PROXY` sont vérifiés sur OpenCode avec un
    certificat auto-signé et un faux proxy local, pas avec un proxy qui demande NTLM / Kerberos
    (la doc d'OpenCode renvoie alors à une passerelle). Bob : variables posées, comportement non
    vérifié (Bob indisponible en développement).
- 2026-10-23 (écart, fiche 126) : la suppression en deux clics sur la corbeille est remplacée par
  une confirmation dans la ligne (« Supprimer · Garder »), même règle pour toutes les suppressions
  et révocations des Réglages.
- 2026-10-23 (écart, fiche 126) : retirer la dernière entrée retire aussi son conteneur vide, et
  supprime le fichier s'il ne contient plus rien d'autre.
