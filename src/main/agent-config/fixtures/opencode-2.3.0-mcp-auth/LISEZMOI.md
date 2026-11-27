Relevés réels du 2026-11-27 (OpenCode 2.3.0, macOS, profils isolés par XDG_*), assainis :
client_id, state, code_challenge et port remplacés par des valeurs factices. Octets bruts conservés
(codes ANSI, retours chariot, tourniquet).
- sortie-reussie.txt : `opencode mcp auth figma --standalone`, accord donné dans le navigateur.
- sortie-annulee.txt : même commande, processus interrompu par SIGTERM pendant l'attente (« Cancelled »).
- Expiration (non conservée en octets, relevée à l'écran) : après ~618 s sans accord, lignes
  « ■  Authorization expired » puis « └  Failed », code de sortie 0.
