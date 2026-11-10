# 111 — Signature Developer ID et notarisation, prêtes sans compte Apple

- **Statut** : fait (signature réelle à brancher avec le compte Apple)
- **Dépend de** : 012, 059, 073, 105
- **Agents** : les deux (rien de propre à un agent : empaquetage de l'app)

## Pourquoi

Point 6 de l'audit du 2026-10-21 (`docs/audit-maturite-2026-10-21.md`, section 9) : sur un Mac
géré, un `.dmg` signé ad hoc est bloqué par Gatekeeper, souvent aussi par la gestion du
parc (MDM). Il faut un certificat « Developer ID Application » et la notarisation d'Apple.
L'utilisateur n'a pas encore de compte développeur Apple : tout est préparé pour que, le jour venu,
il n'y ait que des secrets à poser. La mise à jour automatique, prévue au départ, est écartée
(ADR-0023).

## Critères d'acceptation

- [x] Relevé : empaquetage et signature d'aujourd'hui, ce que macOS fait d'une app ad hoc
      téléchargée, la marche à suivre de `docs/installation.md`.
- [x] Sans secret, `pnpm package` et `release.yml` donnent exactement la même app qu'avant
      (signature, droits, fichiers, journal d'electron-builder comparés).
- [x] Avec un certificat et des identifiants Apple : signature Developer ID, runtime durci, droits
      justifiés, notarisation et agrafage de l'app puis du `.dmg` (signé), vérification par
      Gatekeeper.
- [x] Un jeu de variables incomplet est refusé avant la construction, en nommant les variables
      manquantes (jamais leur valeur) ; `--strict` (version publiée) refuse aussi un certificat sans
      notarisation, ou l'inverse.
- [x] `release.yml` lit les secrets GitHub Actions (documentés en commentaire), seulement aux étapes
      de signature.
- [x] Essai à blanc : `pnpm package --dry-run` fait lire et valider la configuration par le code
      d'electron-builder, sans rien construire ni signer ; testé (`scripts/signing.test.ts`), avec
      la notarisation du `.dmg` jouée contre un `xcrun` et un `spctl` simulés.
- [x] ~~Mise à jour automatique~~ : écartée par l'utilisateur le 2026-10-21 (ADR-0023).
- [x] Doc : `docs/installation.md`, README (limites connues), et ci-dessous la liste exacte de ce
      que l'utilisateur fera le jour du compte Apple.
- Pas de scénario d'agent factice : rien ne touche ACP ni l'interface.

## Relevé (2026-10-21)

**Empaquetage.** electron-builder 26.17.0 (ADR-0008), configuré par `electron-builder.yml` : cible
`.dmg` arm64, runtime durci (`hardenedRuntime: true`), `build/entitlements.mac.plist` pour l'app
et pour tout ce qu'elle contient (`entitlementsInherit`), verrous Electron (fuses),
`notarize: false`. `scripts/package` choisissait déjà ad hoc sans certificat désigné
(`-c.mac.identity=-`, `CSC_IDENTITY_AUTO_DISCOVERY=false`) et activait la notarisation de l'app
avec `APPLE_ID` ou `APPLE_API_KEY` ; rien ne le vérifiait, le `.dmg` n'était ni signé ni
notarisé, et `release.yml` ne transmettait aucun secret (« signature ad hoc » en dur).

**L'app d'aujourd'hui**, mesurée sur `dist/mac-arm64/Bobine.app` (0.3.0) :

- `codesign -dv` : `flags=0x10002(adhoc,runtime)`, `Signature=adhoc`, `TeamIdentifier=not set` ;
  l'app, ses quatre assistants, `spawn-helper` (node-pty) et AXe portent les trois mêmes droits.
- Exigence désignée : `cdhash H"…"`, l'empreinte de cette construction précise.
- `spctl --assess --type exec` : `rejected`. Le `.dmg` : `code object is not signed at all`.
- `syspolicy_check distribution` (macOS 27) ne relève que deux problèmes : « Adhoc Signed App »
  et « Notary Ticket Missing » (fatal). Rien d'autre ne gênerait la notarisation.

**Ce que macOS fait d'une app ad hoc téléchargée.** Un navigateur pose l'attribut
`com.apple.quarantine` sur le `.dmg`, que le Finder reporte sur l'app copiée. Au premier lancement,
Gatekeeper refuse d'ouvrir une app en quarantaine qui n'est ni signée par un développeur identifié
ni notarisée. Depuis macOS 15, le clic droit › Ouvrir ne contourne plus ce refus : il faut passer
par Réglages Système › Confidentialité et sécurité › « Ouvrir quand même », ce que la gestion du
parc interdit souvent sur un Mac géré. D'où la marche à suivre de `docs/installation.md` :
télécharger avec `curl` (pas de quarantaine) ou `xattr -d com.apple.quarantine` sur le `.dmg`, ou
construire l'app sur place (`pnpm package --dir`).

Au-delà de Gatekeeper, l'exigence ad hoc (l'empreinte) change à chaque version. Pour macOS, chaque
nouvelle version est donc une autre app : il redemande « Enregistrement de l'écran » et l'accès à
l'entrée « Bobine Safe Storage » du trousseau, et refuse d'emblée les notifications (ADR-0008).
Signée Developer ID, l'exigence porte sur l'identifiant de l'équipe et celui de l'app : attendu
stable d'une version à l'autre, à constater le jour du certificat.

## Droits du runtime durci

| Droit | Pourquoi |
|---|---|
| `com.apple.security.cs.allow-jit` | V8 compile le JavaScript à la volée (processus principal et assistants) |
| `com.apple.security.cs.allow-unsigned-executable-memory` | Droit du modèle d'Electron, gardé tel quel ; à essayer sans avec un vrai certificat |
| `com.apple.security.cs.disable-library-validation` | node-pty (`pty.node`) chargé par le processus principal ; ad hoc, sans équipe, la validation refuserait toutes les bibliothèques (electron-builder l'exige d'ailleurs pour l'ad hoc) |

Pas d'autre droit nécessaire : l'app n'est pas dans le bac à sable (réseau, fichiers, trousseau,
processus fils libres), ne pilote aucune app par Apple Events (pas d'`osascript`), n'utilise ni
micro ni caméra. La capture d'écran passe par `/usr/sbin/screencapture`, qui relève d'une
autorisation de macOS, pas d'un droit. `spawn-helper` et AXe reçoivent les mêmes droits
(`entitlementsInherit`) ; AXe charge ses frameworks, re-signés avec l'app, et ceux de Xcode,
signés par Apple. `scripts/signing.mts` vérifie que le fichier porte exactement ces trois droits.

**Proposition, non décidée** : une fois l'app signée Developer ID, tout ce qu'elle charge porte la
même équipe, et `disable-library-validation` pourrait ne plus servir. Le retirer (dans un second
fichier de droits, l'ad hoc en a besoin) empêcherait une bibliothèque étrangère d'être chargée
dans l'app. Coût : un essai réel avec le certificat (terminal, AXe), et un risque de lancement
cassé si un module y échappe. À trancher par l'utilisateur ce jour-là.

## Le jour du compte Apple : ce que l'utilisateur fait

1. **Créer le certificat** « Developer ID Application » : Xcode › Réglages › Comptes › l'équipe ›
   Gérer les certificats › + › Developer ID Application (seul le titulaire du compte peut le
   créer). Puis Trousseau d'accès › Mes certificats › ce certificat › Exporter… en `.p12`, avec un
   mot de passe.
2. **Créer une clé d'API** App Store Connect : Utilisateurs et accès › Intégrations › Clés de
   l'équipe › +, rôle « Developer ». Télécharger `AuthKey_XXXXXXXXXX.p8` (une seule fois possible),
   noter l'identifiant de la clé et l'« Issuer ID ».
3. **Poser les secrets** du dépôt :

   ```bash
   base64 -i DeveloperID.p12 | gh secret set MAC_CERTIFICATE_P12 -R jlallement/bobine
   ```

   ```bash
   gh secret set MAC_CERTIFICATE_PASSWORD -R jlallement/bobine
   ```

   ```bash
   gh secret set APPLE_API_KEY_P8 -R jlallement/bobine < AuthKey_XXXXXXXXXX.p8
   ```

   ```bash
   gh secret set APPLE_API_KEY_ID -R jlallement/bobine
   ```

   ```bash
   gh secret set APPLE_API_ISSUER -R jlallement/bobine
   ```

4. **Relancer `release.yml`** à la main (Actions › Release › Run workflow) : l'étape « Signature,
   essai à blanc » doit dire « Signature Developer ID » et « Notarisation : clé d'API App Store
   Connect », puis « Vérifier la signature et la notarisation » doit passer. Le prochain tag publie
   le `.dmg` signé.

## Plan

- `scripts/signing.mts` (nouveau) : plan de signature tiré de l'environnement (fonction pure),
  arguments `-c.…` pour electron-builder, essai à blanc (`getConfig` et `validateConfiguration`
  d'electron-builder, droits vérifiés), notarisation et agrafage du `.dmg` (`xcrun notarytool`,
  `stapler`, `spctl`).
- `scripts/package` : `--dry-run`, `--strict`, plan lu par `signing.mts`, `.dmg` notarisé après
  electron-builder.
- `electron-builder.yml`, `build/entitlements.mac.plist` : commentaires (droits justifiés), aucun
  changement de valeur.
- `.github/workflows/release.yml` : secrets documentés, clé `.p8` écrite dans un fichier
  temporaire puis effacée, essai à blanc, construction `--strict`, vérification de la signature.
- `scripts/signing.test.ts` : plan, essai à blanc, `pnpm package --dry-run`, notarisation simulée.
- Aucune nouvelle dépendance (electron-builder et ses outils sont déjà là ; `xcrun notarytool` vient
  de Xcode).

## Journal

- 2026-10-27 — Fiche 153 / ADR-0034 : le hook `native-dmg.mts` remplace la cible dmg-builder.
  La signature du DMG lit `dmg.sign` et utilise le même choix d’identité Developer ID et le
  trousseau d’electron-builder avant son nettoyage ; la notarisation/agrafage reste ici.
- 2026-10-21 — Fiche créée (session lancée depuis la feuille de route de l'audit). Relevé ci-dessus.
  Options de mise à jour présentées (electron-updater, contrôle maison + `autoUpdater` d'Electron
  recommandé, remplacement maison) : l'utilisateur écarte la mise à jour automatique, faute de
  droits pour installer une nouvelle version sur un poste géré → ADR-0023, pas d'interface
  ni de réglage ajoutés.
- 2026-10-21 — Fait, sauf la signature réelle. `pnpm package` sans secret, comparé à la
  construction d'avant la fiche : même journal d'electron-builder (signature ad hoc, notarisation
  sautée), même `codesign -dv` (hors empreintes), mêmes droits, mêmes 362 fichiers,
  `codesign --verify --deep --strict` valide ; `pnpm e2e:packaged` vert. `./scripts/verify` vert.
- Écarts au plan d'origine :
  - Pas de mise à jour automatique (ADR-0023), donc rien dans Réglages › À propos, pas de ligne
    dans les `CHANGELOG` : rien ne change pour l'utilisateur de l'app tant qu'elle n'est pas signée.
  - Le `.dmg` est maintenant signé (`dmg.sign`), notarisé et agrafé lui aussi quand l'app l'est :
    electron-builder ne notarise que l'app.
  - `APPLE_KEYCHAIN_PROFILE` est accepté (profil `notarytool store-credentials`, pour signer en
    local) ; avant, `scripts/package` ne l'activait pas.
  - Le mot de passe d'app ou la clé passent en arguments de `notarytool`, comme le fait
    `@electron/notarize` pour l'app : visibles dans la liste des processus du runner, éphémère.
- Non vérifié (impossible sans compte Apple) : signature et notarisation réelles, verdict de
  Gatekeeper sur l'app et le `.dmg` signés, persistance des autorisations d'une version à
  l'autre.
- Reste à faire, une fois la première version signée publiée : retirer de `docs/installation.md`
  et des README le contournement de la quarantaine ; trancher la proposition sur
  `disable-library-validation`.
- 2026-10-23 — **Release v0.5.0 échouée** : sans secret posé, `release.yml` passe `CSC_LINK=""` ;
  le plan le lisait comme absent (ad hoc) mais electron-builder, lui, lit la variable vide comme un
  certificat désigné et échoue sur « /Users/runner/work/bobine/bobine not a file ». Le plan efface
  désormais les variables de certificat présentes mais vides (`unset` dans ce que `pnpm package`
  évalue) ; l'essai à blanc ne pouvait pas le voir, il ne lance pas electron-builder. Test ajouté.
