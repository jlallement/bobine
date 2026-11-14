// Généré par scripts/i18n-types.mts à partir de locales/fr.json : ne pas modifier.

export type FrResources = {
  readonly sidebar: {
    readonly status: {
      readonly idle: 'Arrêté'
      readonly starting: 'Démarrage…'
      readonly ready: 'Prêt'
      readonly busy: 'Répond…'
      readonly error: 'Erreur'
      readonly exited: 'Arrêté (planté)'
      readonly 'needs-action': 'Action requise'
      readonly authExpired: 'Connexion expirée'
      readonly modelRefused: 'Modèle refusé'
      readonly 'read-only': 'Lecture seule'
    }
    readonly attention: {
      readonly request: 'Attend votre réponse'
      readonly done: 'Réponse à lire'
      readonly error: 'Erreur'
    }
    readonly agent: 'Agent'
    readonly hide: 'Masquer la barre latérale'
    readonly newConversation: 'Nouvelle conversation'
    readonly search: 'Rechercher'
    readonly pinned: 'Épinglées'
    readonly recent: 'Récents'
    readonly byFolder: 'Dossiers'
    readonly archived: 'Archivées'
    readonly settingsTip: 'Réglages (⌘,)'
    readonly settings: 'Réglages'
    readonly notifications: {
      readonly onTip: 'Notifications activées : cliquer pour les couper'
      readonly offTip: 'Notifications coupées : cliquer pour les activer'
      readonly turnOff: 'Couper les notifications'
      readonly turnOn: 'Activer les notifications'
      readonly blocked: 'Notifications bloquées par macOS'
      readonly blockedHint: 'macOS n’affiche pas les notifications d’une app sans signature de développeur (c’est le cas en développement, et de l’app construite sans certificat). Le badge du Dock et les pastilles restent actifs.'
      readonly openSettings: 'Ouvrir les réglages de notifications'
    }
    readonly worktree: 'Worktree {{branch}}'
    readonly branchOf: 'Branche de « {{title}} »'
    readonly options: 'Options'
    readonly grouping: {
      readonly label: 'Affichage de l’historique'
      readonly title: 'Afficher'
      readonly recent: 'Récents'
      readonly folder: 'Dossiers'
    }
    readonly resumeSession: 'Reprendre une session…'
    readonly childOf: 'Conversation fille de « {{title}} » : {{state}}'
    readonly childTip: 'Conversation fille de « {{title}} »'
    readonly resize: 'Redimensionner la barre latérale'
    readonly yesterday: 'hier'
    readonly activity: 'Mon activité'
    readonly scheduled: 'Tâches planifiées'
    readonly scheduledTip: 'Exécution planifiée de « {{name}} »'
  }
  readonly toolGroup: {
    readonly running: 'en cours'
    readonly completed: 'terminé'
    readonly failed_one: '{{count}} échec'
    readonly failed_many: '{{count}} échecs'
    readonly failed_other: '{{count}} échecs'
    readonly refused_one: '{{count}} refusé'
    readonly refused_many: '{{count}} refusés'
    readonly refused_other: '{{count}} refusés'
    readonly cancelled_one: '{{count}} interrompu'
    readonly cancelled_many: '{{count}} interrompus'
    readonly cancelled_other: '{{count}} interrompus'
    readonly summary: {
      readonly app: {
        readonly browser_one: '{{count}} action dans le navigateur'
        readonly browser_other: '{{count}} actions dans le navigateur'
        readonly ios_one: '{{count}} action sur le simulateur iOS'
        readonly ios_other: '{{count}} actions sur le simulateur iOS'
        readonly android_one: '{{count}} action sur l’émulateur Android'
        readonly android_other: '{{count}} actions sur l’émulateur Android'
        readonly terminal_one: '{{count}} action dans le terminal'
        readonly terminal_other: '{{count}} actions dans le terminal'
        readonly preview_one: '{{count}} action sur les serveurs de dev'
        readonly preview_other: '{{count}} actions sur les serveurs de dev'
        readonly ask_one: '{{count}} action pour poser une question'
        readonly ask_other: '{{count}} actions pour poser une question'
        readonly browser_many: '{{count}} actions dans le navigateur'
        readonly ios_many: '{{count}} actions sur le simulateur iOS'
        readonly android_many: '{{count}} actions sur l’émulateur Android'
        readonly terminal_many: '{{count}} actions dans le terminal'
        readonly preview_many: '{{count}} actions sur les serveurs de dev'
        readonly ask_many: '{{count}} actions pour poser une question'
        readonly children_one: '{{count}} action sur les conversations filles'
        readonly children_many: '{{count}} actions sur les conversations filles'
        readonly children_other: '{{count}} actions sur les conversations filles'
        readonly memory_one: '{{count}} action sur la mémoire'
        readonly memory_many: '{{count}} actions sur la mémoire'
        readonly memory_other: '{{count}} actions sur la mémoire'
        readonly bobine_one: '{{count}} outil de Bobine'
        readonly bobine_many: '{{count}} outils de Bobine'
        readonly bobine_other: '{{count}} outils de Bobine'
      }
      readonly kind: {
        readonly read_one: '{{count}} lecture'
        readonly read_other: '{{count}} lectures'
        readonly edit_one: '{{count}} modification'
        readonly edit_other: '{{count}} modifications'
        readonly delete_one: '{{count}} suppression'
        readonly delete_other: '{{count}} suppressions'
        readonly move_one: '{{count}} déplacement'
        readonly move_other: '{{count}} déplacements'
        readonly search_one: '{{count}} recherche'
        readonly search_other: '{{count}} recherches'
        readonly execute_one: '{{count}} commande'
        readonly execute_other: '{{count}} commandes'
        readonly think_one: '{{count}} réflexion'
        readonly think_other: '{{count}} réflexions'
        readonly fetch_one: '{{count}} accès réseau'
        readonly fetch_other: '{{count}} accès réseau'
        readonly switch_mode_one: '{{count}} changement de mode'
        readonly switch_mode_other: '{{count}} changements de mode'
        readonly other_one: '{{count}} outil'
        readonly other_other: '{{count}} outils'
        readonly read_many: '{{count}} lectures'
        readonly edit_many: '{{count}} modifications'
        readonly delete_many: '{{count}} suppressions'
        readonly move_many: '{{count}} déplacements'
        readonly search_many: '{{count}} recherches'
        readonly execute_many: '{{count}} commandes'
        readonly think_many: '{{count}} réflexions'
        readonly fetch_many: '{{count}} accès réseau'
        readonly switch_mode_many: '{{count}} changements de mode'
        readonly other_many: '{{count}} outils'
      }
    }
  }
  readonly transcript: {
    readonly branch: {
      readonly original: 'Voir l’original'
      readonly restored_one: '{{count}} fichier remis dans son état d’alors.'
      readonly restored_other: '{{count}} fichiers remis dans leur état d’alors.'
      readonly skipped_one: '{{count}} fichier modifié depuis, non touché.'
      readonly skipped_other: '{{count}} fichiers modifiés depuis, non touchés.'
      readonly banner: 'Nouvelle branche de « {{title}} » : l’échange ci-dessus est repris, l’agent l’a reçu en contexte.'
      readonly restored_many: '{{count}} fichiers remis dans leur état d’alors.'
      readonly skipped_many: '{{count}} fichiers modifiés depuis, non touchés.'
    }
    readonly edit: {
      readonly hint: 'Repart de ce message dans une nouvelle conversation'
      readonly send: 'Envoyer'
      readonly action: 'Modifier'
    }
    readonly retry: 'Réessayer'
    readonly retryBranch: 'Réessayer dans une nouvelle branche'
    readonly copyReply: 'Copier la réponse'
    readonly thought: 'Réflexion'
    readonly plan: 'Plan'
    readonly compaction: {
      readonly running: 'Résumé de la conversation en cours…'
      readonly done: 'Conversation résumée pour libérer du contexte'
      readonly failed: 'Résumé de la conversation échoué'
      readonly cancelled: 'Résumé de la conversation annulé'
    }
    readonly notice: {
      readonly cancelled: 'Réponse interrompue.'
      readonly continuedElsewhere_one: 'Conversation continuée ailleurs : {{count}} échange ajouté depuis l’agent.'
      readonly continuedElsewhere_other: 'Conversation continuée ailleurs : {{count}} échanges ajoutés depuis l’agent.'
      readonly continuedElsewhere_many: 'Conversation continuée ailleurs : {{count}} échanges ajoutés depuis l’agent.'
      readonly refusal: 'L’agent a refusé de répondre.'
      readonly maxTokens: 'Réponse tronquée : limite de tokens atteinte.'
      readonly maxTurnRequests: 'Arrêt : nombre maximal d’étapes atteint.'
      readonly error: 'Erreur : {{message}}'
      readonly exited: 'L’agent s’est arrêté.'
      readonly exitedDetail: 'L’agent s’est arrêté. {{detail}}'
      readonly failed: 'L’agent n’a pas pu démarrer.'
      readonly failedDetail: 'L’agent n’a pas pu démarrer. {{detail}}'
      readonly diagnosticsLink: 'Diagnostic'
    }
    readonly copyMessage: 'Copier le message'
    readonly duration: {
      readonly seconds: '{{seconds}} s'
      readonly minutes: '{{minutes}} min {{seconds}} s'
      readonly hours: '{{hours}} h {{minutes}} min'
      readonly title: 'Durée du tour : {{duration}}'
    }
  }
  readonly common: {
    readonly cancel: 'Annuler'
    readonly close: 'Fermer'
    readonly save: 'Enregistrer'
    readonly keep: 'Garder'
  }
  readonly composer: {
    readonly theAgent: 'L’agent'
    readonly readOnly: {
      readonly title: 'Conversation en lecture seule'
      readonly continue: 'Continuer dans une nouvelle conversation'
    }
    readonly agent: 'Agent'
    readonly attachment: {
      readonly annotateTitle: 'Annoter l’image'
      readonly annotate: 'Annoter {{name}}'
      readonly remove: 'Retirer {{name}}'
      readonly pastedLines_one: '{{name}} · {{count}} ligne'
      readonly openPasted: 'Voir {{name}}'
      readonly pastedLines_many: '{{name}} · {{count}} lignes'
      readonly pastedLines_other: '{{name}} · {{count}} lignes'
    }
    readonly placeholder: {
      readonly new: 'Que voulez-vous faire ?'
      readonly reply: 'Répondre à {{agent}}…'
      readonly default: 'Répondre à l’agent…'
      readonly starting: 'Démarrage de l’agent…'
      readonly busy: 'Ajouter une suite (envoyée à la fin de la réponse)…'
      readonly error: 'L’agent n’a pas pu démarrer : écrivez pour réessayer'
      readonly exited: 'L’agent s’est arrêté : écrivez pour le relancer'
      readonly 'needs-action': 'Action requise avant de commencer'
      readonly authExpired: 'Reconnectez-vous pour continuer'
      readonly modelRefused: 'Choisissez un autre modèle ou connectez-vous'
      readonly needsFolder: 'Choisissez d’abord un dossier'
    }
    readonly plan: {
      readonly placeholder: 'Explorer et planifier avec {{agent}}…'
      readonly placeholderDefault: 'Explorer et planifier avec l’agent…'
      readonly hint: 'Mode Plan : l’agent lit et propose, il ne modifie rien. Maj+Tab pour passer en {{mode}}.'
      readonly hintNoNext: 'Mode Plan : l’agent lit et propose, il ne modifie rien.'
    }
    readonly attach: {
      readonly tip: 'Joindre des fichiers (ou glissez-les, collez une image, tapez @)'
      readonly label: 'Joindre des fichiers'
      readonly menuTip: 'Joindre des fichiers ou capturer l’écran'
      readonly files: 'Joindre des fichiers…'
    }
    readonly capture: {
      readonly tip: 'Capture d’écran : choisissez une zone (Espace : une fenêtre, Échap : annuler)'
      readonly label: 'Capture d’écran'
      readonly item: 'Capturer une zone de l’écran'
      readonly unavailable: {
        readonly denied: 'Capture d’écran indisponible : macOS n’autorise pas Bobine à enregistrer l’écran. Cochez Bobine dans Réglages Système › Confidentialité et sécurité › Enregistrement de l’écran, puis relancez l’app.'
        readonly restricted: 'Capture d’écran indisponible : l’enregistrement de l’écran est bloqué sur ce Mac (profil de gestion ou contrôle parental).'
        readonly failed: 'La capture n’a rien donné : macOS a sans doute refusé l’image. Vérifiez que Bobine est coché dans Réglages Système › Confidentialité et sécurité › Enregistrement de l’écran, puis relancez l’app.'
        readonly openSettings: 'Ouvrir les Réglages Système'
      }
    }
    readonly stop: 'Arrêter (Échap)'
    readonly send: {
      readonly queued: 'Envoyer à la fin de la réponse (Entrée)'
      readonly now: 'Envoyer (Entrée)'
    }
    readonly exited: 'L’agent s’est arrêté.'
    readonly failedToStart: 'L’agent n’a pas pu démarrer.'
    readonly restart: 'Relancer'
    readonly pasted: {
      readonly size_one: '{{count}} ligne, {{chars}} caractères'
      readonly putBack: 'Remettre dans la saisie'
      readonly size_many: '{{count}} lignes, {{chars}} caractères'
      readonly size_other: '{{count}} lignes, {{chars}} caractères'
    }
    readonly excluded: {
      readonly one: '« {{names}} » est exclu par {{files}} : {{agent}} ne l’ouvrirait pas lui-même. Le joindre quand même ?'
      readonly many: '{{count}} fichiers sont exclus par {{files}} ({{names}}) : {{agent}} ne les ouvrirait pas lui-même. Les joindre quand même ?'
      readonly attach: 'Joindre quand même'
      readonly skip: 'Ne pas joindre'
      readonly unchecked: 'Impossible de vérifier les fichiers d’exclusion de {{agent}} pour « {{names}} ». Joindre quand même ?'
    }
  }
  readonly toolCall: {
    readonly state: {
      readonly waiting: 'autorisation requise'
      readonly running: 'en cours'
      readonly completed: 'terminé'
      readonly failed: 'échec'
      readonly refused: 'refusé'
      readonly cancelled: 'interrompu'
    }
    readonly image: { readonly alt: 'Capture renvoyée par l’outil' }
    readonly subagent: {
      readonly duration: 'Durée du sous-agent'
      readonly cost: 'Coût du sous-agent'
      readonly prompt: 'Consigne'
      readonly answer: 'Réponse'
      readonly noWork: 'L’agent ne transmet pas le travail du sous-agent, seulement sa réponse.'
      readonly work: 'Son travail'
      readonly nothingElse: 'Rien d’autre que sa réponse.'
      readonly loading: 'Relecture de sa session…'
      readonly showWork: 'Voir son travail'
    }
    readonly subagents: {
      readonly title_one: 'Sous-agent'
      readonly title_many: 'Sous-agents'
      readonly title_other: 'Sous-agents'
      readonly running_one: '{{count}} en cours'
      readonly running_many: '{{count}} en cours'
      readonly running_other: '{{count}} en cours'
      readonly waiting_one: '{{count}} attend un accord'
      readonly waiting_many: '{{count}} attendent un accord'
      readonly waiting_other: '{{count}} attendent un accord'
      readonly done_one: '{{count}} fini'
      readonly done_many: '{{count}} finis'
      readonly done_other: '{{count}} finis'
      readonly failed_one: '{{count}} en échec'
      readonly failed_many: '{{count}} en échec'
      readonly failed_other: '{{count}} en échec'
      readonly refused_one: '{{count}} refusé'
      readonly refused_many: '{{count}} refusés'
      readonly refused_other: '{{count}} refusés'
      readonly cancelled_one: '{{count}} interrompu'
      readonly cancelled_many: '{{count}} interrompus'
      readonly cancelled_other: '{{count}} interrompus'
      readonly cost: 'Coût des sous-agents de cette carte'
    }
    readonly permission: {
      readonly cancelled: 'Demande d’autorisation annulée'
      readonly question: {
        readonly subagent: 'Lancer ce sous-agent ?'
        readonly other: 'Autoriser cette action ?'
        readonly create: 'Autoriser la création de ce fichier ?'
        readonly edit: 'Autoriser cette modification ?'
        readonly delete: 'Autoriser cette suppression ?'
        readonly move: 'Autoriser ce déplacement ?'
        readonly execute: 'Autoriser cette commande ?'
        readonly fetch: 'Autoriser cet accès réseau ?'
        readonly todos: 'Autoriser la mise à jour de la liste de tâches ?'
      }
      readonly waiting: 'L’agent attend votre accord pour continuer.'
      readonly rememberNote: '« Toujours » vaut pour {{name}}, dans cette conversation et les prochaines avec {{agent}} (révocable dans Réglages › Confidentialité).'
      readonly rememberTodos: 'la liste de tâches'
      readonly theAgent: 'l’agent'
      readonly agentAlwaysNote: 'C’est l’agent qui décide ce que couvre « toujours ».'
      readonly alwaysConversation: 'Toujours dans cette conversation'
      readonly alwaysScope: {
        readonly execute: '{{agent}} : cette commande et chacune de ses parties, jusqu’à la fin de la conversation.'
        readonly edit: '{{agent}} : toutes les modifications de fichiers de cette conversation, pas seulement celle-ci.'
      }
      readonly args: 'Arguments envoyés à l’outil'
      readonly riskNoAlways: '« Toujours » n’est pas proposé pour une action signalée.'
      readonly risk: {
        readonly outside: 'Écrit hors du dossier de la conversation :'
        readonly dotfile: 'Modifie un fichier de configuration personnel :'
        readonly system: 'Touche un dossier système :'
        readonly privilege: 'Demande les droits d’administrateur ({{via}})'
      }
    }
    readonly label: {
      readonly read: 'Lecture de {{target}}'
      readonly create: 'Création de {{target}}'
      readonly edit: 'Modification de {{target}}'
      readonly delete: 'Suppression de {{target}}'
      readonly move: 'Déplacement de {{target}}'
      readonly search: 'Recherche « {{target}} »'
      readonly searchIn: 'Recherche dans {{target}}'
      readonly list: 'Liste de {{target}}'
      readonly fetch: 'Page {{target}}'
      readonly todos_one: 'Mise à jour de la liste de tâches ({{count}})'
      readonly todos_many: 'Mise à jour de la liste de tâches ({{count}})'
      readonly todos_other: 'Mise à jour de la liste de tâches ({{count}})'
      readonly others_one: '{{target}} et {{count}} autre'
      readonly others_many: '{{target}} et {{count}} autres'
      readonly others_other: '{{target}} et {{count}} autres'
      readonly preparing: {
        readonly edit: 'Prépare une modification…'
        readonly execute: 'Prépare une commande…'
        readonly read: 'Prépare une lecture…'
        readonly search: 'Prépare une recherche…'
        readonly other: 'Prépare un outil…'
      }
      readonly kindName: {
        readonly read: 'Lecture'
        readonly create: 'Création'
        readonly edit: 'Modification'
        readonly delete: 'Suppression'
        readonly move: 'Déplacement'
        readonly search: 'Recherche'
        readonly execute: 'Commande'
        readonly fetch: 'Page web'
      }
    }
    readonly untitled: 'Outil'
    readonly todos: {
      readonly done: 'Faite :'
      readonly inProgress: 'En cours :'
      readonly pending: 'À faire :'
      readonly doneCount_one: '{{count}} faite'
      readonly doneCount_many: '{{count}} faites'
      readonly doneCount_other: '{{count}} faites'
      readonly doingCount_one: '{{count}} en cours'
      readonly doingCount_many: '{{count}} en cours'
      readonly doingCount_other: '{{count}} en cours'
      readonly todoCount_one: '{{count}} à faire'
      readonly todoCount_many: '{{count}} à faire'
      readonly todoCount_other: '{{count}} à faire'
    }
    readonly command: {
      readonly chipTitle: 'Dossier de la conversation : {{path}}'
      readonly label: 'Commande'
      readonly in: 'Dans'
      readonly outside: 'hors du dossier de la conversation'
      readonly scroll_one: '{{n}} ligne — faites défiler pour tout lire'
      readonly scroll_other: '{{n}} lignes — faites défiler pour tout lire'
      readonly scroll_many: '{{n}} lignes — faites défiler pour tout lire'
      readonly shownPart: 'Commande de {{size}} : seul le début ({{shown}}) est affiché. « Copier » copie toute la commande.'
      readonly keptPart: 'Commande de {{size}} : seul le début ({{shown}}) a été gardé. « Copier » copie ce début.'
      readonly invisible: 'contient des caractères invisibles'
      readonly announced: 'Titre annoncé par l’agent :'
      readonly shownLines_one: 'Commande de {{n}} ligne : seules les {{shown}} premières sont affichées. « Copier » copie toute la commande.'
      readonly shownLines_other: 'Commande de {{n}} lignes : seules les {{shown}} premières sont affichées. « Copier » copie toute la commande.'
      readonly shownLines_many: 'Commande de {{n}} lignes : seules les {{shown}} premières sont affichées. « Copier » copie toute la commande.'
      readonly hintMore: '… (ouvrir la ligne pour tout lire)'
    }
  }
  readonly usage: {
    readonly label: 'Consommation de la conversation'
    readonly compactTip: 'Contexte utilisé : {{percent}} % (détail au clic)'
    readonly context: 'Contexte'
    readonly contextHint: 'Le contexte se remplit : l’agent risque de résumer l’échange ou de s’arrêter. Pensez à démarrer une nouvelle conversation.'
    readonly tokensHint: 'Somme des jetons rapportés à chaque échange : le contexte relu (souvent en cache) est compté à chaque fois.'
    readonly lastTurn: 'Dernier échange'
    readonly cost: 'Coût de la conversation'
    readonly sessionCost: 'Cette session'
    readonly otherAgentCost: 'Avant, avec un autre agent'
    readonly spend: {
      readonly today: 'Aujourd’hui'
      readonly week: '7 derniers jours'
      readonly month: 'Ce mois-ci'
    }
    readonly tokens: {
      readonly input: 'Entrée'
      readonly output: 'Sortie'
      readonly cachedRead: 'Lus en cache'
      readonly cachedWrite: 'Écrits en cache'
      readonly thought: 'Réflexion'
      readonly total_one: 'Jetons traités ({{count}} échange)'
      readonly total_other: 'Jetons traités ({{count}} échanges)'
      readonly total_many: 'Jetons traités ({{count}} échanges)'
    }
    readonly title: 'Consommation · {{agent}}'
    readonly contextValue: '{{used}} / {{size}} ({{percent}} %)'
    readonly summary: {
      readonly context: 'Contexte : {{used}} / {{size}} jetons'
      readonly contextPercent: 'Contexte : {{used}} / {{size}} jetons ({{percent}} %)'
      readonly tokens_one: 'Jetons traités : {{total}} sur {{count}} échange ({{input}} en entrée, {{output}} en sortie)'
      readonly tokens_other: 'Jetons traités : {{total}} sur {{count}} échanges ({{input}} en entrée, {{output}} en sortie)'
      readonly cost: 'Coût : {{cost}}'
      readonly none: '{{agent}} n’a encore rien indiqué sur sa consommation dans cette conversation.'
      readonly tokens_many: 'Jetons traités : {{total}} sur {{count}} échanges ({{input}} en entrée, {{output}} en sortie)'
      readonly contextUnknown: '{{agent}} ne transmet pas le remplissage de son contexte : Bobine ne peut pas dire quelle place il reste.'
      readonly compactHint: '{{command}} le résume si la conversation devient longue.'
    }
    readonly tokensValue: '{{tokens}} jetons'
    readonly percent: '{{percent}} %'
    readonly average: 'Moyenne par échange'
    readonly averageHint: 'Ce que coûte en moyenne un échange de cette conversation : à peu près ce que coûtera le prochain.'
    readonly turns: {
      readonly title: 'Par échange, du plus récent au plus ancien'
      readonly older_one: 'et {{count}} plus ancien'
      readonly older_many: 'et {{count}} plus anciens'
      readonly older_other: 'et {{count}} plus anciens'
      readonly tokensTip: 'Jetons en entrée → en sortie'
      readonly tokens: '{{input}} → {{output}}'
    }
    readonly board: {
      readonly openAll: 'Toute mon activité…'
      readonly unknown: 'non communiqué'
      readonly modelUnknown: 'modèle non communiqué'
      readonly inOut: '{{input}} · {{output}}'
      readonly other: 'Autres'
      readonly otherHint: '« Autres » regroupe ce qui dépasse les trois couleurs du graphique.'
      readonly noFolder: 'sans dossier'
      readonly deleted: 'Conversation supprimée'
      readonly byModel: 'Par modèle'
      readonly byProject: 'Par projet'
      readonly topConversations: 'Conversations qui ont le plus consommé'
      readonly columns: {
        readonly model: 'Modèle'
        readonly turns: 'Échanges'
        readonly tokens: 'Jetons entrée · sortie'
        readonly cost: 'Coût'
        readonly perTurn: 'Par échange'
      }
      readonly agent: { readonly label: 'Agent'; readonly all: 'Tous les agents' }
      readonly export: {
        readonly action: 'Exporter…'
        readonly turns: 'Une ligne par échange (CSV)…'
        readonly days: 'Une ligne par jour (CSV)…'
        readonly done: 'Exporté : {{path}}'
      }
      readonly kpi: {
        readonly turns: 'Échanges'
        readonly conversations_one: 'dans {{count}} conversation'
        readonly conversations_many: 'dans {{count}} conversations'
        readonly conversations_other: 'dans {{count}} conversations'
        readonly tokens: 'Jetons traités'
        readonly tokensOf: 'Jetons traités · {{agents}}'
        readonly inOut: 'entrée {{input}} · sortie {{output}}'
        readonly tokensUnknown: 'l’agent ne les communique pas'
        readonly time: 'Temps de travail'
        readonly perTurn: '{{duration}} par échange'
        readonly cost: 'Coût'
        readonly andCost: 'et {{cost}} ({{agents}})'
        readonly costPerTurn: '{{cost}} par échange'
        readonly withoutCost_one: '{{count}} échange sans coût communiqué'
        readonly withoutCost_many: '{{count}} échanges sans coût communiqué'
        readonly withoutCost_other: '{{count}} échanges sans coût communiqué'
      }
      readonly chart: { readonly empty: 'Aucun échange sur cette période' }
      readonly grouping: {
        readonly label: 'Regrouper par'
        readonly agent: 'Agents'
        readonly model: 'Modèles'
      }
      readonly metric: {
        readonly label: 'Mesure'
        readonly turns: 'Échanges'
        readonly time: 'Temps'
        readonly tokens: 'Jetons'
        readonly cost: 'Coût'
        readonly costIn: 'Coût ({{unit}})'
      }
      readonly coverage: {
        readonly tokens_one: 'Jetons : {{covered}} seulement. {{missing}} ne communique pas ses jetons.'
        readonly tokens_many: 'Jetons : {{covered}} seulement. {{missing}} ne communiquent pas leurs jetons.'
        readonly tokens_other: 'Jetons : {{covered}} seulement. {{missing}} ne communiquent pas leurs jetons.'
        readonly metric: '{{metric}} : {{covered}} seulement.'
      }
      readonly account: {
        readonly title: '{{agent}} sur ce Mac'
        readonly quota: 'Quota du mois'
        readonly quotaHint: 'D’après le serveur de {{agent}}, toutes machines confondues, travail hors Bobine compris.'
        readonly quotaValue: '{{used}} sur {{limit}} · {{percent}} %'
        readonly spend: 'Dépense sur ce Mac'
        readonly spendHint: 'D’après la base de {{agent}} sur ce Mac, Bobine et terminal compris. Une conversation utilisée dans la période compte en entier.'
      }
      readonly reset: {
        readonly title: 'Historique'
        readonly label: 'Remettre à zéro'
        readonly hint: 'Efface toute la consommation enregistrée par Bobine, après confirmation. Exportez-la d’abord (Mon activité › Exporter… › Tout l’historique) pour la garder. Le quota des agents, comme celui d’IBM Bob, n’est pas concerné.'
        readonly action: 'Remettre à zéro…'
        readonly confirm: 'Effacer toute la consommation enregistrée ? C’est définitif.'
        readonly confirmAction: 'Remettre à zéro'
        readonly done: 'Consommation remise à zéro. Les prochains échanges seront comptés.'
      }
    }
  }
  readonly elicitation: {
    readonly decline: 'Refuser'
    readonly url: {
      readonly open: 'Ouvrir dans le navigateur'
      readonly ask: 'L’agent vous demande d’ouvrir une page sur <strong>{{host}}</strong>.'
    }
    readonly answer: {
      readonly cancelled: 'Annulé'
      readonly empty: 'Sans réponse'
      readonly skipped: 'Passé'
    }
    readonly result: {
      readonly opened: 'Page ouverte'
      readonly sent: 'Informations envoyées'
      readonly declined: 'Demande refusée'
      readonly cancelled: 'Demande annulée'
    }
    readonly form: {
      readonly hint: 'L’agent a besoin de ces informations pour continuer.'
      readonly send: 'Envoyer'
      readonly choose: 'Choisir…'
    }
    readonly check: {
      readonly text: 'Texte attendu'
      readonly choice: 'Choix non proposé'
      readonly minLength: 'Au moins {{min}} caractères'
      readonly maxLength: 'Au plus {{max}} caractères'
      readonly pattern: 'Format invalide'
      readonly email: 'Adresse e-mail invalide'
      readonly uri: 'URL invalide'
      readonly date: 'Date invalide'
      readonly dateTime: 'Date et heure invalides'
      readonly number: 'Nombre attendu'
      readonly integer: 'Nombre entier attendu'
      readonly minimum: 'Minimum {{min}}'
      readonly maximum: 'Maximum {{max}}'
      readonly list: 'Liste attendue'
      readonly minItems: 'Au moins {{min}} choix'
      readonly maxItems: 'Au plus {{max}} choix'
      readonly boolean: 'Oui / non attendu'
      readonly unsupported: 'Type de champ non pris en charge'
      readonly invalid: 'Réponse invalide'
      readonly unknown: 'Champ inconnu'
      readonly required: 'Champ requis'
    }
  }
  readonly question: {
    readonly tab: 'Question {{number}}'
    readonly multi: 'Plusieurs choix possibles.'
    readonly other: {
      readonly multi: 'Autre réponse…'
      readonly single: 'Autre… (ou une précision)'
    }
    readonly hint: {
      readonly multi: '1–9 ou Espace : cocher · Entrée : valider'
      readonly single: '1–9 ou Entrée : choisir · ↑↓'
    }
    readonly skip: 'Passer'
    readonly send: 'Envoyer'
    readonly next: 'Suivant'
    readonly customAnswer: '« {{text}} »'
  }
  readonly planApproval: {
    readonly proposed: 'Plan proposé'
    readonly cancelled: 'Demande annulée'
    readonly title: 'Plan prêt : on passe à l’action ?'
    readonly hint: 'Relisez le plan. Pour le faire modifier, continuez à planifier puis écrivez vos remarques.'
    readonly keys: '1–9 ou Entrée : choisir · ↑↓'
  }
  readonly queued: {
    readonly interrupted: 'Réponse interrompue : messages en attente'
    readonly sendNowTip: 'Interrompre et envoyer maintenant'
    readonly send: 'Envoyer'
    readonly sendNow: 'Envoyer maintenant'
    readonly editTip: 'Modifier (↑)'
    readonly edit: 'Modifier'
    readonly remove: 'Retirer'
    readonly willSend_one: 'Partira à la fin de la réponse'
    readonly willSend_other: '{{count}} messages partiront à la fin de la réponse'
    readonly willSend_many: '{{count}} messages partiront à la fin de la réponse'
  }
  readonly turnRetry: {
    readonly network: 'Connexion perdue'
    readonly rateLimit: 'Limite de débit atteinte'
    readonly countdown: 'Nouvelle tentative dans {{seconds}} s ({{attempt}} sur {{max}}). Votre message reste en attente.'
    readonly exhausted: 'Connexion impossible'
    readonly rateLimitExhausted: 'Limite de débit toujours atteinte'
    readonly exhaustedDetail: '{{max}} tentatives sans succès. Votre message reste en attente.'
    readonly retryNow: 'Réessayer maintenant'
    readonly retry: 'Réessayer'
  }
  readonly planDocument: {
    readonly title: 'Plan proposé'
    readonly showPlan: 'Voir le plan'
    readonly showDiff: 'Voir ce qui a changé'
    readonly comment: 'Commenter'
    readonly notePlaceholder: 'Votre remarque sur ce passage…'
    readonly addNote: 'Ajouter la remarque'
    readonly note: 'Remarque {{number}}'
    readonly deleteNote: 'Supprimer la remarque {{number}}'
    readonly selectHint: 'Sélectionnez un passage pour le commenter.'
    readonly agentWorking: 'L’agent travaille…'
    readonly sendNotes: 'Envoyer mes remarques'
    readonly execute: 'Exécuter le plan'
    readonly notes_one: '{{count}} remarque'
    readonly notes_other: '{{count}} remarques'
    readonly notes_many: '{{count}} remarques'
    readonly version: 'version {{version}}'
  }
  readonly blocker: {
    readonly trust: {
      readonly title: 'Dossier non approuvé'
      readonly approveInAgent: 'Approuvez ce dossier dans l’agent, puis réessayez.'
      readonly agentMessage: 'Message de l’agent'
      readonly rememberedHint: '{{agent}} ajoutera ce dossier à ses dossiers approuvés : il s’en souviendra pour les prochaines fois.'
      readonly sessionHint: 'L’agent pourra travailler dans ce dossier sans l’avoir approuvé. Ce choix n’est pas mémorisé : à réserver aux dossiers jetables.'
      readonly remembered: 'Faire confiance à ce dossier'
      readonly session: 'Faire confiance pour cette session'
      readonly notApproved: '{{agent}} n’a pas encore approuvé « {{folder}} ».'
      readonly approveWithCommand: 'Pour l’approuver durablement : ouvrez un terminal dans ce dossier, lancez <code>{{command}}</code> et faites confiance au dossier, puis réessayez.'
    }
    readonly workspace: {
      readonly title: 'Choisissez le dossier de votre projet'
      readonly subtitle: 'L’agent y lira et modifiera des fichiers. Vous pourrez en changer à chaque conversation.'
      readonly choose: 'Choisir un dossier…'
    }
    readonly openTerminal: 'Ouvrir un terminal ici'
    readonly retry: 'Réessayer'
    readonly auth: {
      readonly title: 'Connexion requise'
      readonly expiredTitle: 'Connexion expirée'
      readonly expiredSubtitle: '{{agent}} doit se reconnecter avant de continuer.'
      readonly expiredHow: 'Lancez <code>{{command}}</code> dans le terminal de Bobine.'
      readonly expiredRetry: 'Une fois connecté, « Réessayer » renvoie votre dernier message, une seule fois.'
      readonly modelTitle: 'Le modèle {{model}} n’a pas répondu'
      readonly modelSubtitle: 'L’agent n’est pas connecté au fournisseur de ce modèle.'
      readonly chooseModel: 'Choisir un autre modèle'
      readonly toolsRan: 'L’agent avait déjà lancé des outils pour ce message : « Réessayer » le reprend depuis le début.'
      readonly confirmToolsRan: 'Des outils ont déjà tourné pour ce message ; les relancer ?'
      readonly rerun: 'Relancer'
      readonly waitBrowser: 'Terminez la connexion dans votre navigateur…'
      readonly stuck: 'Connecté dans le navigateur, mais rien ne se passe ici ?'
      readonly useApiKey: 'Utiliser une clé d’API'
      readonly finishInTerminal: 'Terminez la connexion dans le terminal, puis réessayez.'
      readonly keyPlaceholder: 'Collez la clé ici'
      readonly signIn: 'Se connecter'
      readonly keyHint: 'Enregistrée chiffrée dans le trousseau macOS ; modifiable dans Réglages → Agents.'
      readonly subtitle: '{{agent}} demande une connexion avant de commencer.'
      readonly failed: 'La connexion a échoué : {{error}}'
    }
    readonly runInTerminal: 'Lance « {{command}} » dans le terminal'
    readonly license: {
      readonly title: 'Licence à accepter'
      readonly hint: 'Lisez-la, puis acceptez-la vous-même dans le terminal en suivant le message ci-dessous : Bobine ne l’accepte jamais à votre place. Réessayez ensuite.'
      readonly subtitle: '{{agent}} demande d’accepter sa licence avant de commencer.'
    }
  }
  readonly mermaid: {
    readonly unknownError: 'erreur inconnue'
    readonly showDiagram: 'Voir le diagramme'
    readonly showCode: 'Voir le code'
    readonly copyCode: 'Copier le code'
    readonly enlarge: 'Agrandir'
    readonly enlargeLabel: 'Agrandir le diagramme'
    readonly dialogTitle: 'Diagramme'
    readonly dialogDescription: 'Diagramme Mermaid agrandi.'
    readonly invalid: 'Diagramme Mermaid invalide : {{error}}'
  }
  readonly diff: {
    readonly newFile: 'nouveau fichier'
    readonly empty: 'Aucune modification.'
    readonly unchanged_one: '{{n}} ligne inchangée'
    readonly unchanged_other: '{{n}} lignes inchangées'
    readonly unchanged_many: '{{n}} lignes inchangées'
    readonly simplified: 'Fichier trop modifié pour une comparaison ligne à ligne : l’ancienne version est affichée, puis la nouvelle.'
  }
  readonly terminalView: {
    readonly truncated: '… début de la sortie omis'
    readonly running: 'En cours…'
    readonly interrupted: 'Interrompue ({{signal}})'
    readonly exitCode: 'Code de sortie {{code}}'
  }
  readonly commandMenu: {
    readonly title: 'Commandes'
    readonly empty: 'Aucune commande ne correspond.'
    readonly appCommand: 'Commande de l’app, avec tous les agents'
    readonly source: { readonly user: 'Vous'; readonly project: 'Projet' }
    readonly keys: '↑↓ choisir · Tab compléter · Entrée valider · Échap fermer'
  }
  readonly fileMenu: {
    readonly empty: 'Aucun fichier ne correspond.'
    readonly keys: '↑↓ choisir · Tab ou Entrée joindre · Échap fermer'
    readonly title: 'Fichiers · {{workspace}}'
  }
  readonly markdown: { readonly copyCode: 'Copier le code' }
  readonly outline: { readonly label: 'Sommaire de la conversation' }
  readonly dropOverlay: { readonly hint: 'Déposez pour joindre au message' }
  readonly attachments: {
    readonly readFailed: 'Lecture impossible'
    readonly tooMany: 'Au plus {{max}} pièces jointes par message.'
    readonly unsupportedImage: 'Format d’image non pris en charge : {{type}}'
    readonly imageTooLarge: 'Image trop lourde (5 Mo au plus) : {{name}}'
    readonly pastedImage: 'image collée'
    readonly failed: 'Impossible de joindre « {{name}} ».'
    readonly noImages: '{{agent}} n’accepte pas les images.'
    readonly check: {
      readonly list: 'Pièces jointes invalides'
      readonly tooMany: 'Au plus {{max}} pièces jointes par message'
      readonly item: 'Pièce jointe invalide'
      readonly image: 'Image invalide'
      readonly imageType: 'Format d’image non pris en charge : {{type}}'
      readonly imageData: 'Image illisible'
      readonly imageSize: 'Image trop lourde : {{name}}'
      readonly path: 'Chemin de fichier invalide'
      readonly mention: 'Mention inconnue'
      readonly kind: 'Pièce jointe inconnue'
      readonly text: 'Texte joint invalide'
      readonly textSize: 'Texte collé trop long (un million de caractères au plus)'
    }
    readonly pastedText: 'Texte collé'
  }
  readonly conversations: {
    readonly none: 'Aucune conversation'
    readonly exported: 'Conversation exportée : {{path}}'
    readonly error: {
      readonly timeout: 'délai dépassé'
      readonly noProfile: 'Aucun profil d’agent disponible'
      readonly unknownStep: 'Étape inconnue : {{step}}'
      readonly unknownKey: 'Clé inconnue pour cet agent : {{env}}'
      readonly noApiKeys: 'Clés d’API indisponibles'
      readonly folderMissing: 'Dossier introuvable : {{folder}}'
      readonly noFolder: 'Choisissez d’abord un dossier'
      readonly noWorktrees: 'Worktrees indisponibles'
      readonly unknownAgent: 'Agent inconnu : {{agent}}'
      readonly noSubagentWork: 'Le travail de ce sous-agent ne peut pas être rejoué.'
      readonly messageMissing: 'Message introuvable'
      readonly busyBranch: 'L’agent répond encore : arrêtez-le avant de repartir d’un message'
      readonly emptyMessage: 'Message vide'
      readonly queuedMissing: 'Message en attente introuvable'
      readonly noChange: 'Aucune modification de ce fichier dans cette conversation'
      readonly noLiveAgent: 'Aucun agent actif pour cette conversation'
      readonly emptyTitle: 'Titre vide'
      readonly busyArchive: 'L’agent répond encore : arrêtez-le avant d’archiver la conversation'
      readonly unknown: 'Conversation inconnue : {{id}}'
      readonly busyFolders: 'L’agent répond encore : changez les dossiers de la conversation après sa réponse'
    }
    readonly newTitle: 'Nouvelle conversation'
    readonly retired: {
      readonly detail: 'L’agent « {{agent}} » n’est plus proposé par l’app : conversation en lecture seule.'
      readonly error: 'L’agent « {{agent}} » n’est plus proposé par l’app'
    }
    readonly untitled: 'Conversation'
    readonly saveFailed: 'Impossible d’enregistrer {{what}} : {{error}}'
    readonly saved: {
      readonly index: 'l’historique'
      readonly settings: 'les réglages'
      readonly transcript: 'la conversation'
    }
    readonly notice: {
      readonly resetFailed: 'La réinitialisation de Bobine n’a pas pu se faire : rien n’a été supprimé, vos données sont restées en place. Détail : {{detail}}'
      readonly folderGone: 'Le dossier « {{folder}} » n’existe plus.'
      readonly historyDamaged_one: 'Une partie de l’historique était illisible : le fichier a été mis de côté ({{files}}).'
      readonly historyDamaged_other: 'Une partie de l’historique était illisible : les fichiers ont été mis de côté ({{files}}).'
      readonly revertedCreated: 'Modification annulée : {{file}}, créé par l’agent, a été supprimé.'
      readonly reverted: 'Modification annulée : {{file}} est revenu à son état d’avant la conversation.'
      readonly revertFailed: 'Impossible de remettre {{file}} dans son état d’avant.'
      readonly untouched: '{{file}} n’a pas été touché : {{why}}.'
      readonly why: {
        readonly conflict: 'il a été modifié depuis (ou supprimé)'
        readonly outside: 'il est hors du dossier de la conversation'
        readonly unchanged: 'il est déjà dans son état d’avant la conversation'
      }
      readonly transcriptDamaged: 'Le fil de cette conversation était illisible : il a été mis de côté ({{files}}) et la conversation repart vide.'
      readonly historyDamaged_many: 'Une partie de l’historique était illisible : les fichiers ont été mis de côté ({{files}}).'
      readonly folderFallback: 'Le dossier « {{folder}} » n’existe plus : la conversation part de « {{fallback}} ».'
    }
    readonly branchSuffix: 'branche'
    readonly saveFailedDiskFull: 'Impossible d’enregistrer {{what}} : le disque est plein. Libérez de la place : Bobine réessaie à la prochaine écriture, et en quittant.'
  }
  readonly copy: {
    readonly action: 'Copier'
    readonly done: 'Copié'
    readonly failed: 'Copie impossible'
  }
  readonly fileLink: {
    readonly title: '{{location}} — ⌥-clic : montrer dans le Finder'
    readonly withLine: '{{path}}, ligne {{line}}'
    readonly missing: 'Fichier introuvable : {{path}}'
    readonly executable: '« {{file}} » peut s’exécuter : montré dans le Finder plutôt qu’ouvert.'
    readonly outside: '« {{file}} » est hors du dossier de la conversation : montré dans le Finder.'
    readonly invalid: 'Lien de fichier invalide : {{href}}'
    readonly pathOutside: 'Chemin hors du dossier de la conversation : {{path}}'
    readonly documentOutside: 'Hors du dossier de la conversation : {{path}}'
    readonly notMarkdown: 'Pas un document Markdown : {{path}}'
  }
  readonly conversationTitle: {
    readonly label: 'Titre de la conversation'
    readonly from: '↳ depuis « {{title}} »'
    readonly fromTitle: 'Afficher la conversation mère'
    readonly branchFrom: '↳ branche de « {{title}} »'
    readonly branchFromTitle: 'Afficher la conversation d’origine'
  }
  readonly conversationMenu: {
    readonly unpin: 'Désépingler'
    readonly pin: 'Épingler'
    readonly openBeside: 'Ouvrir à côté'
    readonly rename: 'Renommer'
    readonly exportMarkdown: 'Exporter en Markdown…'
    readonly exportJson: 'Exporter en JSON…'
    readonly unarchive: 'Désarchiver'
    readonly archive: 'Archiver'
    readonly delete: 'Supprimer'
    readonly launchChild: 'Lancer en parallèle…'
  }
  readonly deleteDialog: {
    readonly description: 'La conversation va dans la corbeille : vous pouvez la restaurer pendant 30 jours depuis Réglages › Données.'
    readonly confirm: 'Mettre à la corbeille'
    readonly loss: {
      readonly dirty_one: '{{count}} fichier modifié non commité'
      readonly dirty_other: '{{count}} fichiers modifiés non commités'
      readonly ahead_one: '{{count}} commit dans la branche'
      readonly ahead_other: '{{count}} commits dans la branche'
      readonly dirty_many: '{{count}} fichiers modifiés non commités'
      readonly ahead_many: '{{count}} commits dans la branche'
    }
    readonly title: 'Supprimer « {{title}} » ?'
    readonly fromAgent: 'Supprimer aussi chez {{agent}} <muted>(définitif : la conversation ne pourra plus être reprise)</muted>'
    readonly worktree: 'Supprimer aussi le worktree et la branche <code>{{branch}}</code>'
    readonly losses: '— perdus : {{losses}}'
  }
  readonly modelMenu: {
    readonly search: 'Rechercher un modèle…'
    readonly none: 'Aucun modèle trouvé'
    readonly authRequired: 'connexion à faire'
    readonly authRequiredTip: 'Refusé faute de connexion à son fournisseur : choisissable, mais connectez-vous d’abord.'
  }
  readonly agentMenu: {
    readonly tip: 'Agent : {{agent}}'
    readonly title: 'Agent'
    readonly none: 'Aucun agent installé'
    readonly noneHint: 'Installez Bob Shell (commande bob) ou OpenCode, puis Réglages › Diagnostic › Relire le PATH.'
  }
  readonly workspaceMenu: {
    readonly worktreeTip: 'Worktree {{branch}} — {{workspace}}'
    readonly title: 'Dossier de travail'
    readonly none: 'Choisir un dossier'
    readonly choose: 'Choisir un dossier…'
    readonly worktree: 'Nouvelle conversation dans un worktree'
    readonly worktreeHint: 'Sa propre branche et son propre dossier, pour travailler en parallèle'
    readonly revealFinder: 'Afficher dans le Finder'
    readonly revealFiles: 'Afficher dans le gestionnaire de fichiers'
    readonly copyPath: 'Copier le chemin'
    readonly openTerminal: 'Ouvrir un terminal ici'
  }
  readonly launch: {
    readonly folderMissing: 'La commande bobine demande le dossier « {{folder}} », qui n’existe pas ou n’est pas un dossier.'
  }
  readonly branchChip: {
    readonly branch: 'Branche {{name}}'
    readonly dirtyDot: 'modifications non commitées'
    readonly dirty_one: '{{count}} fichier modifié'
    readonly dirty_other: '{{count}} fichiers modifiés'
    readonly ahead_one: '{{count}} commit à pousser'
    readonly ahead_other: '{{count}} commits à pousser'
    readonly behind_one: '{{count}} commit à récupérer'
    readonly behind_other: '{{count}} commits à récupérer'
    readonly dirty_many: '{{count}} fichiers modifiés'
    readonly ahead_many: '{{count}} commits à pousser'
    readonly behind_many: '{{count}} commits à récupérer'
  }
  readonly sessionSettings: {
    readonly on: 'Activé'
    readonly off: 'Désactivé'
    readonly modeTip: '{{name}} : {{value}} (Maj+Tab : mode suivant)'
    readonly modelTip: '{{name}} : {{value}}'
    readonly label: 'Réglages de la session'
    readonly none: 'Cet agent n’expose aucun réglage.'
    readonly mcp: {
      readonly title: 'Serveurs MCP'
      readonly none: 'Aucun autre serveur MCP'
      readonly noneHint: 'En ajouter dans les Réglages'
      readonly toolsTip: 'Outils : {{tools}}'
      readonly disabled: 'désactivé'
      readonly testing: 'test…'
      readonly error: 'en erreur'
      readonly global: 'tous les dossiers'
      readonly folder: 'ce dossier'
      readonly tools_one: '{{count}} outil'
      readonly tools_other: '{{count}} outils'
      readonly tools_many: '{{count}} outils'
      readonly builtIn: 'intégré'
      readonly appTools_one: '{{count}} outil dans cette conversation'
      readonly appTools_many: '{{count}} outils dans cette conversation'
      readonly appTools_other: '{{count}} outils dans cette conversation'
      readonly appToolsShow: 'Voir les outils'
      readonly appToolsTokens: '≈ {{tokens}} jetons'
      readonly appToolsNext_one: 'Au prochain démarrage de l’agent : {{count}} outil'
      readonly appToolsNext_many: 'Au prochain démarrage de l’agent : {{count}} outils'
      readonly appToolsNext_other: 'Au prochain démarrage de l’agent : {{count}} outils'
      readonly appToolsRestart: 'Les réglages ont changé · Redémarrer l’agent pour les appliquer'
    }
    readonly title: 'Réglages · {{agent}}'
  }
  readonly rules: {
    readonly scope: { readonly project: 'projet'; readonly personal: 'personnelle' }
    readonly scopeWithMode: '{{scope}} · mode {{mode}}'
    readonly title: 'Règles actives'
    readonly unreadable: 'Règles illisibles.'
    readonly none: 'Aucun fichier de règles'
    readonly noneHint: 'Un AGENTS.md dans le dossier donne des consignes à l’agent.'
    readonly online: 'Consigne en ligne : {{path}}'
  }
  readonly search: {
    readonly title: 'Rechercher une conversation'
    readonly hint: 'Tapez un mot du titre, du dossier ou de l’agent ; ↑ ↓ pour choisir, Entrée pour ouvrir.'
    readonly placeholder: 'Rechercher une conversation…'
    readonly escape: 'Échap'
    readonly empty: 'Aucune conversation.'
    readonly shown: 'affichée'
  }
  readonly resume: {
    readonly yesterday: 'hier'
    readonly title: 'Où en était-on ?'
    readonly description: 'Une session commencée ailleurs (terminal, Bob IDE…) s’ouvre comme une conversation : l’agent rejoue l’échange, et vous continuez ici.'
    readonly noAgent: 'Aucun agent installé ne sait lister ses sessions.'
    readonly agent: 'Agent'
    readonly scope: {
      readonly label: 'Dossiers'
      readonly folder: 'Ce dossier'
      readonly all: 'Tous les dossiers'
    }
    readonly filter: 'Filtrer'
    readonly filterLabel: 'Filtrer les sessions'
    readonly sessions: 'Sessions'
    readonly noMatch: 'Aucune session ne correspond.'
    readonly noneInFolder: 'Aucune autre session de {{agent}} dans ce dossier.'
    readonly none: 'Aucune autre session de {{agent}}.'
    readonly showAll: 'Voir tous les dossiers'
    readonly untitled: 'Session sans titre'
    readonly resuming: 'Reprise…'
    readonly resume: 'Reprendre'
    readonly loading: 'Sessions de {{agent}}…'
    readonly lastActivity: 'dernière activité : {{when}}'
    readonly request: 'Dernière demande'
    readonly done: 'Fait'
    readonly todo: 'En cours et à faire'
    readonly reply: 'Dernière réponse'
    readonly files_one: '{{count}} fichier modifié, non commité'
    readonly files_many: '{{count}} fichiers modifiés, non commités'
    readonly files_other: '{{count}} fichiers modifiés, non commités'
    readonly more_one: 'et {{count}} autre'
    readonly more_many: 'et {{count}} autres'
    readonly more_other: 'et {{count}} autres'
    readonly note: 'Résumé construit par Bobine depuis le fil, le plan et git ; rien n’a été envoyé à l’agent.'
  }
  readonly branchDialog: {
    readonly title: 'Repartir de ce message ?'
    readonly description: 'Une nouvelle conversation reprend l’échange jusqu’à ce message. L’originale reste dans l’historique, telle quelle.'
    readonly createdSince: '— créé depuis : supprimé'
    readonly confirm: 'Repartir de ce message'
    readonly restore_one: 'Remettre {{count}} fichier dans son état d’alors'
    readonly restore_other: 'Remettre {{count}} fichiers dans leur état d’alors'
    readonly untouched: 'Non touchés, modifiés depuis par quelqu’un d’autre : {{files}}.'
    readonly commands_one: '{{count}} commande lancée depuis ce message : ses effets restent.'
    readonly commands_other: '{{count}} commandes lancées depuis ce message : leurs effets restent.'
    readonly restore_many: 'Remettre {{count}} fichiers dans leur état d’alors'
    readonly commands_many: '{{count}} commandes lancées depuis ce message : leurs effets restent.'
  }
  readonly beside: {
    readonly makeMain: 'En faire la conversation principale'
    readonly close: 'Fermer la vue côte à côte'
    readonly appCommandsWarning: 'Les commandes de l’app se lancent depuis la conversation principale.'
  }
  readonly settings: {
    readonly nav: { readonly label: 'Sections des réglages' }
    readonly title: 'Réglages'
    readonly search: {
      readonly placeholder: 'Rechercher'
      readonly label: 'Rechercher dans les réglages'
      readonly heading: 'Recherche'
      readonly empty: 'Aucun réglage pour « {{query}} »'
      readonly emptyHint: 'Essayez un autre mot, ou un mot plus court.'
    }
    readonly close: 'Fermer les réglages'
    readonly description: 'Apparence, terminal, agents et raccourcis clavier de Bobine.'
    readonly general: {
      readonly you: 'Vous'
      readonly mac: 'Mac'
      readonly firstName: {
        readonly label: 'Votre prénom'
        readonly hint: 'Pour l’accueil : « Bonsoir Jérôme, on s’y met ? »'
        readonly placeholder: 'Facultatif'
      }
      readonly language: {
        readonly label: 'Langue'
        readonly hint: 'La langue de l’interface ; « Système » suit celle de macOS.'
        readonly system: 'Système'
        readonly native: 'Menus et fenêtres de macOS (Ouvrir, Enregistrer…) : dans cette langue au prochain lancement.'
        readonly relaunch: 'Relancer'
      }
      readonly keepAwake: {
        readonly label: 'Empêcher la mise en veille'
        readonly hint: 'Le Mac reste éveillé tant qu’un agent travaille (l’écran peut s’éteindre).'
      }
      readonly quickEntry: {
        readonly label: 'Fenêtre rapide'
        readonly hint: 'Depuis n’importe quelle app : une petite fenêtre qui ouvre une nouvelle conversation.'
        readonly refused: '{{shortcut}} est déjà utilisé par une autre app : choisissez-en un autre. La fenêtre rapide reste dans le menu Fichier.'
      }
      readonly command: {
        readonly label: 'Commande bobine'
        readonly hint: 'Dans le terminal, « bobine . » ouvre une conversation dans ce dossier.'
        readonly install: 'Installer la commande bobine'
        readonly reinstall: 'Réinstaller'
        readonly uninstall: 'Désinstaller'
        readonly installed: 'Installée dans {{path}}.'
        readonly outdated: 'Installée dans {{path}}, mais pour une autre copie de Bobine : réinstallez-la.'
        readonly target: 'S’installera dans {{dir}}.'
        readonly notInPath: '{{dir}} n’est pas dans votre PATH : ajoutez-le pour taper « bobine » tel quel.'
      }
      readonly editor: {
        readonly label: 'Éditeur'
        readonly hint: 'Pour « Ouvrir dans… » sur les fichiers du fil, à la bonne ligne.'
        readonly none: 'Aucun éditeur reconnu n’est installé (VS Code, Cursor, Zed, IntelliJ IDEA…).'
      }
      readonly tips: {
        readonly label: 'Astuces de Bobine'
        readonly hint: 'Au plus une par jour, au bon moment.'
        readonly hidden_one: '{{count}} astuce masquée'
        readonly hidden_other: '{{count}} astuces masquées'
        readonly reset: 'Tout réafficher'
        readonly hidden_many: '{{count}} astuces masquées'
      }
    }
    readonly fontSize: { readonly smaller: 'Plus petit'; readonly larger: 'Plus grand' }
    readonly conversation: {
      readonly newConversation: { readonly label: 'Nouvelle conversation' }
      readonly agent: { readonly label: 'Agent' }
      readonly sameAsCurrent: 'Comme maintenant'
      readonly folder: { readonly label: 'Dossier' }
      readonly chooseFolder: 'Choisir un dossier…'
      readonly mode: {
        readonly label: 'Mode'
        readonly hint: 'Plan : l’agent prépare un plan sans rien modifier (Maj+Tab change en cours de route).'
        readonly aria: 'Mode de départ'
        readonly last: 'Comme la dernière fois'
        readonly execute: 'Exécution'
        readonly plan: 'Plan'
      }
      readonly children: 'Sous-tâches'
      readonly maxLive: {
        readonly label: 'Conversations gardées actives'
        readonly hint: 'Au-delà, les plus anciennes sont mises en veille, puis rechargées à votre retour.'
        readonly less: 'Garder moins de conversations actives'
        readonly more: 'Garder plus de conversations actives'
      }
      readonly maxChildren: {
        readonly label: 'Conversations filles en cours'
        readonly hint: 'Par conversation. Au-delà, « Lancer en parallèle… » est grisé.'
        readonly less: 'Moins'
        readonly more: 'Plus'
      }
      readonly childProposals: {
        readonly label: 'Proposer des conversations filles'
        readonly hint: 'L’agent peut proposer des conversations filles ; rien ne démarre sans votre accord.'
        readonly never: 'Jamais'
        readonly whenFitting: 'Quand ça s’y prête'
        readonly always: 'Toujours demander'
      }
    }
    readonly apiKeys: {
      readonly state: {
        readonly unreadable: 'Illisible, à saisir de nouveau'
        readonly stored: 'Enregistrée'
        readonly fromEnv: 'Fournie par l’environnement ({{env}})'
        readonly none: 'Aucune'
      }
      readonly replace: 'Remplacer'
      readonly set: 'Définir'
      readonly removeLabel: 'Supprimer {{name}}'
      readonly remove: 'Supprimer la clé'
      readonly placeholder: 'Collez la clé ici'
      readonly removeAsk: 'Supprimer la clé enregistrée pour {{name}} ? Il faudra la saisir de nouveau.'
      readonly removeAction: 'Supprimer'
      readonly saving: 'Enregistrement…'
      readonly retry: 'Réessayer'
      readonly keychainWaitTitle: 'En attente du trousseau macOS…'
      readonly keychainWaitText: 'Une fenêtre de macOS demande d’autoriser Bobine (« Bobine Safe Storage ») : saisissez le mot de passe de votre session, puis « Toujours autoriser ». Elle peut être cachée derrière cette fenêtre.'
    }
    readonly agents: {
      readonly agents: { readonly label: 'Agents' }
      readonly none: 'Aucun agent installé.'
      readonly ready: 'Prêt'
      readonly notStartedYet: 'Pas encore démarré'
      readonly missing: 'Non installés : {{list}}.'
      readonly missingDiagnostics: 'Voir le Diagnostic'
      readonly capabilities: {
        readonly seenAt: 'Relevé le {{date}}'
        readonly yes: 'oui'
        readonly no: 'non'
        readonly notStarted: 'Pas encore démarré dans l’app : ce qu’il annonce s’affichera après sa première conversation.'
        readonly noSpecific: 'Rien : tout passe par le protocole ACP, sans réglage particulier.'
        readonly specific: 'Propre à {{agent}}'
        readonly title: 'Ce qu’il annonce'
      }
      readonly page: {
        readonly back: 'Agents'
        readonly backLabel: 'Revenir à la liste des agents'
        readonly open: 'Ouvrir la page de {{agent}}'
        readonly version: 'version {{version}}'
        readonly restart: 'Relancer'
        readonly restartTip: 'Relance l’agent de la conversation en cours'
        readonly connection: 'Connexion'
        readonly keysHint: 'À la place de la connexion de l’agent. Chiffrées dans le trousseau macOS.'
      }
      readonly notFound: 'introuvable'
    }
    readonly shortcuts: {
      readonly hint: 'Les raccourcis du menu marchent aussi dans le terminal et le navigateur intégré.'
    }
    readonly about: {
      readonly version: 'Version {{version}}'
      readonly description: 'Application de bureau pour les agents de code ACP : IBM Bob en tête, OpenCode.'
    }
    readonly section: {
      readonly general: 'Général'
      readonly appearance: 'Apparence'
      readonly notifications: 'Notifications'
      readonly shortcuts: 'Raccourcis clavier'
      readonly conversation: 'Conversations'
      readonly agents: 'Agents'
      readonly memory: 'Mémoire'
      readonly mcp: 'Serveurs MCP'
      readonly commands: 'Commandes'
      readonly privacy: 'Confidentialité'
      readonly data: 'Données'
      readonly diagnostics: 'Diagnostic'
      readonly about: 'Nouveautés'
      readonly roles: 'Rôles'
    }
    readonly commands: {
      readonly project: {
        readonly title: 'Commandes du projet'
        readonly none: 'Aucune commande dans ce dossier.'
        readonly badge: 'Projet'
        readonly intro: 'Un fichier Markdown par commande dans <code>{{dir}}</code> (<code>revue.md</code> → <code>/revue</code>) : en-tête <code>description:</code> / <code>hint:</code> entre <code>---</code> facultatif, le reste est la consigne. Partagées avec l’équipe via git.'
      }
      readonly none: 'Aucune commande personnelle.'
      readonly editLabel: 'Modifier {{name}}'
      readonly edit: 'Modifier'
      readonly removeLabel: 'Supprimer {{name}}'
      readonly remove: 'Supprimer'
      readonly form: {
        readonly editTitle: 'Modifier « /{{name}} »'
        readonly newTitle: 'Nouvelle commande'
        readonly name: 'Nom'
        readonly namePlaceholder: 'revue'
        readonly nameRule: 'Lettres, chiffres, tirets et soulignés ; 40 au plus.'
        readonly description: 'Description'
        readonly descriptionPlaceholder: 'Revue du fichier'
        readonly hint: 'Argument attendu'
        readonly hintPlaceholder: '<fichier> (facultatif)'
        readonly prompt: 'Consigne'
        readonly promptPlaceholder: 'Fais une revue de {{placeholder}} : bugs, lisibilité, tests manquants.'
        readonly taken: 'Vous avez déjà une commande « /{{name}} ».'
      }
      readonly add: 'Ajouter une commande'
      readonly intro: 'Une commande personnelle est une consigne envoyée à l’agent quand vous tapez <code>/nom</code>. <code>{{placeholder}}</code> y est remplacé par ce qui suit le nom (sinon c’est ajouté à la fin). Une commande de l’agent garde la priorité sur la vôtre, la vôtre sur celle de l’app du même nom.'
      readonly removeAsk: 'Supprimer la commande /{{name}} ?'
    }
    readonly providers: {
      readonly label: 'Fournisseurs de modèles'
      readonly hint: 'Points d’accès compatibles OpenAI (modèles internes…). Clé gardée dans le trousseau macOS.'
      readonly file: 'Fichier de {{agent}} : <code>{{file}}</code>'
      readonly none: 'Aucun fournisseur pour {{agent}} : ses modèles viennent de ses propres fournisseurs (connexion dans son terminal).'
      readonly add: 'Ajouter un fournisseur'
      readonly only: {
        readonly label: 'Seulement ces fournisseurs'
        readonly hint: '{{agent}} ne propose plus que les modèles des fournisseurs activés ici.'
      }
      readonly enable: 'Activer'
      readonly disable: 'Désactiver'
      readonly enabledLabel: '{{name}} activé'
      readonly models_one: '{{count}} modèle'
      readonly models_other: '{{count}} modèles'
      readonly models_many: '{{count}} modèles'
      readonly npm: 'autre paquet'
      readonly key: {
        readonly label: 'clé'
        readonly stored: 'enregistrée'
        readonly unreadable: 'illisible, à saisir de nouveau'
        readonly fromEnv: 'fournie par l’environnement ({{env}})'
        readonly none: 'aucune ({{env}})'
        readonly plain: 'en clair dans le fichier'
        readonly file: 'lue dans {{path}}'
        readonly missing: 'aucune'
        readonly set: 'Définir la clé'
        readonly replace: 'Remplacer la clé'
        readonly remove: 'Supprimer la clé'
        readonly setLabel: 'Clé de {{name}}'
        readonly help: 'Chiffrée dans le trousseau macOS, posée dans {{env}} au lancement de l’agent ; une clé en clair du fichier est remplacée par {env:{{env}}}.'
      }
      readonly test: 'Tester'
      readonly testLabel: 'Tester {{name}}'
      readonly testing: 'test…'
      readonly reachable: 'Répond · {{models}} · {{seconds}}'
      readonly edit: 'Modifier'
      readonly editLabel: 'Modifier {{name}}'
      readonly remove: 'Supprimer'
      readonly removeLabel: 'Supprimer {{name}}'
      readonly form: {
        readonly newTitle: 'Nouveau fournisseur pour {{agent}}'
        readonly editTitle: 'Modifier « {{name}} »'
        readonly id: 'Identifiant'
        readonly idPlaceholder: 'llmaas'
        readonly idHint: 'Préfixe des modèles chez l’agent, par exemple llmaas/qwen3-32b.'
        readonly name: 'Nom affiché'
        readonly namePlaceholder: 'LLMaaS interne'
        readonly url: 'Adresse de base'
        readonly urlPlaceholder: 'https://llm.interne.exemple/v1'
        readonly urlHint: 'Celle de l’API compatible OpenAI, /v1 compris, sans /chat/completions.'
        readonly models: 'Modèles'
        readonly modelsPlaceholder: 'qwen3-32b = Qwen 3 32B\nmistral-small'
        readonly modelsHint: 'Un par ligne : l’identifiant chez le fournisseur, puis « = libellé » (facultatif).'
      }
      readonly removeAsk: 'Supprimer le fournisseur « {{name}} » ?'
    }
    readonly network: {
      readonly label: 'Réseau d’entreprise'
      readonly hint: 'Transmis aux agents à leur prochain lancement. Vide : ce que donne le shell de connexion.'
      readonly proxy: {
        readonly label: 'Proxy'
        readonly hint: 'Adresse du proxy de l’entreprise, identifiants compris s’il en faut.'
      }
      readonly noProxy: {
        readonly label: 'Sans proxy'
        readonly hint: 'Hôtes joints en direct, séparés par des virgules (localhost par défaut).'
      }
      readonly caCerts: {
        readonly label: 'Certificats de l’entreprise'
        readonly hint: 'Fichier PEM des autorités de l’entreprise (proxy qui ré-chiffre, services internes).'
      }
      readonly fromShell: '{{value}} (shell)'
      readonly empty: 'aucun'
      readonly saved: 'Enregistré : pris en compte au prochain lancement d’un agent.'
      readonly summary: {
        readonly set: 'réseau d’entreprise : {{list}}'
        readonly none: 'réseau d’entreprise : rien de défini'
        readonly proxy: 'proxy'
        readonly noProxy: 'sans proxy'
        readonly caCerts: 'certificats'
      }
    }
    readonly advanced: 'Avancé'
    readonly appearance: {
      readonly interface: 'Interface'
      readonly thread: 'Fil'
      readonly code: 'Code et terminal'
      readonly theme: {
        readonly label: 'Thème'
        readonly hint: 'Système : Clair le jour, Sombre la nuit, comme le Mac.'
        readonly system: 'Système'
        readonly light: 'Clair'
        readonly sepia: 'Sépia'
        readonly dark: 'Sombre'
        readonly black: 'Nuit noire'
        readonly fjord: 'Fjord'
        readonly fjordNight: 'Fjord nuit'
      }
      readonly accent: {
        readonly label: 'Couleur d’accent'
        readonly orange: 'Orange'
        readonly blue: 'Bleu'
        readonly violet: 'Violet'
        readonly pink: 'Rose'
        readonly green: 'Vert'
        readonly graphite: 'Graphite'
      }
      readonly conversationFont: {
        readonly label: 'Police des réponses'
        readonly hint: 'Sans serif ou serif du système, ou une police installée sur le Mac.'
        readonly sans: 'Système (sans serif)'
        readonly serif: 'Serif (New York)'
        readonly installed: 'Polices installées'
      }
      readonly conversationSize: {
        readonly label: 'Taille des réponses'
        readonly hint: 'Vos messages sont un peu plus petits.'
      }
      readonly density: {
        readonly label: 'Densité'
        readonly hint: 'Compacte : moins d’espace entre les messages, les outils et les lignes de la liste.'
        readonly normal: 'Normale'
        readonly compact: 'Compacte'
      }
      readonly presentation: {
        readonly title: 'Présentation'
        readonly label: 'Mode présentation'
        readonly hint: 'Démo ou partage d’écran : texte agrandi, coûts masqués, chemins en ~, silence.'
      }
      readonly width: {
        readonly label: 'Largeur du fil'
        readonly narrow: 'Étroite'
        readonly normal: 'Normale'
        readonly wide: 'Large'
      }
      readonly codeFont: {
        readonly label: 'Police du code'
        readonly hint: 'Blocs de code, diffs et sorties de commandes.'
        readonly system: 'SF Mono (système)'
        readonly installed: 'Polices à chasse fixe installées'
      }
      readonly codeSize: { readonly label: 'Taille du code' }
      readonly terminalFont: {
        readonly label: 'Police du terminal'
        readonly hint: 'Automatique : une « Nerd Font » installée, sinon SF Mono.'
        readonly auto: 'Automatique'
      }
      readonly terminalSize: { readonly label: 'Taille du terminal' }
      readonly preview: {
        readonly label: 'Aperçu'
        readonly answer: 'Voici la réponse de l’agent : le fichier <code>README.md</code> est à jour et les tests passent.'
        readonly greeting: 'Bonjour'
        readonly comment: 'accueil'
        readonly result: '312 tests en 4,1 s'
      }
      readonly fonts: { readonly current: '{{font}} (non installée)' }
    }
    readonly notifications: {
      readonly whenDone: 'Quand un agent a fini ou attend'
      readonly sound: 'Son'
      readonly notifications: {
        readonly label: 'Notifications'
        readonly hint: 'Une bannière quand la fenêtre est en arrière-plan.'
        readonly blocked: 'macOS bloque les bannières de Bobine. Le son et le Dock marchent quand même.'
        readonly openSettings: 'Ouvrir les réglages du Mac'
      }
      readonly dockBounce: {
        readonly label: 'Faire rebondir l’icône du Dock'
        readonly hint: 'Une fois pour une réponse finie, jusqu’à votre retour s’il attend.'
      }
      readonly dockBadge: {
        readonly label: 'Compteur sur l’icône du Dock'
        readonly hint: 'Le nombre de conversations qui attendent votre attention.'
      }
      readonly attentionSound: {
        readonly label: 'Son quand un agent attend'
        readonly hint: 'Même sans notifications.'
        readonly none: 'Aucun'
        readonly play: 'Écouter'
        readonly playLabel: 'Écouter le son'
      }
    }
    readonly privacy: {
      readonly allowed: 'Autorisé sans demander'
      readonly allowedHint: '« Toujours autoriser » sur une demande de l’agent la range ici.'
      readonly tools: {
        readonly label: 'Outils'
        readonly revokeLabel: 'Ne plus autoriser d’office {{tool}}'
        readonly revokeAsk: 'Ne plus autoriser {{tool}} d’office ? L’agent redemandera.'
        readonly known: { readonly todoList: 'Mise à jour de la liste de tâches' }
      }
      readonly sites: {
        readonly label: 'Sites'
        readonly revokeLabel: 'Ne plus autoriser d’office {{site}}'
        readonly revokeAsk: 'Ne plus autoriser {{site}} d’office ? L’agent redemandera.'
      }
      readonly commands: {
        readonly label: 'Commandes · {{folder}}'
        readonly revokeLabel: 'Ne plus lancer d’office {{command}}'
        readonly revokeAsk: 'Ne plus lancer « {{command}} » d’office ? L’agent redemandera.'
      }
      readonly none: 'Rien pour l’instant.'
      readonly revoke: 'Révoquer'
      readonly browser: 'Navigateur intégré'
      readonly keepCookies: {
        readonly label: 'Garder les connexions'
        readonly hint: 'Cookies et connexions du navigateur intégré, d’un lancement à l’autre.'
      }
      readonly browserData: {
        readonly cleared: 'Données effacées : il faudra se reconnecter aux sites.'
        readonly label: 'Données du navigateur'
        readonly hint: 'Cookies, connexions, stockage des sites et cache du navigateur intégré.'
        readonly clearing: 'Effacement…'
        readonly clear: 'Effacer'
      }
      readonly worktreeSetups: {
        readonly label: 'Préparation des worktrees · {{folder}}'
        readonly revokeLabel: 'Ne plus lancer d’office la préparation de {{folder}}'
        readonly revokeAsk: 'Ne plus lancer d’office « {{command}} » dans les worktrees de {{folder}} ? Bobine redemandera.'
      }
    }
    readonly data: {
      readonly backupTitle: 'Historique'
      readonly backup: {
        readonly done: 'Sauvegardé dans {{folder}}'
        readonly label: 'Sauvegarde de l’historique'
        readonly hint: 'Copie datée de tout le profil (conversations, réglages, tâches…), sans les clés d’API.'
        readonly running: 'Copie…'
        readonly action: 'Sauvegarder…'
      }
      readonly recentFolders: {
        readonly label: 'Dossiers récents'
        readonly none: 'Aucun.'
        readonly forget: 'Oublier {{folder}}'
      }
      readonly orphans: {
        readonly label: 'Worktrees orphelins'
        readonly hint: 'Worktrees dont la conversation a été supprimée. « Nettoyer » les efface avec leur contenu.'
        readonly none: 'Aucun.'
        readonly clean: 'Nettoyer'
        readonly cleanLabel: 'Nettoyer {{path}}'
        readonly detail_dirty_one: '{{count}} fichier non commité'
        readonly detail_dirty_other: '{{count}} fichiers non commités'
        readonly detail_dirty_many: '{{count}} fichiers non commités'
        readonly detail_ahead_one: '{{count}} commit non fusionné'
        readonly detail_ahead_other: '{{count}} commits non fusionnés'
        readonly detail_ahead_many: '{{count}} commits non fusionnés'
        readonly refresh: 'Rechercher'
        readonly cleanAsk: 'Supprimer le worktree {{branch}} et sa branche ?'
        readonly cleanAskLosing: 'Supprimer le worktree {{branch}} et sa branche ? Perdu avec eux : {{detail}}.'
      }
      readonly fresh: {
        readonly title: 'Recommencer à neuf'
        readonly tryLabel: 'Essayer Bobine comme neuve'
        readonly tryHint: 'Une seconde Bobine sur un profil vide, effacé à sa fermeture ; la vôtre n’est pas touchée.'
        readonly tryAction: 'Ouvrir'
        readonly tryDone: 'Seconde Bobine ouverte sur un profil temporaire.'
        readonly agentsLabel: 'Agents comme sur un Mac neuf'
        readonly agentsHint: 'Les agents y redemandent connexion et confiance des dossiers ; les vraies restent.'
        readonly resetLabel: 'Réinitialiser Bobine'
        readonly resetHint: 'Tout ce que Bobine garde ici part à la corbeille ; projets et agents ne bougent pas.'
        readonly resetAction: 'Réinitialiser…'
        readonly confirmTitle: 'Réinitialiser Bobine ?'
        readonly lead: 'Bobine se ferme, met ses données à la corbeille (rien n’est perdu tant qu’elle n’est pas vidée), puis redémarre comme au premier lancement.'
        readonly leadUninstall: 'Bobine se ferme, met ses données à la corbeille (rien n’est perdu tant qu’elle n’est pas vidée), puis part elle aussi à la corbeille.'
        readonly leadClose: 'Bobine se ferme et met ses données à la corbeille (rien n’est perdu tant qu’elle n’est pas vidée) ; relancez-la ensuite.'
        readonly trashHead: 'Part à la corbeille'
        readonly keepHead: 'Reste en place'
        readonly kind: {
          readonly conversations: 'Conversations'
          readonly settings: 'Réglages, clés d’API, sites autorisés'
          readonly usage: 'Journal de consommation'
          readonly browser: 'Cookies et données du navigateur'
          readonly other: 'Journaux, cache et le reste'
        }
        readonly countSize: '{{count}} · {{size}}'
        readonly keychain: 'Et la clé « Bobine Safe Storage » du trousseau, qui chiffre les clés d’API.'
        readonly keepProjects: 'Vos projets et leurs worktrees'
        readonly keepAgents: 'Les agents : leurs connexions, réglages et sessions'
        readonly app: 'L’app Bobine'
        readonly uninstall: 'Mettre aussi l’app à la corbeille (désinstaller)'
        readonly confirmAction: 'Tout effacer et redémarrer'
        readonly confirmUninstall: 'Tout effacer et désinstaller'
        readonly confirmClose: 'Tout effacer et fermer'
        readonly loading: 'Calcul des tailles…'
        readonly chip: 'Profil temporaire · effacé à la fermeture'
        readonly chipTip: 'Seconde Bobine sur un profil vide : rien n’en est gardé à sa fermeture.'
        readonly temporaryNoReset: 'Un profil temporaire ne se réinitialise pas : fermez-le, il est effacé.'
        readonly trashFolder: 'Bobine — données du'
        readonly readmeName: 'LISEZ-MOI.txt'
        readonly readme: 'Données de Bobine mises à la corbeille par « Réinitialiser Bobine ». Pour les récupérer, quittez Bobine et remettez chaque élément à l’endroit indiqué (« nom  <-  d’où il vient »).'
      }
      readonly restore: {
        readonly label: 'Restaurer une sauvegarde'
        readonly hint: 'Remplace historique et réglages ; l’état actuel est gardé à côté. Bobine redémarre.'
        readonly action: 'Restaurer…'
        readonly confirmTitle_one: 'Restaurer la sauvegarde du {{date}} ({{count}} conversation) ?'
        readonly confirmTitle_many: 'Restaurer la sauvegarde du {{date}} ({{count}} conversations) ?'
        readonly confirmTitle_other: 'Restaurer la sauvegarde du {{date}} ({{count}} conversations) ?'
        readonly confirmText_one: 'Votre conversation et vos réglages actuels seront remplacés. Ils sont d’abord gardés à côté, dans le dossier de données de Bobine, d’où ils se restaurent de la même façon. Bobine redémarre.'
        readonly confirmText_many: 'Vos {{count}} conversations et vos réglages actuels seront remplacés. Ils sont d’abord gardés à côté, dans le dossier de données de Bobine, d’où ils se restaurent de la même façon. Bobine redémarre.'
        readonly confirmText_other: 'Vos {{count}} conversations et vos réglages actuels seront remplacés. Ils sont d’abord gardés à côté, dans le dossier de données de Bobine, d’où ils se restaurent de la même façon. Bobine redémarre.'
        readonly confirm: 'Restaurer et redémarrer'
        readonly notBackup: 'Ce dossier n’est pas une sauvegarde de Bobine. Choisissez le dossier créé par « Sauvegarder… » (son nom commence par bobine-sauvegarde).'
        readonly newer: 'Sauvegarde d’une version plus récente de Bobine : celle-ci ne peut pas la restaurer.'
        readonly keys: 'Les clés d’API saisies pour les agents déclarés (Réglages › Agents) ne sont pas dans une sauvegarde : il faudra les ressaisir.'
      }
      readonly trash: {
        readonly title: 'Corbeille'
        readonly hint: 'Conversations supprimées, effacées pour de bon 30 jours après.'
        readonly empty: 'La corbeille est vide.'
        readonly deletedOn: 'supprimée le {{date}}'
        readonly erasedIn_one: 'effacée dans {{count}} jour'
        readonly erasedIn_many: 'effacée dans {{count}} jours'
        readonly erasedIn_other: 'effacée dans {{count}} jours'
        readonly erasedToday: 'effacée aujourd’hui'
        readonly noFolder: 'Sans dossier'
        readonly restore: 'Restaurer'
        readonly erase: 'Effacer définitivement'
        readonly eraseConfirm: 'Effacer définitivement ?'
        readonly eraseAction: 'Effacer'
      }
    }
    readonly memory: {
      readonly enabled: {
        readonly label: 'Mémoire activée'
        readonly hint: "Les agents proposent, vous décidez : rien n'est gardé sans votre accord."
        readonly hintOff: 'Désactivée : les agents ne reçoivent ni souvenirs ni outil ; les vôtres restent ici.'
      }
      readonly entries: 'Souvenirs'
      readonly picker: 'Mémoire affichée'
      readonly you: 'Vous · tous les projets'
      readonly projects: 'Projets'
      readonly thisProject: 'Ce projet'
      readonly missing: 'Projets introuvables'
      readonly missingHint: 'Le dossier de ce projet est introuvable (déplacé ou supprimé).'
      readonly attach: 'Rattacher à un dossier…'
      readonly attached_one: '{{count}} souvenir rattaché.'
      readonly attached_other: '{{count}} souvenirs rattachés.'
      readonly empty: "Aucun souvenir ici pour l'instant."
      readonly broken: 'Un souvenir illisible a été mis de côté ({{file}}) ; « Tout effacer » le supprime.'
      readonly export: 'Exporter…'
      readonly exported: 'Exporté dans {{file}}'
      readonly reveal: 'Afficher dans le Finder'
      readonly clear: 'Tout effacer…'
      readonly clearAction: 'Tout effacer'
      readonly clearConfirm_one: 'Effacer {{count}} souvenir ? Les agents ne le recevront plus.'
      readonly clearConfirm_other: 'Effacer les {{count}} souvenirs ? Les agents ne les recevront plus.'
      readonly external: 'contenu externe'
      readonly byYou: 'vous'
      readonly proposedBy: 'Proposé par'
      readonly updated: 'Retenu le'
      readonly file: 'Fichier'
      readonly edit: 'Modifier'
      readonly moveToYou: 'Déplacer vers Vous'
      readonly moveToProject: 'Déplacer vers ce projet'
      readonly moveError: {
        readonly changed: 'Ce souvenir a changé entre-temps : rouvrez-le.'
        readonly exists: "Un souvenir du même nom existe déjà de l'autre côté."
        readonly full: "L'autre mémoire est pleine."
      }
      readonly delete: 'Supprimer'
      readonly deleteConfirm: 'Supprimer « {{description}} » ?'
      readonly changedAside: 'Ce souvenir a changé entre-temps : rouvrez-le.'
      readonly description: 'Description'
      readonly type: 'Type'
      readonly text: 'Texte'
      readonly save: 'Enregistrer'
      readonly secret: 'Ressemble à un secret (clé, jeton, mot de passe) : notez plutôt où il est rangé.'
      readonly invalid: {
        readonly description: 'Une seule ligne, {{description}} caractères au plus.'
        readonly body: 'Entre 1 et {{body}} caractères.'
        readonly other: "Ce souvenir n'est pas valide."
      }
      readonly changedWhileEditing: 'Ce souvenir a été modifié entre-temps.'
      readonly reload: 'Recharger (vos modifications seront perdues)'
      readonly attached_many: '{{count}} souvenirs rattachés.'
      readonly clearConfirm_many: 'Effacer les {{count}} souvenirs ? Les agents ne les recevront plus.'
      readonly where: 'Commune à tous les agents, en clair sur ce Mac.'
      readonly outside: 'Modifié hors de Bobine'
      readonly outsideNotice: "Ce fichier a été modifié hors de Bobine (éditeur, ou un agent par ses propres outils) : il n'est plus donné aux agents tant que vous ne l'avez pas relu."
      readonly keepChanges: 'Garder ces modifications'
      readonly byUnknown: 'inconnu'
      readonly keyLocked: 'Bobine ne peut pas lire sa clé dans le trousseau : les souvenirs ne sont pas donnés aux agents, et rien ne peut être validé. Autorisez l’accès au trousseau, puis relancez Bobine.'
      readonly keyRecreated: 'Clé de la mémoire recréée : revalidez vos souvenirs (« Garder ces modifications ») pour qu’ils soient de nouveau donnés aux agents.'
    }
  }
  readonly settingsSearch: {
    readonly firstName: 'nom accueil salutation bonjour'
    readonly language: 'langue language interface anglais english français traduction'
    readonly theme: 'apparence thème mode clair sombre système sépia papier nuit noire noir oled couleurs'
    readonly accent: 'couleur orange bleu violet rose vert graphite boutons'
    readonly keepAwake: 'veille sommeil éveillé écran batterie'
    readonly keepCookies: 'navigateur intégré cookies connexion session garder'
    readonly browserData: 'navigateur intégré effacer cookies cache connexions vider'
    readonly quickEntry: 'raccourci global option commande b espace capture écran barre flottante'
    readonly command: 'bobine terminal ligne de commande shell code installer path ouvrir dossier'
    readonly notifications: 'alerte bannière badge dock son'
    readonly dockBounce: 'rebond rebondir icône dock alerte arrière-plan attention réponse finie'
    readonly dockBadge: 'badge compteur nombre pastille icône dock à traiter attente'
    readonly attentionSound: 'son alerte autorisation question arrière-plan premier plan bip'
    readonly backup: 'sauvegarder copie backup conversations'
    readonly conversationFont: 'typographie serif sans serif empattements caractères polices installées'
    readonly codeFont: 'monospace chasse fixe menlo jetbrains fira cascadia blocs diffs'
    readonly width: 'colonne étroite large écran'
    readonly density: 'densité compacte espace interligne serré'
    readonly presentation: 'présentation démo partage d’écran projeter silence'
    readonly conversationFontSize: 'zoom grandeur caractères lisibilité'
    readonly terminalFont: 'terminal typographie famille monospace'
    readonly terminalFontSize: 'terminal zoom caractères'
    readonly newConversation: 'défaut départ démarrage'
    readonly agent: 'bob opencode profil défaut'
    readonly folder: 'répertoire projet espace de travail workspace'
    readonly mode: 'plan exécution agent départ'
    readonly agents: 'bob opencode installés disponibles capacités version fonctions propres annoncé protocole'
    readonly recentFolders: 'répertoires projets oublier'
    readonly mcp: 'mcp outils serveur extension'
    readonly commands: 'commandes slash / personnelles prompt'
    readonly projectCommands: 'commandes slash dossier .bobine'
    readonly shortcut: 'raccourci clavier touche'
    readonly diagnostics: 'problème panne vérifier installation agents version electron système path connexion licence dossier approuvé rapport signaler issue github'
    readonly environment: 'path shell variables'
    readonly ios: 'xcode axe simctl iphone'
    readonly android: 'sdk adb android studio'
    readonly about: 'application nouveautés'
    readonly log: 'journal log logs trace débogage détaillé main.log agents.log console finder ouvrir'
    readonly maxChildren: 'plafond limite nombre maximum conversations filles parallèle sous-tâches lancer en parallèle'
    readonly childProposals: 'proposer conversations filles sous-tâches découper chantiers parallèle worktree agent contexte'
    readonly maxLive: 'conversations actives ouvertes agents vivants mémoire ram rechargement recharger plafond limite nombre maximum'
    readonly providers: 'fournisseur modèle llmaas openai compatible point d’accès interne entreprise opencode'
    readonly network: 'réseau entreprise proxy certificat https_proxy no_proxy node_extra_ca_certs'
    readonly proxy: 'proxy https_proxy http_proxy entreprise réseau'
    readonly noProxy: 'no_proxy sans proxy hôtes direct'
    readonly caCerts: 'certificat ca pem node_extra_ca_certs autorité tls ssl entreprise'
    readonly providersGroup: 'fournisseur modèle llmaas point d’accès joint'
    readonly orphans: 'worktree orphelin branche nettoyer git'
    readonly you: 'prénom langue personnel'
    readonly mac: 'veille fenêtre rapide raccourci global'
    readonly interface: 'apparence thème accent mode couleurs'
    readonly thread: 'fil réponses police taille largeur'
    readonly codeAndTerminal: 'code terminal police monospace taille'
    readonly codeFontSize: 'code taille blocs diffs sorties zoom'
    readonly whenDone: 'notifications dock bannière fini attend'
    readonly sound: 'son alerte bip'
    readonly children: 'sous-tâches conversations filles parallèle'
    readonly allowed: 'permissions autorisations autorisés autorisées outils sites commandes toujours révoquer dossier'
    readonly browser: 'navigateur intégré cookies connexions données'
    readonly backupTitle: 'historique sauvegarde copie'
    readonly connection: 'connexion clé api jeton'
    readonly apiKey: 'clé api jeton connexion trousseau'
    readonly announced: 'annoncé capacités protocole version'
    readonly specific: 'propre fonctions particulier'
    readonly agentPage: 'agent page version commande relancer'
    readonly usage: 'consommation coût coûts jetons quota dépense bobcoins dollars échanges statistiques tableau graphique'
    readonly usageByModel: 'modèle modèles coût jetons par échange'
    readonly usageByProject: 'projet projets dépôt dossier worktree'
    readonly usageConversations: 'conversations plus consommé longues'
    readonly quota: 'quota bobcoins budget plafond mois serveur'
    readonly spend: 'dépense bobcoins ce mac aujourd’hui semaine mois'
    readonly usageHistory: 'historique effacer remettre à zéro réinitialiser'
    readonly usageReset: 'effacer remettre à zéro réinitialiser supprimer historique consommation journal'
    readonly customAgent: 'ajouter déclarer agent acp personnalisé autre commande arguments variables environnement'
    readonly freshTitle: 'recommencer neuf zéro nouveau'
    readonly freshTry: 'essayer profil temporaire tester neuve seconde'
    readonly freshAgents: 'agents neufs connexion sso confiance'
    readonly freshReset: 'réinitialiser reset effacer désinstaller supprimer corbeille'
    readonly editor: 'éditeur ouvrir fichier ligne vs code visual studio cursor zed intellij jetbrains ide'
    readonly tips: 'astuce conseil aide suggestion languette'
    readonly memory: 'mémoire souvenirs retenir oublier agents index Claude'
    readonly restore: 'restaurer sauvegarde revenir remplacer annuler'
    readonly trash: 'corbeille supprimées effacer définitivement récupérer restaurer'
    readonly roles: 'rôles équipe expert spécialiste reviewer tech lead agents sous-agents modes @'
  }
  readonly diagnostics: {
    readonly group: {
      readonly environment: 'Environnement'
      readonly ios: 'Simulateur iOS'
      readonly android: 'Émulateur Android'
      readonly mcp: 'Serveurs MCP'
      readonly providers: 'Fournisseurs de modèles'
    }
    readonly view: {
      readonly trial: 'Essai'
      readonly checks: 'Vérifications'
      readonly starting: 'Démarrage'
      readonly trialRunning: 'essai en cours…'
      readonly version: 'Version'
      readonly checking: 'vérification…'
    }
    readonly rerun: 'Relancer'
    readonly copyReport: 'Copier le rapport'
    readonly reportIssue: 'Signaler un problème'
    readonly reportIssueHint: 'Ouvre une issue GitHub dans le navigateur, préremplie avec la version et ce rapport. Rien n’est envoyé avant que vous ne la validiez sur GitHub.'
    readonly reportIssueTruncated: '[Rapport coupé pour tenir dans l’adresse : coller le reste depuis « Copier le rapport ».]'
    readonly privacy: 'Rien n’est envoyé à un modèle. Chaque agent est lancé hors conversation, dans le dossier courant ; sa session d’essai est supprimée ensuite.'
    readonly log: {
      readonly label: 'Journal'
      readonly level: 'Niveau du journal'
      readonly levels: {
        readonly normal: 'Normal'
        readonly detailed: 'Détaillé'
        readonly trace: 'Trace'
      }
      readonly hint: {
        readonly normal: 'Seul main.log est écrit.'
        readonly detailed: 'En plus, chaque échange avec les agents (messages, outils de l’app, sortie d’erreur), sans leur contenu, dans agents.log.'
        readonly trace: 'En plus, des extraits du contenu (messages, fichiers, résultats), secrets masqués. Jusqu’au prochain lancement.'
      }
      readonly imposed: 'Imposé par BOBINE_LOG.'
      readonly open: 'Ouvrir'
      readonly openLabel: 'Ouvrir {{file}}'
      readonly reveal: 'Afficher dans le Finder'
      readonly revealLabel: 'Afficher {{file}} dans le Finder'
      readonly empty: 'vide'
      readonly fileHint: {
        readonly main: 'Démarrage, erreurs, agents lancés et arrêtés, durée des tours, agent silencieux.'
        readonly agents: 'Les échanges avec les agents, aux niveaux Détaillé et Trace.'
      }
    }
    readonly copyCommand: 'Copier la commande'
    readonly mcp: {
      readonly servers: 'Serveurs'
      readonly reading: 'lecture…'
      readonly unreadable: 'configuration illisible'
      readonly file: 'Fichier de {{agent}}'
      readonly fileFix: 'Rien n’y est écrit tant qu’il est illisible : corrigez-le.'
      readonly disabled: 'désactivé'
      readonly testing: 'test…'
      readonly errorFix: 'Vérifiez sa commande ou son adresse dans Réglages › Serveurs MCP.'
      readonly none: 'aucun serveur configuré'
      readonly serverFolder: '{{name}} ({{agent}}, ce dossier)'
      readonly serverGlobal: '{{name}} ({{agent}}, global)'
      readonly tools_one: '{{count}} outil'
      readonly tools_other: '{{count}} outils'
      readonly tools_many: '{{count}} outils'
    }
    readonly level: {
      readonly ok: 'bon'
      readonly warning: 'à regarder'
      readonly error: 'en erreur'
      readonly optional: 'facultatif'
      readonly pending: 'en cours'
    }
    readonly action: {
      readonly 'reload-shell-env': 'Relire le PATH'
      readonly 'try-session': 'Essayer une session'
      readonly 'open-agents-settings': 'Réglages › Agents'
      readonly 'open-mcp-settings': 'Réglages › Serveurs MCP'
    }
    readonly report: {
      readonly title: 'Diagnostic de Bobine — {{date}}'
      readonly check: '{{label}} : {{detail}}'
    }
    readonly summary: {
      readonly errors_one: '{{count}} problème'
      readonly errors_other: '{{count}} problèmes'
      readonly warnings_one: '{{count}} point à regarder'
      readonly warnings_other: '{{count}} points à regarder'
      readonly pending_one: '{{count}} vérification en cours'
      readonly pending_other: '{{count}} vérifications en cours'
      readonly ok: 'Tout va bien.'
      readonly errors_many: '{{count}} problèmes'
      readonly warnings_many: '{{count}} points à regarder'
      readonly pending_many: '{{count}} vérifications en cours'
    }
    readonly check: {
      readonly version: 'Version'
      readonly workspace: 'Dossier de travail'
      readonly workspaceMissing: '{{folder}} introuvable'
      readonly noWorkspace: 'Aucun dossier choisi'
      readonly workspaceFix: 'Choisissez un autre dossier dans la zone de saisie.'
      readonly shellPath: 'PATH du shell'
      readonly shellPathFix: 'Sans lui, l’app peut ne pas trouver les agents installés hors des dossiers habituels. Corrigez les fichiers de démarrage du shell, puis relisez le PATH.'
      readonly shellPathFrom: 'lu depuis {{path}}'
      readonly screen: 'Enregistrement de l’écran'
      readonly screenGranted: 'autorisé (captures d’écran)'
      readonly screenNotDetermined: 'pas encore demandé : macOS le demandera à la première capture'
      readonly screenDenied: 'refusé : une capture ne montrerait que le fond d’écran'
      readonly screenFix: 'Réglages Système › Confidentialité et sécurité › Enregistrement de l’écran : cochez Bobine, puis relancez l’app.'
      readonly xcodeMissing: 'pas installé'
      readonly xcodeMissingFix: 'Seulement pour les apps iOS : installez Xcode depuis l’App Store.'
      readonly xcodeCltOnly: 'seuls les outils en ligne de commande sont sélectionnés ({{path}})'
      readonly xcodeCltOnlyFix: 'Le simulateur demande Xcode complet : installez-le, puis sélectionnez-le (droits administrateur).'
      readonly simulators: 'Simulateurs'
      readonly noSimulator: 'aucun simulateur disponible'
      readonly noSimulatorFix: 'Installez un runtime iOS dans Xcode (Réglages › Components), puis créez un simulateur (Window › Devices and Simulators).'
      readonly simulatorsFix: 'Ouvrez Xcode une fois (il finit d’installer ses composants), puis relancez le diagnostic.'
      readonly axe: 'AXe (touchers, vidéo)'
      readonly axeMissing: 'pas trouvé : touchers et vidéo du simulateur indisponibles'
      readonly axeMissingFix: 'AXe est livré avec l’app : réinstallez-la, ou installez AXe (github.com/cameroncooke/AXe).'
      readonly axeTooOld: 'version {{version}} trop ancienne'
      readonly axeTooOldFix: 'Réinstallez l’app, ou mettez AXe à jour (github.com/cameroncooke/AXe).'
      readonly axeQuarantine: '{{version}}{{where}}, en quarantaine'
      readonly axeQuarantineFix: 'macOS peut le bloquer. Retirez l’attribut (sans droits administrateur pour vos fichiers), puis relancez l’app.'
      readonly androidSdk: 'SDK Android'
      readonly androidSdkMissing: 'pas trouvé'
      readonly androidSdkMissingFix: 'Seulement pour les apps Android : installez Android Studio (l’app trouve son SDK même hors du PATH).'
      readonly versionDetail: '{{version}} ({{kind}}) · Electron {{electron}} · macOS {{os}}'
      readonly packaged: 'app installée'
      readonly development: 'développement'
      readonly simulatorsAvailable_one: '{{count}} disponible'
      readonly simulatorsAvailable_other: '{{count}} disponibles'
      readonly simulatorsBooted_one: '{{count}} disponible, {{booted}}'
      readonly simulatorsBooted_other: '{{count}} disponibles, {{booted}}'
      readonly booted_one: '{{count}} démarré'
      readonly booted_other: '{{count}} démarrés'
      readonly axeSilent: 'ne répond pas'
      readonly axeSilentDetail: 'ne répond pas ({{detail}})'
      readonly simulatorsAvailable_many: '{{count}} disponibles'
      readonly simulatorsBooted_many: '{{count}} disponibles, {{booted}}'
      readonly booted_many: '{{count}} démarrés'
      readonly logHint: 'Le journal (Aide › Afficher le journal) en dit plus.'
    }
    readonly agent: {
      readonly command: 'Commande'
      readonly commandMissing: '« {{command}} » introuvable'
      readonly start: 'Démarrage'
      readonly noAnswer: 'pas de réponse'
      readonly noVersion: '{{name}}, version non annoncée'
      readonly version: 'Version'
      readonly untestedVersion: 'Bobine a été vérifié avec {{versions}}'
      readonly untestedVersionFix: 'Les fonctions propres à {{agent}} peuvent ne pas marcher avec cette version. Si quelque chose cloche, signalez-le avec le journal.'
      readonly session: 'Session'
      readonly sessionSkipped: 'pas essayée : {{agent}} ne sait pas supprimer une session, celle d’essai resterait dans son historique'
      readonly models: 'Modèles'
      readonly noModels: 'aucun modèle proposé'
      readonly noModelsFix: 'Configurez un fournisseur de modèles pour {{agent}}.'
      readonly folder: 'Dossier'
      readonly untrusted: '{{where}} n’est pas approuvé par {{agent}}'
      readonly quotedMethod: '« {{name}} »'
      readonly authTerminal: 'lancez la commande ci-dessous dans un terminal'
      readonly authApiKey: 'enregistrez une clé d’API dans Réglages › Agents'
      readonly auth: 'Connexion'
      readonly notSignedIn: 'non connecté'
      readonly license: 'Licence'
      readonly licenseToAccept: 'à accepter'
      readonly licenseFix: 'Lisez-la et acceptez-la vous-même dans un terminal : l’app ne l’accepte jamais à votre place.'
      readonly alreadyInstalled: 'Déjà installé ? Relisez le PATH.'
      readonly sessionReady: 'prête dans {{where}}'
      readonly sessionReadyKept: 'prête dans {{where}} (session d’essai gardée dans son historique)'
      readonly modelsCount_one: '{{count}} proposé'
      readonly modelsCount_other: '{{count}} proposés'
      readonly modelsDefault_one: '{{count}} proposé, {{current}} par défaut'
      readonly modelsDefault_other: '{{count}} proposés, {{current}} par défaut'
      readonly untrustedFix: 'Ouvrez une conversation dans ce dossier et choisissez « {{choice}} ». Le reste (connexion, licence) se vérifie une fois le dossier approuvé.'
      readonly authInApp: 'ouvrez une conversation et choisissez {{methods}}'
      readonly or: 'ou'
      readonly authFix: 'Pour vous connecter : {{ways}}.'
      readonly sessionFailed: 'ne s’ouvre pas dans {{where}}'
      readonly sessionFailedDetail: 'ne s’ouvre pas dans {{where}} : {{detail}}'
      readonly modelsCount_many: '{{count}} proposés'
      readonly modelsDefault_many: '{{count}} proposés, {{current}} par défaut'
    }
    readonly providers: {
      readonly label: 'Fournisseurs'
      readonly none: 'aucun fournisseur de modèles configuré'
      readonly file: 'Fichier de {{agent}}'
      readonly fileFix: 'Rien n’y est écrit tant qu’il est illisible : corrigez-le.'
      readonly provider: '{{name}} ({{agent}})'
      readonly disabled: 'désactivé'
      readonly models_one: '{{count}} modèle'
      readonly models_other: '{{count}} modèles'
      readonly models_many: '{{count}} modèles'
    }
  }
  readonly mcp: {
    readonly test: {
      readonly connecting: 'Connexion au serveur…'
      readonly toolsTip: 'Outils : {{tools}}'
      readonly tools_one: '{{count}} outil'
      readonly tools_other: '{{count}} outils'
      readonly resources_one: '{{count}} ressource'
      readonly resources_other: '{{count}} ressources'
      readonly prompts_one: '{{count}} prompt'
      readonly prompts_other: '{{count}} prompts'
      readonly reachable: 'Joignable · {{details}}'
      readonly tools_many: '{{count}} outils'
      readonly resources_many: '{{count}} ressources'
      readonly prompts_many: '{{count}} prompts'
    }
    readonly loading: 'Chargement…'
    readonly noAgent: 'Aucun agent installé ne déclare de serveurs MCP.'
    readonly tabsLabel: 'Outils de Bobine et serveurs des agents'
    readonly server: {
      readonly disable: 'Désactiver'
      readonly enable: 'Activer'
      readonly enabledLabel: '{{name}} activé'
      readonly global: 'tous les dossiers'
      readonly folder: 'ce dossier'
      readonly web: 'web'
      readonly testLabel: 'Tester {{name}}'
      readonly test: 'Tester : se connecter au serveur et lister ses outils'
      readonly editLabel: 'Modifier {{name}}'
      readonly edit: 'Modifier'
      readonly copyLabel: 'Copier {{name}} vers {{agent}}'
      readonly copy: 'Copier vers {{agent}}'
      readonly copyExists: '{{agent}} a déjà un serveur « {{name}} ».'
      readonly removeLabel: 'Supprimer {{name}}'
      readonly remove: 'Supprimer'
      readonly variables: '{{n}} variable(s)'
      readonly headers: '{{n}} en-tête(s)'
      readonly removeAsk: 'Supprimer le serveur « {{name}} » ?'
    }
    readonly add: 'Ajouter un serveur'
    readonly testAll: 'Tout tester'
    readonly form: {
      readonly editTitle: 'Modifier « {{name}} »'
      readonly newTitle: 'Nouveau serveur pour {{agent}}'
      readonly name: 'Nom'
      readonly namePlaceholder: 'recherche-web'
      readonly transport: 'Type de serveur'
      readonly stdio: 'Commande locale'
      readonly http: 'Adresse web'
      readonly url: 'Adresse'
      readonly urlPlaceholder: 'https://exemple.com/mcp'
      readonly command: 'Commande'
      readonly commandPlaceholder: 'npx -y @exemple/serveur-mcp'
      readonly headers: 'En-têtes (un par ligne, « Nom: valeur »)'
      readonly env: 'Variables (une par ligne, « CLÉ=valeur »)'
      readonly plainText: 'Enregistrées en clair dans le fichier de l’agent, comme si vous l’écriviez à la main.'
      readonly scope: 'Portée'
      readonly scopeGlobal: 'Tous les dossiers'
      readonly scopeProject: 'Ce dossier ({{folder}})'
    }
    readonly state: {
      readonly off: 'désactivé'
      readonly unknown: 'pas encore testé'
      readonly testing: 'test en cours'
      readonly ok: 'joignable'
      readonly error: 'en erreur'
    }
    readonly files: {
      readonly global: 'Déclarés dans les fichiers de {{agent}} : <code>{{global}}</code> (tous les dossiers). Ils valent aussi quand vous utilisez {{agent}} dans un terminal. Un changement compte pour les nouvelles conversations ; relancez une conversation ouverte pour qu’elle en tienne compte.'
      readonly both: 'Déclarés dans les fichiers de {{agent}} : <code>{{global}}</code> (tous les dossiers) et <code>{{project}}</code> (ce dossier). Ils valent aussi quand vous utilisez {{agent}} dans un terminal. Un changement compte pour les nouvelles conversations ; relancez une conversation ouverte pour qu’elle en tienne compte.'
      readonly summary: 'Fichiers de {{agent}}'
    }
    readonly none: 'Aucun serveur MCP pour {{agent}}.'
    readonly check: {
      readonly name: 'Nom invalide : lettres, chiffres, « - », « _ » ou « . », sans espace.'
      readonly url: 'Adresse invalide : elle commence par https://'
      readonly command: 'Commande manquante.'
    }
    readonly bobine: {
      readonly tab: 'Outils de Bobine'
      readonly intro: 'Bobine donne ces outils à tous les agents, par son propre serveur MCP <code>bobine</code> : rien à installer ni à régler. Chaque conversation ne reçoit que ceux qui servent dans son dossier.'
      readonly count_one: '{{count}} outil'
      readonly count_many: '{{count}} outils'
      readonly count_other: '{{count}} outils'
      readonly conditionTip: 'Quand une conversation reçoit ces outils'
      readonly approvalTip: 'Quand l’agent attend votre accord'
      readonly error: 'Outils de Bobine illisibles : {{error}}'
      readonly weight: 'Poids estimé dans le contexte de l’agent, à chaque échange : au plus ≈ {{tokens}} jetons pour les familles activées (≈ {{total}} pour toutes).'
      readonly applies: 'S’applique aux prochaines sessions : les conversations ouvertes gardent leurs outils jusqu’au redémarrage de leur agent (menu ⚙ de la conversation).'
      readonly tokens: '≈ {{tokens}} jetons'
      readonly tokensTip: 'Estimation : environ 4 caractères par jeton, sur les définitions que l’agent reçoit (nom, description, paramètres)'
      readonly off: 'Coupée'
      readonly required: 'Toujours fournie : c’est par elle que l’agent vous pose ses questions'
      readonly disable: 'Ne plus proposer ces outils aux agents'
      readonly enable: 'Proposer ces outils aux agents'
      readonly enabledLabel: '{{name}} : proposés aux agents'
      readonly always: 'Toujours fournie'
      readonly settingOn: 'Activée'
      readonly settingOff: 'Désactivée'
      readonly settingPath: { readonly memory: 'Réglages › Mémoire' }
    }
  }
  readonly app: {
    readonly noConversation: 'Aucune conversation affichée.'
    readonly noBeside: 'Aucune conversation à côté.'
    readonly theAgent: 'L’agent'
    readonly showSidebar: 'Afficher la barre latérale'
    readonly newConversation: 'Nouvelle conversation'
    readonly hideChanges: 'Masquer les modifications'
    readonly showChanges: 'Modifications de l’agent'
    readonly tasks: 'Tâches de l’agent'
    readonly hidePanel: 'Masquer le panneau'
    readonly showPanel: 'Afficher le panneau'
    readonly scrollDown: 'Aller en bas'
    readonly scrollDownNew_one: '{{count}} nouveau'
    readonly scrollDownNew_many: '{{count}} nouveaux'
    readonly scrollDownNew_other: '{{count}} nouveaux'
    readonly scrollDownMany: '99+ nouveaux'
  }
  readonly presentation: {
    readonly pill: 'Présentation'
    readonly tip: 'Mode présentation actif : cliquer pour le quitter'
  }
  readonly changes: {
    readonly badge: {
      readonly created: 'créé'
      readonly modified: 'modifié'
      readonly added: 'ajouté'
      readonly untracked: 'nouveau, pas encore suivi par git'
      readonly deleted: 'supprimé'
      readonly renamed: 'renommé'
    }
    readonly view: {
      readonly conversation: 'Conversation'
      readonly git: 'Git'
      readonly children: 'Filles'
    }
    readonly refresh: 'Actualiser'
    readonly empty: {
      readonly conversation: 'L’agent n’a encore modifié aucun fichier dans cette conversation.'
      readonly conversationNoGit: 'L’agent n’a encore modifié aucun fichier dans cette conversation. (Le dossier n’est pas un dépôt git.)'
      readonly git: 'Aucune modification depuis le dernier commit.'
    }
    readonly sinceLastCommit: '· depuis le dernier commit'
    readonly reverted: 'annulée'
    readonly revert: 'Annuler cette modification'
    readonly revertLabel: 'Annuler la modification de {{path}}'
    readonly open: 'Ouvrir avec l’app par défaut'
    readonly openLabel: 'Ouvrir {{path}}'
    readonly reveal: 'Afficher dans le Finder'
    readonly revealLabel: 'Afficher {{path}} dans le Finder'
    readonly revertConfirm: 'Remettre'
    readonly keep: 'Garder'
    readonly loading: 'Chargement…'
    readonly binary: 'Fichier binaire : pas de diff.'
    readonly tooLarge: 'Fichier trop gros pour être affiché.'
    readonly revertFailed: {
      readonly conflict: 'Fichier modifié depuis (ou supprimé) : non touché.'
      readonly outside: 'Fichier hors du dossier de la conversation : non touché.'
      readonly failed: 'Impossible de remettre le fichier dans son état d’avant.'
    }
    readonly files_one: '{{count}} fichier'
    readonly files_other: '{{count}} fichiers'
    readonly revertAsk: 'Remettre <strong>{{name}}</strong> dans son état d’avant la conversation ?'
    readonly revertCreated: 'Créé par l’agent : il sera supprimé.'
    readonly files_many: '{{count}} fichiers'
    readonly binaryBadge: 'binaire'
    readonly changeOf: 'Modification {{index}} sur {{total}}'
    readonly children: {
      readonly revealLabel: 'Afficher le worktree de « {{title}} » dans le Finder'
      readonly editorLabel: 'Ouvrir le worktree de « {{title}} » dans {{editor}}'
    }
  }
  readonly install: {
    readonly title: 'Installer Bobine'
    readonly fromDmg: 'Elle s’exécute depuis le disque image. Installée, elle s’ouvrira comme vos autres apps, et le disque image sera éjecté.'
    readonly elsewhere: 'Installée, elle s’ouvrira comme vos autres apps.'
    readonly never: 'Ne plus proposer'
    readonly later: 'Plus tard'
    readonly installing: 'Installation…'
    readonly install: 'Installer'
    readonly replaces: 'La version déjà installée là ira à la corbeille.'
    readonly scope: {
      readonly everyone: {
        readonly title: 'Pour tous les utilisateurs de ce Mac'
        readonly where: 'Dans le dossier Applications.'
        readonly denied: 'Demande les droits d’administrateur : glissez Bobine sur Applications, le Finder demandera le mot de passe.'
      }
      readonly me: {
        readonly title: 'Pour moi seulement'
        readonly where: 'Dans le dossier Applications de votre dossier personnel. Aucun droit d’administrateur.'
        readonly denied: 'Impossible d’écrire dans le dossier Applications de votre dossier personnel.'
      }
    }
    readonly error: {
      readonly alreadyInstalled: 'Rien à installer : Bobine est déjà dans Applications.'
      readonly needsAdmin: 'Il faut les droits d’administrateur pour installer Bobine pour tous les utilisateurs.'
    }
  }
  readonly panel: {
    readonly device: {
      readonly streamInterrupted: 'Flux vidéo interrompu ({{reason}}) : captures successives.'
      readonly live: 'en direct'
      readonly attach: 'Joindre cet écran au message'
      readonly home: 'Accueil'
      readonly screen: 'Écran de {{name}}'
      readonly emptyCapture: 'Capture vide'
      readonly fps: '{{fps}} fps'
      readonly controls: 'Commandes de l’appareil'
      readonly zoom: {
        readonly label: 'Zoom de l’appareil'
        readonly out: 'Dézoomer'
        readonly fit: 'Ajuster au panneau'
        readonly actual: 'Taille réelle'
        readonly in: 'Zoomer'
      }
    }
    readonly tab: {
      readonly browser: 'Navigateur'
      readonly simulator: 'iOS'
      readonly android: 'Android'
      readonly terminal: 'Terminal'
      readonly tasks: 'Tâches'
      readonly changes: 'Modifications'
      readonly document: 'Aperçu'
      readonly acp: 'Échanges ACP'
      readonly session: 'Session'
    }
  }
  readonly android: {
    readonly noSdk: 'SDK Android introuvable (installé avec Android Studio, ou indiqué par ANDROID_HOME).'
    readonly notReady: '« {{name}} » n’est pas prêt ({{state}}).'
    readonly none: 'Aucun appareil Android démarré. L’agent peut lancer un émulateur (android_boot).'
    readonly title: 'Émulateur {{name}}'
    readonly back: 'Retour'
    readonly recents: 'Apps récentes'
    readonly fps: 'Images reçues de l’émulateur par seconde (il n’en envoie que quand l’écran change)'
    readonly power: 'Marche/arrêt'
    readonly volumeUp: 'Volume +'
    readonly volumeDown: 'Volume −'
    readonly sdkMissing: 'SDK Android introuvable'
    readonly unknownSize: 'Taille de l’écran inconnue'
    readonly readFailed: 'Lecture de l’écran impossible : {{error}}'
  }
  readonly browser: {
    readonly newTab: 'Nouvel onglet'
    readonly closeTab: 'Fermer l’onglet'
    readonly back: 'Précédent'
    readonly forward: 'Suivant'
    readonly stop: 'Arrêter'
    readonly reload: 'Recharger'
    readonly addressPlaceholder: 'Adresse (ex. localhost:3000)'
    readonly attach: 'Joindre cette page au message'
    readonly empty: 'Les pages ouvertes par l’agent s’affichent ici. Vous pouvez aussi saisir une adresse.'
    readonly url: {
      readonly empty: 'Adresse vide'
      readonly invalid: 'Adresse invalide : {{input}}'
      readonly protocol: 'Seules les adresses http et https sont ouvertes (reçu : {{protocol}})'
    }
    readonly capture: { readonly titled: 'Page {{title}}'; readonly untitled: 'Page' }
    readonly download: {
      readonly title: 'Enregistrer le fichier'
      readonly byPage: 'Fichier proposé par {{site}}.'
      readonly byAgent: 'Téléchargement lancé par l’agent depuis {{site}}.'
      readonly byAgentIn: 'Téléchargement lancé par l’agent de « {{title}} » depuis {{site}}.'
      readonly saved: 'Fichier enregistré : {{name}}'
      readonly failed: 'Échec du téléchargement : {{name}}'
      readonly show: 'Afficher dans le Finder'
    }
    readonly zoom: {
      readonly chip: '{{percent}} %'
      readonly reset: 'Zoom de la page : {{percent}} %. Cliquer pour revenir à 100 %'
    }
    readonly emulation: {
      readonly chip: '{{width}} × {{height}}'
      readonly tip: 'Taille d’écran imposée par l’agent jusqu’à la fin de son tour, affichée à {{percent}} % pour tenir. Cliquer pour rendre à la page la largeur du panneau'
    }
    readonly annotate: {
      readonly button: 'Annoter la page : une remarque là où vous cliquez'
      readonly hint: 'Cliquez là où vous voulez laisser une remarque. La page défile et zoome comme d’habitude.'
      readonly esc: 'Échap'
      readonly finish: 'pour finir'
      readonly frozen: 'Page figée : cliquez pour laisser une remarque'
      readonly pin: 'Remarque {{n}}'
      readonly image: 'Page annotée'
      readonly imageN: 'Page annotée {{n}}'
    }
  }
  readonly devServers: {
    readonly hideLog: 'Masquer le journal'
    readonly showLog: 'Journal du serveur'
    readonly stop: 'Arrêter le serveur'
    readonly noLines: '(aucune ligne)'
    readonly status: {
      readonly starting: 'démarre…'
      readonly running: 'en marche'
      readonly attached: 'déjà lancé'
      readonly exited: 'arrêté'
      readonly failed: 'échec'
    }
    readonly unknown: 'Aucun serveur « {{name}} » lancé pour ce dossier'
  }
  readonly simulator: {
    readonly shutdown: '« {{name}} » est arrêté. L’agent peut le démarrer (ios_boot).'
    readonly none: 'Aucun simulateur démarré. L’agent peut en démarrer un, ou ouvrez-en un dans Xcode.'
    readonly title: 'Simulateur {{name}}'
    readonly lock: 'Verrouiller'
    readonly noAxe: 'Touchers et vidéo indisponibles : installez AXe (github.com/cameroncooke/AXe).'
    readonly fps: 'Images dessinées par seconde'
    readonly fpsWithAxe: 'Images dessinées par seconde (AXe {{version}})'
    readonly axeVersion: 'Version d’AXe (touchers, lecture, vidéo)'
    readonly axeVersionAt: 'Version d’AXe (touchers, lecture, vidéo) : {{path}}'
    readonly axe: 'AXe {{version}}'
    readonly axeInstallHint: 'Lancez « pnpm fetch-axe » dans le dépôt (sans réseau : archive versionnée), puis relancez l’app.'
    readonly streamStopped: 'flux arrêté (code {{code}})'
  }
  readonly annotator: {
    readonly textPlaceholder: 'Texte…'
    readonly textHint: 'Entrée pour valider, Maj+Entrée pour aller à la ligne'
    readonly title: 'Annoter l’image'
    readonly description: 'Rectangle, flèche, crayon ou texte par-dessus l’image, puis Appliquer.'
    readonly tool: 'Outil'
    readonly color: {
      readonly label: 'Couleur'
      readonly red: 'Rouge'
      readonly yellow: 'Jaune'
      readonly blue: 'Bleu'
      readonly black: 'Noir'
    }
    readonly undoTip: 'Annuler le dernier (⌘Z)'
    readonly undo: 'Annuler le dernier'
    readonly clear: 'Tout effacer'
    readonly apply: 'Appliquer'
    readonly tools: {
      readonly rect: 'Rectangle'
      readonly arrow: 'Flèche'
      readonly pen: 'Crayon'
      readonly text: 'Texte'
    }
  }
  readonly quick: {
    readonly placeholderAgent: 'Demander à {{agent}}…'
    readonly placeholder: 'Demander à l’agent…'
    readonly message: 'Message'
    readonly target: 'Nouvelle conversation · {{agent}} · {{folder}}'
    readonly send: 'Envoyer'
    readonly shortcut: {
      readonly off: 'Désactivé'
      readonly altSpace: '⌥Espace'
      readonly shiftAltSpace: '⇧⌥Espace'
    }
  }
  readonly document: {
    readonly reload: 'Relire'
    readonly open: 'Ouvrir avec l’app par défaut'
    readonly reveal: 'Montrer dans le Finder'
    readonly close: 'Fermer l’aperçu'
    readonly truncated: 'Document trop long : seul le début est montré. « Ouvrir avec l’app par défaut » pour la suite.'
  }
  readonly sidePanel: {
    readonly resize: 'Redimensionner le panneau'
    readonly close: 'Fermer le panneau'
    readonly closeTab: 'Fermer l’onglet {{tab}}'
    readonly maximize: 'Agrandir le panneau (⇧⌘J)'
    readonly restore: 'Réduire le panneau (⇧⌘J)'
    readonly more: 'Autres outils'
    readonly moreTitle: 'Ouvrir un outil'
    readonly openTabs: 'Onglets ouverts'
    readonly moreTabs_one: '{{count}} onglet de plus · {{more}}'
    readonly moreTabs_many: '{{count}} onglets de plus · {{more}}'
    readonly moreTabs_other: '{{count}} onglets de plus · {{more}}'
    readonly agent: {
      readonly busy: 'L’agent répond…'
      readonly request: 'Attend votre réponse'
      readonly back: 'Revenir à la conversation'
    }
    readonly attached: {
      readonly page: 'Page jointe au message'
      readonly screen: 'Écran joint au message'
    }
    readonly noTasks: 'L’agent n’a pas encore de liste de tâches dans cette conversation.'
    readonly progress_one: '{{done}} / {{count}} tâche faite'
    readonly progress_other: '{{done}} / {{count}} tâches faites'
    readonly progress_many: '{{done}} / {{count}} tâches faites'
  }
  readonly pinnedPlan: { readonly title: 'Tâches'; readonly label: 'Tâches de l’agent' }
  readonly terminal: {
    readonly busy: 'occupé'
    readonly closeLabel: 'Fermer le terminal {{id}}'
    readonly new: 'Nouveau terminal'
    readonly addToMessage: 'Ajouter au message'
    readonly none: 'Aucun terminal ouvert.'
    readonly ended: 'terminé'
  }
  readonly errorBoundary: {
    readonly title: 'L’interface a rencontré une erreur'
    readonly description: 'Vos conversations ne sont pas perdues : elles continuent dans l’app.'
    readonly reload: 'Recharger l’interface'
    readonly showLog: 'Afficher le journal'
    readonly item: {
      readonly message: 'Ce message ne peut pas être affiché.'
      readonly tool: 'Cette action de l’agent ne peut pas être affichée.'
      readonly diff: 'Ces modifications ne peuvent pas être affichées.'
      readonly other: 'Cet élément de la conversation ne peut pas être affiché.'
      readonly rest: 'Le reste de la conversation n’est pas touché.'
    }
    readonly details: 'Détails techniques'
    readonly panel: {
      readonly title: 'Ce panneau n’a pas pu s’afficher.'
      readonly rest: 'Le reste de Bobine fonctionne normalement.'
    }
    readonly page: { readonly title: 'Cette page n’a pas pu s’afficher.' }
    readonly retry: 'Réessayer'
  }
  readonly home: {
    readonly hello: {
      readonly morning: 'Bonjour'
      readonly afternoon: 'Bon après-midi'
      readonly evening: 'Bonsoir'
    }
    readonly greeting: '{{hello}}, on s’y met ?'
    readonly greetingWithName: '{{hello}} {{name}}, on s’y met ?'
    readonly suggestions: {
      readonly explain: {
        readonly label: 'Explique ce projet'
        readonly text: 'Explique-moi ce projet : à quoi il sert, comment il est organisé et comment le lancer.'
      }
      readonly bugs: {
        readonly label: 'Trouve des bugs'
        readonly text: 'Relis le code de ce projet et signale les bugs probables, du plus grave au moins grave.'
      }
      readonly tests: {
        readonly label: 'Écris des tests'
        readonly text: 'Écris des tests pour la partie la moins bien couverte de ce projet.'
      }
      readonly plan: { readonly label: 'Prépare un plan'; readonly text: 'Propose un plan pour ' }
    }
  }
  readonly appCommands: {
    readonly model: {
      readonly none: '{{agent}} ne propose pas de choix de modèle.'
      readonly noMatch: 'Aucun modèle unique ne correspond à « {{args}} ».'
    }
    readonly mode: {
      readonly none: '{{agent}} ne propose pas de choix de mode.'
      readonly noMatch: 'Aucun mode unique ne correspond à « {{args}} ».'
    }
    readonly choices: '{{name}} :\n{{list}}'
    readonly chosen: '{{name}} : {{value}}'
    readonly cannotCompact: '{{agent}} ne sait pas compacter sa conversation.'
    readonly splitEmpty: 'Écrivez après /split ce qu’il faut découper, par exemple : /split Trois chantiers : l’import, l’export, la page d’aide.'
    readonly list: {
      readonly clear: 'Nouvelle conversation, même agent et même dossier'
      readonly compact: 'Résumer la conversation pour libérer du contexte'
      readonly context: 'Contexte utilisé et consommation'
      readonly cost: 'Coût de la conversation'
      readonly model: 'Voir ou changer le modèle'
      readonly mode: 'Voir ou changer le mode (agent, plan…)'
      readonly init: 'Créer ou compléter AGENTS.md pour ce projet'
      readonly review: 'Revue des modifications en cours'
      readonly split: 'Découper le message en conversations filles, une par chantier'
      readonly help: 'Liste des commandes'
      readonly agentCompact: 'Résumer la conversation pour libérer du contexte (commande de {{agent}} ; /compact y mène aussi)'
      readonly btw: 'Aparté : une question à côté, répondue hors du fil'
    }
    readonly hint: {
      readonly name: '[nom]'
      readonly message: '[message]'
      readonly question: '[question]'
    }
    readonly report: {
      readonly context: 'Contexte de la conversation'
      readonly cost: 'Coût de la conversation'
    }
  }
  readonly appTools: {
    readonly browser_navigate: {
      readonly value: 'Ouvre {{value}}'
      readonly default: 'Ouvre une page'
    }
    readonly browser_screenshot: { readonly default: 'Capture la page' }
    readonly browser_read_page: { readonly default: 'Lit la structure de la page' }
    readonly browser_get_page_text: { readonly default: 'Lit le texte de la page' }
    readonly browser_find: {
      readonly value: 'Cherche « {{value}} » dans la page'
      readonly default: 'Cherche dans la page'
    }
    readonly browser_click: {
      readonly default: 'Clique dans la page'
      readonly double: 'Double-clic dans la page'
    }
    readonly browser_hover: { readonly default: 'Survole un élément de la page' }
    readonly browser_type: { readonly value: 'Saisit « {{value}} »'; readonly default: 'Saisit' }
    readonly browser_key: {
      readonly value: 'Appuie sur {{value}}'
      readonly default: 'Appuie sur une touche'
    }
    readonly browser_scroll: {
      readonly default: 'Fait défiler la page'
      readonly up: 'Fait défiler la page vers le haut'
      readonly down: 'Fait défiler la page vers le bas'
      readonly left: 'Fait défiler la page vers la gauche'
      readonly right: 'Fait défiler la page vers la droite'
    }
    readonly browser_drag: { readonly default: 'Fait glisser un élément de la page' }
    readonly browser_form_input: {
      readonly value: 'Remplit un champ avec « {{value}} »'
      readonly default: 'Remplit un champ avec'
    }
    readonly browser_console: { readonly default: 'Lit la console de la page' }
    readonly browser_network: { readonly default: 'Lit les requêtes réseau de la page' }
    readonly browser_javascript: { readonly default: 'Exécute du JavaScript dans la page' }
    readonly browser_resize: {
      readonly mobile: {
        readonly none: 'Affiche la page en taille mobile'
        readonly dark: 'Affiche la page en taille mobile en sombre'
        readonly light: 'Affiche la page en taille mobile en clair'
      }
      readonly tablet: {
        readonly none: 'Affiche la page en taille tablette'
        readonly dark: 'Affiche la page en taille tablette en sombre'
        readonly light: 'Affiche la page en taille tablette en clair'
      }
      readonly desktop: {
        readonly none: 'Affiche la page en taille bureau'
        readonly dark: 'Affiche la page en taille bureau en sombre'
        readonly light: 'Affiche la page en taille bureau en clair'
      }
      readonly none: {
        readonly none: 'Change la taille de la page'
        readonly dark: 'Affiche la page en sombre'
        readonly light: 'Affiche la page en clair'
      }
    }
    readonly browser_tabs: {
      readonly newValue: 'Ouvre un onglet {{value}}'
      readonly new: 'Ouvre un onglet'
      readonly select: 'Change d’onglet'
      readonly close: 'Ferme un onglet'
      readonly list: 'Liste les onglets'
    }
    readonly browser_batch: { readonly default: 'Enchaîne des actions dans la page' }
    readonly browser_filmstrip: { readonly default: 'Filme la page pendant un geste' }
    readonly ios_devices: { readonly default: 'Liste les simulateurs iOS' }
    readonly ios_boot: {
      readonly value: 'Démarre le simulateur {{value}}'
      readonly default: 'Démarre le simulateur'
    }
    readonly ios_build: {
      readonly value: 'Compile l’app iOS {{value}}'
      readonly default: 'Compile l’app iOS'
    }
    readonly ios_launch: { readonly value: 'Lance {{value}}'; readonly default: 'Lance l’app' }
    readonly ios_screenshot: { readonly default: 'Capture le simulateur' }
    readonly ios_describe: { readonly default: 'Lit l’écran du simulateur' }
    readonly ios_tap: { readonly value: 'Touche « {{value}} »'; readonly default: 'Touche l’écran' }
    readonly ios_swipe: { readonly default: 'Balaie l’écran du simulateur' }
    readonly ios_filmstrip: { readonly default: 'Filme le simulateur pendant un geste' }
    readonly ios_type: {
      readonly value: 'Saisit « {{value}} »'
      readonly default: 'Saisit au clavier'
    }
    readonly ios_button: {
      readonly value: 'Appuie sur le bouton {{value}}'
      readonly default: 'Appuie sur le bouton'
    }
    readonly ios_open_url: { readonly value: 'Ouvre {{value}}'; readonly default: 'Ouvre un lien' }
    readonly android_devices: { readonly default: 'Liste les émulateurs Android' }
    readonly android_boot: {
      readonly value: 'Démarre l’émulateur {{value}}'
      readonly default: 'Démarre l’émulateur'
    }
    readonly android_build: {
      readonly value: 'Compile l’app Android {{value}}'
      readonly default: 'Compile l’app Android'
    }
    readonly android_launch: { readonly value: 'Lance {{value}}'; readonly default: 'Lance l’app' }
    readonly android_screenshot: { readonly default: 'Capture l’émulateur' }
    readonly android_describe: { readonly default: 'Lit l’écran de l’émulateur' }
    readonly android_tap: { readonly default: 'Touche l’écran' }
    readonly android_swipe: { readonly default: 'Balaie l’écran de l’émulateur' }
    readonly android_filmstrip: { readonly default: 'Filme l’émulateur pendant un geste' }
    readonly android_type: { readonly value: 'Saisit « {{value}} »'; readonly default: 'Saisit' }
    readonly android_key: {
      readonly value: 'Appuie sur {{value}}'
      readonly default: 'Appuie sur une touche'
    }
    readonly android_open_url: {
      readonly value: 'Ouvre {{value}}'
      readonly default: 'Ouvre un lien'
    }
    readonly android_logcat: { readonly default: 'Lit le journal de l’émulateur' }
    readonly terminal_list: { readonly default: 'Liste les terminaux' }
    readonly terminal_read: { readonly default: 'Lit le terminal' }
    readonly terminal_run: {
      readonly value: 'Lance « {{value}} » dans le terminal'
      readonly default: 'Lance dans le terminal'
    }
    readonly terminal_stop: { readonly default: 'Arrête la commande du terminal' }
    readonly preview_list: { readonly default: 'Liste les serveurs de dev' }
    readonly preview_start: {
      readonly value: 'Lance le serveur {{value}}'
      readonly default: 'Lance le serveur'
    }
    readonly preview_logs: {
      readonly value: 'Lit le journal du serveur {{value}}'
      readonly default: 'Lit le journal du serveur'
    }
    readonly preview_stop: {
      readonly value: 'Arrête le serveur {{value}}'
      readonly default: 'Arrête le serveur'
    }
    readonly ask_user: {
      readonly value: 'Pose une question : {{value}}'
      readonly default: 'Pose une question :'
    }
    readonly start_child: {
      readonly value: 'Lance une conversation fille : {{value}}'
      readonly default: 'Lance une conversation fille'
    }
    readonly message_child: {
      readonly value: 'Écrit à une conversation fille : {{value}}'
      readonly default: 'Écrit à une conversation fille'
    }
    readonly child_status: { readonly default: 'Regarde où en sont les conversations filles' }
    readonly recommend_merge: {
      readonly ready: 'Recommande de fusionner {{value}}'
      readonly notReady: 'Ne recommande pas encore {{value}}'
      readonly default: 'Donne son avis sur une fusion'
    }
    readonly message_parent: {
      readonly value: 'Écrit à la conversation mère : {{value}}'
      readonly default: 'Écrit à la conversation mère'
    }
    readonly report_findings: {
      readonly count_one: 'Rend {{count}} remarque de relecture'
      readonly count_many: 'Rend {{count}} remarques de relecture'
      readonly count_other: 'Rend {{count}} remarques de relecture'
    }
    readonly remember: {
      readonly value: 'Propose de retenir : {{value}}'
      readonly default: 'Propose un souvenir'
    }
    readonly recall: {
      readonly count_one: 'Relit {{count}} souvenir'
      readonly count_many: 'Relit {{count}} souvenirs'
      readonly count_other: 'Relit {{count}} souvenirs'
      readonly default: 'Relit des souvenirs'
    }
    readonly forget: {
      readonly value: 'Propose d’oublier {{value}}'
      readonly default: 'Propose d’oublier un souvenir'
    }
    readonly generic: 'Outil de Bobine : {{name}}'
    readonly serverDown: 'Les outils de Bobine (questions, navigateur, simulateur…) ne sont pas disponibles pour l’agent : leur serveur n’a pas démarré. Quittez et rouvrez Bobine ; si cela recommence, le journal dit pourquoi.'
  }
  readonly appToolFamilies: {
    readonly always: 'Toujours'
    readonly 'ask-user': {
      readonly title: 'Questions'
      readonly summary: 'Poser une question à choix, en carte dans le fil.'
    }
    readonly browser: {
      readonly title: 'Navigateur intégré'
      readonly summary: 'Ouvrir les pages de votre app, cliquer, saisir, lire la page, sa console et son réseau, prendre des captures.'
      readonly approval: 'Accord pour un site hors de ce Mac'
    }
    readonly preview: {
      readonly title: 'Lancer l’app'
      readonly summary: 'Démarrer le serveur de dev du projet, l’ouvrir dans le navigateur intégré et lire son journal.'
      readonly approval: 'Accord avant de lancer une commande'
    }
    readonly terminal: {
      readonly title: 'Terminal'
      readonly summary: 'Lancer des commandes dans le terminal de la conversation, lire ce qui s’y affiche, les arrêter.'
      readonly approval: 'Accord pour chaque nouvelle commande'
    }
    readonly 'ios-simulator': {
      readonly title: 'Simulateur iOS'
      readonly summary: 'Compiler, installer et lancer l’app sur un simulateur, lire l’écran, toucher, glisser, taper, prendre des captures.'
      readonly condition: 'Projet Xcode ou Swift dans le dossier'
      readonly approval: 'Accord avant de compiler'
    }
    readonly 'android-emulator': {
      readonly title: 'Émulateur Android'
      readonly summary: 'Compiler avec Gradle, installer et lancer l’app sur un émulateur, lire l’écran et les journaux, toucher, glisser, taper.'
      readonly condition: 'Projet Android (Gradle) dans le dossier'
      readonly approval: 'Accord avant de compiler'
    }
    readonly children: {
      readonly title: 'Conversations filles'
      readonly summary: 'Lancer d’autres agents en parallèle, chacun dans son worktree git, leur écrire et suivre leur état ; une fille écrit à sa mère. Une relecture rend ses remarques.'
      readonly condition: 'Dossier dans un dépôt git'
      readonly approval: 'Accord pour chaque fille'
    }
    readonly memory: {
      readonly title: 'Mémoire'
      readonly summary: 'Proposer de retenir ou d’oublier un souvenir commun à tous les agents, relire les souvenirs.'
      readonly condition: 'Mémoire activée dans les réglages'
      readonly approval: 'Votre accord pour chaque souvenir retenu ou oublié'
    }
  }
  readonly shortcuts: {
    readonly menu: {
      readonly 'new-conversation': 'Nouvelle conversation'
      readonly search: 'Rechercher une conversation'
      readonly 'resume-session': 'Reprendre une session…'
      readonly settings: 'Réglages'
      readonly 'focus-composer': 'Aller à la zone de saisie'
      readonly stop: 'Arrêter la réponse'
      readonly 'previous-conversation': 'Conversation précédente'
      readonly 'next-conversation': 'Conversation suivante'
      readonly 'toggle-sidebar': 'Barre latérale'
      readonly 'toggle-panel': 'Panneau de droite'
      readonly find: 'Rechercher…'
      readonly 'find-next': 'Rechercher le suivant'
      readonly 'find-previous': 'Rechercher le précédent'
      readonly 'maximize-panel': 'Agrandir le panneau'
      readonly 'toggle-terminal': 'Terminal'
      readonly 'show-changes': 'Modifications'
      readonly shortcuts: 'Raccourcis clavier'
      readonly activity: 'Mon activité'
      readonly aside: 'Aparté…'
      readonly help: 'Aide de Bobine'
    }
    readonly interface: {
      readonly send: { readonly label: 'Envoyer le message' }
      readonly newline: { readonly label: 'Nouvelle ligne' }
      readonly mode: { readonly label: 'Changer de mode (agent, plan…)' }
      readonly escape: {
        readonly label: 'Arrêter la réponse, fermer un menu'
        readonly keys: 'Échap'
      }
      readonly commands: { readonly label: 'Commandes (en début de message)' }
      readonly mention: { readonly label: 'Joindre un fichier du dossier' }
      readonly choice: {
        readonly label: 'Choisir une réponse dans une question'
        readonly keys: '1 à 9'
      }
      readonly recall: {
        readonly label: 'Dans une zone vide, reprendre le dernier message en attente'
      }
    }
  }
  readonly activity: {
    readonly subagent: 'Sous-agent : {{task}}'
    readonly thinking: 'Réfléchit…'
    readonly writing: 'Écrit…'
    readonly permission: 'Attend votre accord'
    readonly question: 'Attend votre réponse'
    readonly turnStarted: 'Tour commencé il y a {{elapsed}}'
    readonly title: 'Mon activité'
    readonly scope: {
      readonly label: 'Période'
      readonly week: 'Semaine'
      readonly month: 'Mois'
      readonly year: 'Année'
    }
    readonly nav: { readonly previous: 'Période précédente'; readonly next: 'Période suivante' }
    readonly day: { readonly back: 'Revenir à la semaine' }
    readonly heat: {
      readonly label: 'Grille d’activité : échanges par jour'
      readonly total_one: '{{total}} échange'
      readonly total_many: '{{total}} échanges'
      readonly total_other: '{{total}} échanges'
      readonly last12: 'ces 12 derniers mois'
      readonly inYear: 'en {{year}}'
      readonly range: 'Étendue de la grille'
      readonly rangeLast12: '12 derniers mois'
      readonly hint: 'Un clic sur un jour affiche ce jour.'
      readonly less: 'Moins'
      readonly more: 'Plus'
      readonly tip_one: '{{count}} échange · {{day}}'
      readonly tip_many: '{{count}} échanges · {{day}}'
      readonly tip_other: '{{count}} échanges · {{day}}'
      readonly agent: '{{agent}} {{count}}'
    }
    readonly delta: {
      readonly percent: '{{percent}} %'
      readonly stable: 'stable'
      readonly week: '{{delta}} vs semaine précédente'
      readonly weekToDate: '{{delta}} vs semaine précédente à date égale'
      readonly month: '{{delta}} vs {{month}}'
      readonly monthToDate: '{{delta}} vs {{month}} à date égale'
      readonly weekday: '{{ratio}} × la moyenne d’un {{weekday}}'
      readonly tip: 'Avant : {{value}}'
    }
    readonly export: { readonly all: 'Tout l’historique, une ligne par échange (CSV)…' }
    readonly chart: {
      readonly label: 'Consommation de la période'
      readonly title: {
        readonly hour: {
          readonly turns: 'Échanges par heure'
          readonly time: 'Temps de travail par heure'
          readonly tokens: 'Jetons par heure'
          readonly cost: 'Coût par heure ({{unit}})'
        }
        readonly day: {
          readonly turns: 'Échanges par jour'
          readonly time: 'Temps de travail par jour'
          readonly tokens: 'Jetons par jour'
          readonly cost: 'Coût par jour ({{unit}})'
        }
        readonly month: {
          readonly turns: 'Échanges par mois'
          readonly time: 'Temps de travail par mois'
          readonly tokens: 'Jetons par mois'
          readonly cost: 'Coût par mois ({{unit}})'
        }
      }
    }
    readonly empty: {
      readonly title: 'Votre activité s’affichera ici'
      readonly text: 'Échanges, temps de travail et coût, jour par jour, dès votre première conversation.'
      readonly action: 'Nouvelle conversation'
    }
    readonly readOnly: {
      readonly title: 'Consommation non lue'
      readonly text: 'Ce profil est en lecture seule : la consommation n’y est pas lue. Mettez Bobine à jour pour la retrouver.'
    }
  }
  readonly mentions: {
    readonly gitChanges: {
      readonly label: 'Modifications git'
      readonly description: 'État et diff du dossier depuis le dernier commit'
    }
    readonly terminal: {
      readonly label: 'Terminal'
      readonly description: 'Dernières lignes du terminal de la conversation'
    }
  }
  readonly export: {
    readonly agent: 'Agent : {{agent}}'
    readonly folder: 'Dossier : {{folder}}'
    readonly updatedAt: 'Dernière activité : {{date}}'
    readonly exportedAt: 'Exporté le {{date}} par Bobine'
    readonly omitted: '[… {{count}} caractères omis]'
    readonly you: 'Vous'
    readonly attachments: 'Pièces jointes : {{files}}'
    readonly thought: 'Réflexion'
    readonly tool: 'Outil'
    readonly changedFile: 'Fichier modifié : {{path}}'
    readonly tasks: 'Tâches'
    readonly notice: '{{level}} : {{text}}'
    readonly answer: 'réponse : {{answer}}'
    readonly question: 'Question de l’agent'
    readonly branch: 'Branche de « {{title}} » ({{n}} fichier(s) remis en état)'
    readonly summary: 'Résumé de l’échange'
    readonly childStarted: 'Conversation fille lancée : « {{title}} »'
    readonly childReport: 'Compte rendu de « {{title}} » : {{files}}'
    readonly childRecommended: 'La mère recommande de fusionner « {{title}} »'
    readonly childNotRecommended: 'La mère ne recommande pas encore de fusionner « {{title}} »'
    readonly handover: 'Suite avec {{agent}}'
    readonly worktreeStart: 'Worktree parti de {{branch}} au commit {{hash}}'
    readonly worktreeStartDetached: 'Worktree parti du commit {{hash}}'
    readonly childrenMerge_one: 'Fusion des conversations filles dans {{base}} : {{count}} fusionnée'
    readonly childrenMerge_other: 'Fusion des conversations filles dans {{base}} : {{count}} fusionnées'
    readonly childrenMerge_many: 'Fusion des conversations filles dans {{base}} : {{count}} fusionnées'
  }
  readonly menu: {
    readonly about: 'À propos de {{app}}'
    readonly settings: 'Réglages…'
    readonly services: 'Services'
    readonly hide: 'Masquer {{app}}'
    readonly hideOthers: 'Masquer les autres'
    readonly unhide: 'Tout afficher'
    readonly quit: 'Quitter {{app}}'
    readonly file: 'Fichier'
    readonly quickEntry: 'Fenêtre rapide'
    readonly close: 'Fermer la fenêtre'
    readonly edit: 'Édition'
    readonly undo: 'Annuler'
    readonly redo: 'Rétablir'
    readonly cut: 'Couper'
    readonly copy: 'Copier'
    readonly paste: 'Coller'
    readonly pasteAndMatchStyle: 'Coller et adapter le style'
    readonly delete: 'Supprimer'
    readonly selectAll: 'Tout sélectionner'
    readonly copyLink: 'Copier l’adresse du lien'
    readonly copyImage: 'Copier l’image'
    readonly view: 'Affichage'
    readonly resetZoom: 'Taille réelle'
    readonly zoomIn: 'Zoom avant'
    readonly zoomOut: 'Zoom arrière'
    readonly reload: 'Recharger'
    readonly devTools: 'Outils de développement'
    readonly conversation: 'Conversation'
    readonly window: 'Fenêtre'
    readonly minimize: 'Minimiser'
    readonly zoom: 'Réduire/agrandir'
    readonly front: 'Tout ramener au premier plan'
    readonly help: 'Aide'
    readonly diagnostics: 'Diagnostic…'
    readonly showLog: 'Afficher le journal'
    readonly exitFullscreen: 'Quitter le plein écran'
    readonly fullscreen: 'Plein écran'
    readonly presentation: 'Mode présentation'
  }
  readonly dialogs: {
    readonly attach: { readonly title: 'Joindre des fichiers'; readonly button: 'Joindre' }
    readonly workspace: {
      readonly title: 'Dossier de travail de l’agent'
      readonly button: 'Choisir'
    }
    readonly export: { readonly title: 'Exporter la conversation'; readonly button: 'Exporter' }
    readonly oldApp: {
      readonly title: 'Bob Desktop est encore ouvert'
      readonly message: 'Quittez Bob Desktop (l’ancien nom de Bobine), puis relancez Bobine : elle reprendra son historique et ses réglages.'
    }
    readonly startFailed: {
      readonly title: 'Bobine n’a pas pu démarrer'
      readonly message: '{{error}}\n\nJournal : {{log}}'
    }
    readonly backup: {
      readonly title: 'Dossier de la sauvegarde'
      readonly button: 'Sauvegarder ici'
    }
    readonly usageExport: { readonly title: 'Exporter la consommation' }
    readonly extraFolder: {
      readonly title: 'Ajouter un dossier à la conversation'
      readonly button: 'Ajouter'
    }
    readonly rendererCrashed: {
      readonly title: 'L’interface de Bobine s’est arrêtée plusieurs fois'
      readonly message: 'Elle a été rechargée trois fois en une minute. Vos conversations sont gardées. Relancez Bobine : elle repartira de l’accueil. Si cela recommence, le journal aide à comprendre.'
      readonly relaunch: 'Relancer Bobine'
      readonly showLog: 'Afficher le journal'
      readonly quit: 'Quitter'
    }
    readonly restore: { readonly title: 'Sauvegarde à restaurer'; readonly button: 'Choisir' }
  }
  readonly quit: {
    readonly title_one: 'Un agent travaille encore'
    readonly title_other: 'Des agents travaillent encore'
    readonly detail_one: '« {{first}} » est en train de répondre. Quitter arrêtera l’agent.'
    readonly detail_other: '{{count}} conversations sont en train de répondre. Quitter arrêtera leurs agents.'
    readonly confirm: 'Quitter'
    readonly cancel: 'Annuler'
    readonly title_many: 'Des agents travaillent encore'
    readonly detail_many: '{{count}} conversations sont en train de répondre. Quitter arrêtera leurs agents.'
  }
  readonly notifications: {
    readonly permission: 'Demande une autorisation : {{tool}}'
    readonly tool: 'outil'
    readonly question: 'Pose une question : {{question}}'
    readonly auth: 'Attend que vous vous connectiez.'
    readonly trust: 'Attend que vous approuviez le dossier de travail.'
    readonly done: 'A terminé.'
    readonly error: 'Erreur : {{message}}'
    readonly saveDialog: 'Un téléchargement attend votre réponse (« Enregistrer sous »).'
    readonly pageDialog: 'Une page du navigateur attend votre réponse.'
    readonly group: {
      readonly permission_one: '{{count}} conversation attend votre accord'
      readonly permission_many: '{{count}} conversations attendent votre accord'
      readonly permission_other: '{{count}} conversations attendent votre accord'
      readonly request_one: '{{count}} conversation attend votre réponse'
      readonly request_many: '{{count}} conversations attendent votre réponse'
      readonly request_other: '{{count}} conversations attendent votre réponse'
      readonly childrenDone_one: '{{count}} conversation fille a fini'
      readonly childrenDone_many: '{{count}} conversations filles ont fini'
      readonly childrenDone_other: '{{count}} conversations filles ont fini'
      readonly done_one: '{{count}} conversation a fini'
      readonly done_many: '{{count}} conversations ont fini'
      readonly done_other: '{{count}} conversations ont fini'
      readonly withError: '{{title}} (erreur)'
    }
  }
  readonly shellEnv: {
    readonly timeout: '{{shell}} n’a pas répondu en {{seconds}} s (fichiers de démarrage du shell lents ?)'
    readonly failed: 'échec'
    readonly noPath: '{{shell}} n’a pas rendu son PATH'
  }
  readonly capture: {
    readonly fileName: 'Capture d’écran {{date}} à {{time}}.{{extension}}'
    readonly tooLarge: 'Capture trop lourde, même réduite : choisissez une zone plus petite.'
  }
  readonly htmlPreview: {
    readonly outside: 'Hors du dossier de la page : {{file}}'
    readonly notFound: 'Introuvable'
    readonly forbidden: 'Refusé'
  }
  readonly agentHost: {
    readonly version: {
      readonly newer: '{{named}} est plus récent que les versions essayées avec Bobine (jusqu’à {{newest}}).'
      readonly older: '{{named}} est plus ancien que les versions essayées avec Bobine (à partir de {{oldest}}). Il devrait fonctionner ; en cas de problème, mettez {{agent}} à jour.'
      readonly belowFloor: '{{named}} est trop ancien pour cette version de Bobine (il faut au moins la {{floor}}). Mettez {{agent}} à jour, puis Relancer.'
    }
    readonly protocol: {
      readonly tooNew: '{{named}} est trop récent pour cette version de Bobine (protocole ACP {{announced}}, Bobine connaît le {{supported}}). Mettez Bobine à jour, puis Relancer.'
      readonly tooOld: '{{named}} est trop ancien pour cette version de Bobine (protocole ACP {{announced}}, Bobine connaît le {{supported}}). Mettez {{agent}} à jour, puis Relancer.'
    }
    readonly control: {
      readonly unavailable: 'Réglage impossible maintenant (statut : {{status}})'
      readonly unknown: 'Réglage inconnu : {{id}}'
      readonly badValue: 'Valeur non proposée pour « {{name}} » : {{value}}'
    }
    readonly busy: 'L’agent répond encore : réessayez à la fin de sa réponse'
    readonly notReady: 'Agent non prêt (statut : {{status}})'
    readonly authExpired: '{{agent}} n’a pas répondu : connexion expirée.'
    readonly modelAuthRefused: 'Le modèle {{model}} n’a pas répondu : {{agent}} n’est pas connecté à son fournisseur.'
    readonly licenseAtPrompt: '{{name}} demande d’accepter sa licence : renvoyez votre message, puis acceptez-la dans le formulaire qui s’affiche.'
    readonly workspaceMissing: 'Dossier de travail introuvable : {{folder}}'
    readonly exit: {
      readonly unresponsive: 'L’agent ne répondait plus à « Stop » : il a été arrêté.'
      readonly ended: 'processus terminé ({{status}})'
      readonly code: 'code {{code}}'
      readonly status: 'Sortie : {{status}}.{{hint}}'
      readonly connectionLost: 'L’agent ne répond plus : sa connexion avec Bobine s’est coupée, et Bobine l’a arrêté. « Relancer » le redémarre ; la conversation est gardée.'
    }
    readonly timeout: {
      readonly initialize: 'L’agent n’a pas répondu au démarrage'
      readonly resume: 'L’agent n’a pas rouvert la conversation'
      readonly session: 'L’agent n’a pas ouvert la session'
    }
    readonly resumeFailed: 'La conversation n’a pas pu être reprise : {{error}}'
    readonly auth: {
      readonly none: 'Aucune connexion n’est demandée'
      readonly unknownMethod: 'Méthode de connexion inconnue : {{method}}'
      readonly inTerminal: 'Cette connexion se fait dans le terminal'
    }
    readonly noBlocker: 'Aucune action n’est en attente'
    readonly noSessionTrust: 'Pas de confiance ponctuelle possible ici'
    readonly notice: {
      readonly controlFailed: 'Réglage « {{name}} » non appliqué ({{value}}) : {{error}}'
      readonly modeFailed: 'Mode de départ non appliqué : {{error}}'
      readonly elicitationUnsupported: 'Demande d’information de l’agent non prise en charge (« {{message}} ») : déclinée.'
    }
    readonly turnLimit: {
      readonly noReload: 'L’agent ne sait pas recharger sa session : ouvrez une nouvelle session avec le résumé.'
    }
  }
  readonly ipc: {
    readonly unavailable: {
      readonly mcp: 'Serveurs MCP indisponibles'
      readonly quick: 'Fenêtre rapide indisponible'
      readonly approvals: 'Autorisations retenues indisponibles'
      readonly diagnostics: 'Diagnostic indisponible'
      readonly capture: 'Capture d’écran indisponible'
      readonly install: 'Installation indisponible'
      readonly backup: 'Sauvegarde indisponible'
      readonly browser: 'Navigateur indisponible'
      readonly pageCapture: 'Capture de la page indisponible'
      readonly children: 'Les conversations filles ne sont pas disponibles ici.'
      readonly providers: 'Fournisseurs de modèles indisponibles.'
      readonly worktree: 'Le cycle des worktrees n’est pas disponible.'
      readonly about: 'Fenêtre À propos indisponible'
      readonly childrenMerge: 'La fusion des conversations filles n’est pas disponible.'
      readonly commandLine: 'Commande bobine indisponible'
      readonly commandExists: '{{path}} existe déjà et n’a pas été installé par Bobine.'
      readonly freshStart: 'Recommencer à neuf indisponible'
      readonly aside: 'L’aparté n’est pas disponible ici.'
      readonly help: 'Aide indisponible'
      readonly onboarding: 'Accueil du premier lancement indisponible'
      readonly roles: 'Les rôles ne sont pas disponibles ici.'
    }
    readonly emptyMessage: 'Message vide'
    readonly emptyPrompt: 'Prompt vide'
  }
  readonly capabilities: {
    readonly reopen: {
      readonly label: 'Reprendre une conversation de l’historique'
      readonly load: 'L’agent rejoue la conversation (`session/load`).'
      readonly resume: 'L’agent reprend la session sans la rejouer (`session/resume`).'
      readonly none: 'Une ancienne conversation continue dans une session neuve, qui reçoit l’échange d’avant en texte.'
    }
    readonly list: {
      readonly label: 'Reprendre une session commencée ailleurs'
      readonly yes: 'Ses sessions (terminal, autre éditeur) se reprennent par « Reprendre une session… ».'
      readonly no: 'L’agent ne liste pas ses sessions (`session/list`).'
    }
    readonly delete: {
      readonly label: 'Supprimer la session chez l’agent'
      readonly yes: 'Supprimer une conversation la supprime aussi chez l’agent.'
      readonly no: 'La session reste chez l’agent quand on supprime la conversation.'
    }
    readonly images: {
      readonly label: 'Images dans les messages'
      readonly no: 'Une image collée est refusée ; un fichier image est envoyé par son chemin.'
    }
    readonly embeddedFiles: {
      readonly label: 'Contenu des fichiers joints'
      readonly yes: 'Le contenu d’un fichier texte joint est envoyé avec le message.'
      readonly no: 'Seul le chemin du fichier est envoyé ; l’agent le lit lui-même.'
    }
    readonly appTools: {
      readonly label: 'Outils de l’app (navigateur, simulateur, questions…)'
      readonly no: 'L’agent n’accepte pas de serveur MCP par HTTP.'
    }
    readonly quotaBobStatus: {
      readonly label: 'Quota de Bobcoins'
      readonly detail: 'Plafond et consommation du mois selon le serveur de Bob, toutes machines confondues : lus au démarrage par la commande `/status` de Bob Shell (`bob chat` en tâche de fond, 0 Bobcoin), la tâche vide qu’elle crée étant aussitôt supprimée. Bob ne l’envoie pas par ACP.'
    }
    readonly costBobDb: {
      readonly label: 'Consommation en Bobcoins'
      readonly detail: 'Lue en lecture seule dans la base locale de Bob (`~/.bob/db/bob.db`), sous-agents compris : Bob ne l’envoie pas par ACP.'
    }
    readonly subagentCost: {
      readonly label: 'Coût de chaque sous-agent, en direct'
      readonly detail: 'Relu dans la même base toutes les 2 s pendant qu’un sous-agent travaille, affiché sur sa carte.'
    }
    readonly subagentCalls: {
      readonly label: 'Sous-agents reconnus'
      readonly bob: 'outil `spawn_subagent` (titre « Running subagent: … »), montré comme un sous-agent'
      readonly opencode: 'outil `subagent` (2), `task` (1.19), montré comme un sous-agent'
    }
    readonly testedVersions: {
      readonly label: 'Versions vérifiées'
      readonly detail: '{{versions}} ; une version plus récente ou plus ancienne est signalée une fois dans la conversation, toute autre dans le Diagnostic.'
    }
    readonly subagentReplay: {
      readonly label: 'Travail des sous-agents'
      readonly detail: '{{agent}} garde la session de chaque sous-agent : « Voir son travail » la rejoue à part (`session/load`), sans appel au modèle.'
    }
    readonly subagentLive: {
      readonly label: 'Travail des sous-agents en direct'
      readonly detail: '{{agent}} relaie le travail de ses sous-agents dans le flux de la conversation (`_meta["opencode/child-session"]`, depuis OpenCode 2) : l’app le range sous la carte du sous-agent, au lieu de le mêler au fil.'
    }
    readonly subagentBackground: {
      readonly label: 'Sous-agents en arrière-plan suivis jusqu’à leur fin'
      readonly detail: 'Quand {{agent}} lance un sous-agent en arrière-plan, son outil rend la main tout de suite (`metadata.status: "running"`) : l’app le garde « en cours », relit sa session de temps en temps, et le dit fini avec sa réponse quand elle se termine.'
    }
    readonly executeErrors: {
      readonly label: 'Erreurs des outils appelés par du code'
      readonly detail: 'Quand {{agent}} appelle des outils par son outil `execute`, il dit la carte finie même si l’un d’eux a échoué ; l’app lit l’erreur qu’il note à part (`rawOutput.metadata.toolCalls`) et met la carte en échec.'
    }
    readonly agentLog: {
      readonly label: 'Journal de l’agent'
      readonly detail: '{{agent}} écrit son propre journal dans `{{path}}` (un fichier par lancement). Avec Réglages › Diagnostic › Journal sur Trace, il le tient au plus détaillé.'
    }
    readonly startMode: {
      readonly label: 'Mode de départ à l’ouverture'
      readonly detail: 'Une nouvelle conversation demande son mode de départ (Plan…) dès l’ouverture de la session, dans `{{key}}` : {{agent}} commence directement dans ce mode, sans changement de mode juste après.'
    }
    readonly replayDiffs: {
      readonly label: 'Modifications retrouvées à la reprise'
      readonly detail: 'Quand {{agent}} rouvre une conversation, il ne joint plus le diff d’une modification si le fichier a changé depuis : l’app le refait depuis le patch que l’outil a gardé (`rawOutput.metadata.files`), pour que l’onglet Modifications reste complet.'
    }
    readonly childModel: {
      readonly label: 'Modèle des conversations filles'
      readonly detail: 'La conversation mère peut suggérer un modèle de {{agent}} pour une fille, avec sa raison ; vous le confirmez ou le changez avant le lancement.'
    }
    readonly hiddenEmptySessions: {
      readonly label: 'Sessions vides masquées'
      readonly detail: '« Reprendre une session… » ne montre pas les sessions jamais écrites, que {{agent}} garde sous un titre par défaut.'
    }
    readonly alwaysScope: {
      readonly label: 'Portée de « Toujours »'
      readonly detail: 'Sur une carte d’autorisation, « Toujours dans cette conversation » dit que {{agent}} retient le choix jusqu’à la fin de la conversation (une commande et chacune de ses parties, toutes les modifications de fichiers). Sans cette déclaration, la carte dit seulement que l’agent décide.'
    }
    readonly compactCommand: {
      readonly label: 'Compaction'
      readonly detail: '`{{command}}` figure dans la liste « / » même si l’agent ne l’annonce pas ; `/compact` y mène aussi.'
    }
    readonly rulesFiles: {
      readonly label: 'Règles actives listées'
      readonly bob: '`AGENTS.md` du dossier, `.bob/rules/` et `.bob/rules-<mode>/` du dossier et de `~/.bob` (greffons compris), comme les lit Bob.'
      readonly opencode: '`~/.config/opencode/AGENTS.md`, les `AGENTS.md` du dossier jusqu’au dossier personnel (hors de celui-ci : jusqu’à la racine du dépôt) et la clé `instructions`, comme les lit OpenCode 2 ; avec OpenCode 1, jusqu’à la racine du dépôt, avec repli sur `CLAUDE.md`.'
    }
    readonly approvalRules: {
      readonly label: 'Règles d’approbation de Bob IDE et Bob Shell'
      readonly bob: '`~/.bob/settings/settings.json` (section `approval`) : commandes autorisées et refusées partout, groupes approuvés pour toutes les tâches, accès hors du dossier. Lues et écrites comme Bob IDE, seulement quand vous le demandez ; elles valent dans Bob IDE et Bob Shell, et à la conversation suivante.'
    }
    readonly mcpFiles: {
      readonly label: 'Serveurs MCP modifiables dans les Réglages'
      readonly bob: '`.bob/mcp.json` du dossier, `~/.bob/settings/mcp.json` pour tous les dossiers'
      readonly opencode: '`opencode.json` du projet, `~/.config/opencode/opencode.json` pour tous les dossiers (formats d’OpenCode 1 et 2)'
      readonly detail: 'Dans les fichiers de l’agent : {{files}}.'
    }
    readonly apiKey: {
      readonly label: 'Clé d’API à la place de la connexion'
      readonly detail: '`{{env}}`, chiffrée dans le trousseau macOS.'
    }
    readonly terminalLogin: { readonly label: 'Connexion dans le terminal de l’app' }
    readonly authMethodLabels: {
      readonly label: 'Méthodes de connexion traduites'
      readonly detail: '{{agent}} nomme ses méthodes de connexion en anglais ; Bobine les libelle dans sa langue ({{methods}}).'
    }
    readonly license: {
      readonly label: 'Licence à accepter'
      readonly inTerminal: 'À lire dans le terminal de l’app (`{{command}}`) ; l’app ne l’accepte jamais à votre place.'
      readonly detail: 'l’app ne l’accepte jamais à votre place.'
    }
    readonly folderTrust: {
      readonly label: 'Confiance du dossier'
      readonly remembered: 'Proposée quand {{agent}} refuse un dossier (`{{flag}}`) ; {{agent}} la retient pour ce dossier.'
      readonly session: 'Proposée quand {{agent}} refuse un dossier (`{{flag}}`) ; valable pour la session.'
    }
    readonly modelProviders: {
      readonly label: 'Fournisseurs de modèles modifiables dans les Réglages'
      readonly detail: 'Points d’accès compatibles OpenAI (modèles internes) dans `~/.config/opencode/opencode.json` ; clé chiffrée dans le trousseau, posée au lancement.'
    }
    readonly ignoreFiles: {
      readonly label: 'Fichiers d’exclusion respectés'
      readonly bob: '`.bobignore` et `.gitignore` de chaque dossier, et `.env`, comme les lit Bob : ces fichiers ne sont pas proposés aux mentions `@`, `@git-changes` les saute, et les joindre demande confirmation.'
    }
    readonly additionalDirectories: {
      readonly label: 'Autres dossiers dans une conversation'
      readonly yes: 'Les dossiers ajoutés dans l’onglet Session lui sont donnés avec le dossier de travail (`additionalDirectories`).'
      readonly no: 'L’agent ne voit que le dossier de travail : rien à ajouter dans l’onglet Session.'
    }
    readonly roleExport: {
      readonly label: 'Rôles installés dans l’agent'
      readonly bob: '« Installer dans… » d’un rôle l’écrit comme mode personnalisé de Bob, dans `~/.bob/settings/custom_modes.yaml` (partagé avec Bob IDE) ou `.bob/custom_modes.yaml` du projet ; seul ce mode est ajouté, le reste du fichier est gardé, copié avant d’écrire.'
      readonly opencode: '« Installer dans… » d’un rôle l’écrit comme agent d’OpenCode, dans `~/.config/opencode/agents/` ou `.opencode/agents/` du projet (un fichier par agent, copié avant d’être remplacé).'
    }
    readonly writesWithoutAsking: {
      readonly label: 'Écrit sans demander'
      readonly detail: '{{agent}} modifie les fichiers sans demander d’autorisation (réglage par défaut) : la lecture seule d’un rôle n’y est que demandée, même dans un mode natif ; Bobine signale tout changement du dossier.'
    }
  }
  readonly permissionOption: {
    readonly allow_once: 'Autoriser une fois'
    readonly allow_always: 'Toujours autoriser'
    readonly reject_once: 'Refuser'
    readonly reject_always: 'Toujours refuser'
  }
  readonly approvals: {
    readonly alwaysInProject: 'Toujours dans ce projet'
    readonly alwaysInProjectDescription: 'Sans redemander dans ce dossier ; révocable dans Réglages › Confidentialité.'
    readonly refuse: 'Refuser'
    readonly site: {
      readonly allow: 'Autoriser'
      readonly always: 'Toujours autoriser'
      readonly question: 'L’agent veut ouvrir {{site}} dans le navigateur intégré. L’autoriser ?'
      readonly header: 'Site web'
      readonly allowDescription: 'Pour cette conversation : l’agent pourra lire et utiliser {{site}}.'
      readonly alwaysDescription: 'Retenu sur ce Mac ; révocable dans Réglages › Confidentialité.'
    }
    readonly terminal: {
      readonly question: 'L’agent veut lancer dans le terminal : {{command}}'
      readonly header: 'Terminal'
      readonly allow: 'Lancer'
      readonly allowDescription: 'La commande s’exécute dans un onglet du terminal, visible ici.'
    }
    readonly android: {
      readonly question: 'L’agent veut compiler l’app Android ({{where}}) : {{command}}'
      readonly header: 'Compiler pour Android'
      readonly allow: 'Compiler'
      readonly allowDescription: 'Lance Gradle (scripts de compilation du projet compris).'
    }
    readonly ios: {
      readonly question: 'L’agent veut compiler l’app iOS dans {{folder}} : {{command}}'
      readonly header: 'Compiler pour iOS'
      readonly allow: 'Compiler'
      readonly allowDescription: 'Lance xcodebuild (scripts de compilation du projet compris).'
    }
    readonly preview: {
      readonly question: 'L’agent veut lancer « {{name}} » dans {{folder}} : {{command}}'
      readonly header: 'Lancer l’app'
      readonly allow: 'Lancer'
      readonly allowDescription: 'Démarre la commande ; arrêtée avec l’app.'
      readonly allowDescriptionPort: 'Démarre la commande (port {{port}}) ; arrêtée avec l’app.'
    }
  }
  readonly profiles: {
    readonly mock: {
      readonly label: 'Agent factice'
      readonly apiKey: 'Clé d’API factice'
      readonly welcomeHint: 'Agent factice : tapez `/scenario` pour voir les scénarios.'
      readonly destination: 'cet ordinateur (agent factice, aucun réseau)'
    }
    readonly bob: {
      readonly apiKey: 'Clé d’API Bob Shell'
      readonly apiKeyHelp: 'Générée depuis votre compte Bob. Clé personnelle : une clé « générale » demande un identifiant d’équipe, que Bob ne prend pas en ACP.'
      readonly installHint: 'Installez Bob Shell (commande `bob`).'
      readonly destination: 'le service en ligne d’IBM Bob, facturé en Bobcoins'
    }
    readonly step: {
      readonly login: 'Se connecter dans le terminal'
      readonly license: 'Lire la licence'
    }
    readonly authMethod: { readonly sso: 'Se connecter par SSO' }
    readonly commandMissing: 'Commande « {{command}} » introuvable.'
    readonly opencode: { readonly installHint: 'Installez OpenCode (commande `opencode`).' }
    readonly mockPeer: { readonly label: 'Agent factice B' }
  }
  readonly mcpProbe: {
    readonly timeout: 'Pas de réponse à temps.'
    readonly noCommand: 'Aucune commande à lancer.'
    readonly exited: 'Le serveur s’est arrêté ({{status}}).'
    readonly closed: 'Fermé.'
    readonly noAnswer: '{{step}} : pas de réponse.'
  }
  readonly axe: {
    readonly missingHint: 'Touchers et vidéo indisponibles : AXe n’est pas installé. {{hint}}'
    readonly missing: 'Touchers et vidéo indisponibles : AXe n’est pas installé (github.com/cameroncooke/AXe).'
    readonly tooOld: 'Touchers et vidéo indisponibles : AXe {{version}} est trop ancien, version {{minimum}} au moins (github.com/cameroncooke/AXe).'
    readonly silent: 'Touchers et vidéo indisponibles : AXe ne répond pas à « --version »{{detail}}.'
  }
  readonly requests: {
    readonly unknownPermission: 'Demande de permission inconnue ou déjà traitée'
    readonly unknownOption: 'Option non proposée par l’agent : {{option}}'
    readonly unknownElicitation: 'Demande d’information inconnue ou déjà traitée'
    readonly badLink: 'Lien refusé : seuls les liens https sont ouverts'
  }
  readonly worktrees: {
    readonly gitFailed: 'git {{command}} a échoué'
    readonly notRepo: 'Ce dossier n’est pas dans un dépôt git.'
    readonly noCommit: 'Le dépôt n’a pas encore de commit : un worktree part d’un commit.'
    readonly outside: 'Worktree hors de {{root}} : {{path}}'
    readonly notice: {
      readonly start: 'Worktree créé depuis {{branch}} au commit {{hash}} ({{date}}) : « {{subject}} ».'
      readonly startDetached: 'Worktree créé depuis le commit {{hash}} ({{date}}) : « {{subject}} ».'
      readonly dirty_one: '{{count}} modification non commitée du dossier d’origine n’est pas dans ce worktree.'
      readonly dirty_other: '{{count}} modifications non commitées du dossier d’origine ne sont pas dans ce worktree.'
      readonly dirty_many: '{{count}} modifications non commitées du dossier d’origine ne sont pas dans ce worktree.'
    }
    readonly start: {
      readonly from: 'Parti de <code>{{branch}}</code> · <code>{{hash}}</code>'
      readonly fromDetached: 'Parti du commit <code>{{hash}}</code>'
      readonly subject: '« {{subject}} »'
      readonly gitView: 'Vue Git'
      readonly gitViewTitle: 'Ouvrir l’onglet Modifications en vue Git'
      readonly dirty_one: '{{count}} modification non commitée du dossier d’origine n’est pas ici.'
      readonly dirty_many: '{{count}} modifications non commitées du dossier d’origine ne sont pas ici.'
      readonly dirty_other: '{{count}} modifications non commitées du dossier d’origine ne sont pas ici.'
    }
    readonly folderGone: 'Le dossier « {{folder}} » n’existe plus : impossible d’y créer un worktree. Choisissez un autre dossier.'
  }
  readonly sessionList: {
    readonly exited: 'L’agent s’est arrêté ({{status}}).'
    readonly cannotList: '{{agent}} ne sait pas lister ses sessions.'
    readonly noSessions: 'L’agent n’a pas donné ses sessions'
    readonly cannotDelete: '{{agent}} ne sait pas supprimer ses sessions.'
    readonly deleteTimeout: 'L’agent n’a pas confirmé la suppression'
  }
  readonly apiKeys: {
    readonly empty: 'Clé vide.'
    readonly invalid: 'Clé invalide.'
    readonly noKeychain: 'Le trousseau macOS n’est pas disponible : la clé ne peut pas être enregistrée.'
    readonly keychainTimeout: 'Le trousseau macOS n’a pas répondu en {{seconds}} s : la clé n’est pas enregistrée. Autorisez Bobine dans la fenêtre du trousseau, puis réessayez.'
  }
  readonly process: {
    readonly commandMissing: 'Commande introuvable : {{command}}. Est-elle installée et dans le PATH ?'
    readonly notExecutable: 'Commande non exécutable : {{command}}'
    readonly timeout: '{{what}} en {{seconds}} s.'
  }
  readonly subagentWork: {
    readonly timeout: 'L’agent n’a pas rouvert la session à temps.'
    readonly notReopened: 'L’agent n’a pas rouvert la session.'
    readonly empty: 'L’agent n’a rien rejoué de cette session.'
  }
  readonly git: {
    readonly missing: 'git est introuvable sur ce Mac. Installez les outils de développement d’Apple : dans le Terminal, tapez `xcode-select --install`. Déjà installé ? Réglages › Diagnostic › Relire le PATH.'
    readonly failed: 'git a échoué'
    readonly statusFailed: 'git status a échoué'
  }
  readonly mcpFiles: {
    readonly invalidJson: '{{file}} : JSON invalide{{where}} — corrigez-le à la main, l’app n’y touche pas.'
    readonly exists: 'Un serveur « {{name}} » existe déjà.'
  }
  readonly queue: { readonly tooMany: 'Au plus {{max}} messages en attente' }
  readonly diffNotes: {
    readonly count_one: '{{count}} remarque'
    readonly count_other: '{{count}} remarques'
    readonly count_many: '{{count}} remarques'
    readonly send: 'Envoyer à l’agent'
    readonly clear: 'Effacer les remarques'
    readonly comment: 'Commenter la ligne {{line}}'
    readonly line: 'Ligne {{line}}'
    readonly lines: 'Lignes {{from}} à {{to}}'
    readonly placeholder: 'Votre remarque… (⌘↩ pour ajouter)'
    readonly add: 'Ajouter'
    readonly update: 'Enregistrer'
    readonly cancel: 'Annuler'
    readonly edit: 'Modifier la remarque'
    readonly delete: 'Supprimer la remarque'
  }
  readonly find: {
    readonly placeholder: 'Rechercher dans la conversation'
    readonly count: '{{current}} / {{total}}'
    readonly none: 'Aucun résultat'
    readonly previous: 'Précédent (⇧⌘G)'
    readonly next: 'Suivant (⌘G)'
    readonly close: 'Fermer (Échap)'
  }
  readonly quota: {
    readonly label: 'Quota de {{agent}}'
    readonly short: '{{percent}} % du quota'
    readonly usedShort: '{{used}} ce mois-ci'
    readonly withStatus: '{{status}} · {{quota}}'
    readonly title: 'Quota · {{agent}}'
    readonly month: 'Quota du mois'
    readonly value: '{{used}} / {{limit}}'
    readonly amount: '{{amount}} {{currency}}'
    readonly limit: 'Plafond'
    readonly unlimited: 'Illimité'
    readonly left: 'Reste'
    readonly over: 'Dépassé de'
    readonly source: 'Selon le serveur de {{agent}}, toutes machines confondues · lu à {{time}}'
    readonly refresh: 'Actualiser'
    readonly reading: 'Lecture…'
  }
  readonly children: {
    readonly recommendation: {
      readonly ready: 'Recommandée'
      readonly notReady: 'Pas encore prête'
      readonly stale: 'À revoir'
      readonly staleHint: 'La fille a refait un tour depuis cette recommandation.'
      readonly itemReady: 'La mère recommande de fusionner « {{title}} »'
      readonly itemNotReady: 'La mère ne recommande pas encore de fusionner « {{title}} »'
    }
    readonly preparing: 'Création du worktree…'
    readonly openState: 'Ouvrir « {{title}} » : {{state}}'
    readonly instructionFor: 'Consigne pour « {{title}} »'
    readonly dialog: {
      readonly title: 'Lancer en parallèle'
      readonly description: 'Une conversation fille travaille de son côté, dans son propre worktree, sur une nouvelle branche. À chaque fin de tour, elle rend compte à « {{title}} ».'
      readonly prompt: 'Consigne'
      readonly placeholder: 'Ce que la conversation fille doit faire…'
      readonly agent: 'Agent'
      readonly model: 'Modèle'
      readonly modelOther: 'Le dernier modèle choisi avec cet agent.'
      readonly modelAgent: 'L’agent choisit son modèle.'
      readonly launch: 'Lancer'
      readonly launching: 'Lancement…'
    }
    readonly notRepo: 'Le dossier de cette conversation n’est pas dans un dépôt git : une conversation fille travaille dans un worktree.'
    readonly started: 'Conversation fille lancée : « {{title}} »'
    readonly card: {
      readonly title: 'Sous-tâches'
      readonly running_one: '{{count}} en cours'
      readonly running_many: '{{count}} en cours'
      readonly running_other: '{{count}} en cours'
      readonly waiting_one: '{{count}} attend un accord'
      readonly waiting_many: '{{count}} attendent un accord'
      readonly waiting_other: '{{count}} attendent un accord'
      readonly done_one: '{{count}} terminée'
      readonly done_many: '{{count}} terminées'
      readonly done_other: '{{count}} terminées'
      readonly error_one: '{{count}} en erreur'
      readonly error_many: '{{count}} en erreur'
      readonly error_other: '{{count}} en erreur'
    }
    readonly cost: {
      readonly tokens: '{{tokens}} jetons'
      readonly title: 'Consommation de cette conversation fille'
      readonly total: 'Coût total des conversations filles de cette carte'
    }
    readonly state: {
      readonly running: 'En cours'
      readonly waiting: 'Attend un accord'
      readonly unread: 'Finie, à lire'
      readonly error: 'Erreur'
      readonly done: 'Finie'
    }
    readonly open: 'Ouvrir'
    readonly files_one: '{{count}} fichier'
    readonly files_many: '{{count}} fichiers'
    readonly files_other: '{{count}} fichiers'
    readonly report: {
      readonly done: '« {{title}} » a fini son tour'
      readonly stopped: '« {{title}} » a été arrêtée'
      readonly error: '« {{title}} » s’est arrêtée sur une erreur'
      readonly noFiles: 'rien modifié'
      readonly expand: 'Afficher le détail'
      readonly collapse: 'Masquer le détail'
      readonly pending: 'Partira à l’agent avec votre prochain message.'
      readonly gone: 'Conversation supprimée'
      readonly pendingWake: 'Partira à l’agent quand ses conversations filles auront toutes fini.'
      readonly turns_one: '{{count}} échange'
      readonly turns_many: '{{count}} échanges'
      readonly turns_other: '{{count}} échanges'
      readonly usage: 'Consommation de la conversation fille à ce compte rendu'
    }
    readonly error: {
      readonly emptyPrompt: 'Écrivez une consigne pour la conversation fille.'
      readonly draft: 'Écrivez d’abord dans cette conversation : une conversation fille se rattache à une conversation de l’historique.'
      readonly modelNotAllowed: 'Cet agent ne permet pas de choisir le modèle d’une conversation fille : elle prend le sien.'
      readonly oneLevel: 'Une conversation fille ne lance pas de conversation fille : il n’y a qu’un niveau.'
      readonly archived: 'Désarchivez d’abord cette conversation.'
      readonly needsAction: 'Son agent attend une action de votre part (connexion, dossier à approuver) : ouvrez la conversation fille.'
      readonly agentFailed: 'Son agent n’a pas démarré : {{detail}}'
      readonly noStartChild: 'Pas de conversation fille possible ici : il faut un dossier dans un dépôt git, une conversation qui n’est pas elle-même une fille, et la famille d’outils « Conversations filles » active (Réglages › Serveurs MCP).'
    }
    readonly notice: {
      readonly promptFailed: 'La consigne n’a pas pu partir ({{error}}). La voici, à renvoyer : {{prompt}}'
      readonly messageFailed: 'Le message d’une autre conversation n’a pas pu partir ({{error}}).'
    }
    readonly startedByAgent: 'L’agent a lancé la conversation fille « {{title}} »'
    readonly limit_one: '{{count}} conversation fille est déjà en cours : c’est le plafond réglé dans Réglages › Conversations.'
    readonly limit_many: '{{count}} conversations filles sont déjà en cours : c’est le plafond réglé dans Réglages › Conversations.'
    readonly limit_other: '{{count}} conversations filles sont déjà en cours : c’est le plafond réglé dans Réglages › Conversations.'
    readonly proposals: {
      readonly title_one: '{{count}} tâche proposée'
      readonly title_many: '{{count}} tâches proposées'
      readonly title_other: '{{count}} tâches proposées'
      readonly worktree: 'L’agent propose de confier ce travail à des conversations filles, chacune dans son propre worktree. Vous pouvez aussi lui demander de le faire ici.'
      readonly started_one: '{{count}} lancée'
      readonly started_many: '{{count}} lancées'
      readonly started_other: '{{count}} lancées'
      readonly here_one: '{{count}} faite ici'
      readonly here_many: '{{count}} faites ici'
      readonly here_other: '{{count}} faites ici'
      readonly refused_one: '{{count}} refusée'
      readonly refused_many: '{{count}} refusées'
      readonly refused_other: '{{count}} refusées'
      readonly expired_one: '{{count}} expirée'
      readonly expired_many: '{{count}} expirées'
      readonly expired_other: '{{count}} expirées'
      readonly pending_one: '{{count}} en attente'
      readonly pending_many: '{{count}} en attente'
      readonly pending_other: '{{count}} en attente'
      readonly start: 'Lancer'
      readonly here: 'Faire ici'
      readonly refuse: 'Refuser'
      readonly options: 'Agent et modèle'
      readonly hint: '↑ ↓ pour choisir une ligne, Entrée pour la lancer'
      readonly expiredHint: 'L’agent a redémarré entre-temps : « Lancer » ouvre la conversation fille comme « Lancer en parallèle… », sans réveil de l’agent.'
      readonly loadingChoice: 'Lecture de la suggestion de la mère…'
      readonly proposed: 'Suggéré par la mère, à confirmer : {{choice}}'
      readonly state: {
        readonly start: 'Lancée'
        readonly here: 'Faite ici'
        readonly refuse: 'Refusée'
        readonly expired: 'Expirée'
      }
    }
    readonly from: {
      readonly parent: 'De la conversation mère « {{title}} »'
      readonly child: 'De la conversation fille « {{title}} »'
      readonly wake: 'Les conversations filles ont toutes fini : l’agent reprend avec leurs comptes rendus.'
    }
  }
  readonly providers: {
    readonly check: {
      readonly id: 'Identifiant du fournisseur : lettres minuscules, chiffres, « - » ou « _ » (ex. llmaas).'
      readonly url: 'Adresse de base invalide : elle commence par http:// ou https:// (ex. https://llm.interne/v1).'
      readonly model: 'Identifiant de modèle invalide : « {{id}} ».'
      readonly noModel: 'Au moins un modèle, un par ligne : identifiant = libellé.'
    }
    readonly exists: 'Un fournisseur « {{id}} » existe déjà.'
    readonly unknown: 'Fournisseur introuvable : {{id}}.'
    readonly noAgent: 'Pas de fournisseurs de modèles modifiables pour l’agent « {{agent}} ».'
    readonly fix: {
      readonly refused: 'Rien n’écoute à cette adresse : vérifiez l’adresse et le port, ou si le service a besoin du proxy (Réseau d’entreprise ci-dessous).'
      readonly dns: 'Le nom d’hôte n’existe pas d’ici : vérifiez l’adresse, le VPN, ou renseignez le proxy de l’entreprise (Réseau d’entreprise ci-dessous).'
      readonly timeout: 'Pas de réponse : service arrêté, pare-feu, ou proxy manquant (Réseau d’entreprise ci-dessous).'
      readonly proxy: 'Le proxy n’a pas laissé passer : vérifiez son adresse, ses identifiants (http://utilisateur:mot@proxy:port), ou ajoutez l’hôte à « Sans proxy ».'
      readonly certificate: 'Le certificat du service n’est pas reconnu : renseignez le fichier des certificats de l’entreprise (PEM) dans Réseau d’entreprise ci-dessous.'
      readonly unauthorized: 'Le service refuse la clé : définissez-la ou remplacez-la pour ce fournisseur.'
      readonly 'not-found': 'L’adresse de base doit être celle de l’API, /v1 compris, sans /chat/completions.'
      readonly http: 'Le service ne répond pas comme un point d’accès compatible OpenAI : vérifiez l’adresse de base.'
      readonly other: 'Vérifiez l’adresse, le proxy et les certificats (Réseau d’entreprise ci-dessous).'
    }
  }
  readonly providerProbe: {
    readonly badUrl: 'Adresse invalide : {{url}}'
    readonly badProxy: 'Adresse du proxy invalide : {{proxy}}'
    readonly caCertsUnreadable: 'Fichier de certificats illisible : {{file}} ({{detail}})'
    readonly proxyAuth: 'Le proxy {{proxy}} demande des identifiants (407).'
    readonly proxyRefused: 'Le proxy {{proxy}} refuse la connexion ({{status}}).'
    readonly proxyUnreachable: 'Proxy {{proxy}} injoignable : {{detail}}'
    readonly unauthorized: 'Clé refusée (HTTP {{status}}).'
    readonly notFound: '{{url}} introuvable (404) : l’adresse de base finit-elle par /v1 ?'
    readonly http: 'Réponse inattendue : HTTP {{status}}.'
    readonly notJson: 'Réponse qui n’est pas du JSON : est-ce bien un point d’accès compatible OpenAI ?'
    readonly notModels: 'Réponse sans liste de modèles (data[]) : est-ce bien un point d’accès compatible OpenAI ?'
    readonly timeout: 'Pas de réponse en 10 s.'
    readonly refused: 'Connexion refusée : {{detail}}'
    readonly dns: 'Nom d’hôte inconnu : {{detail}}'
    readonly certificate: 'Certificat non reconnu : {{detail}}'
    readonly proxy: 'Proxy : {{detail}}'
    readonly other: '{{detail}}'
  }
  readonly worktreeCycle: {
    readonly error: {
      readonly emptyMessage: 'Le message de commit est vide.'
      readonly noFile: 'Aucun fichier coché.'
      readonly notLast: 'Ce commit n’est plus le dernier : rien n’a été défait.'
      readonly alreadyMerged: 'Ce commit est déjà dans la branche de base : rien n’a été défait.'
      readonly mainDirty: 'La branche de base n’a pas pu avancer dans le dépôt principal : {{detail}}'
      readonly baseElsewhere: 'La branche de base est extraite dans un autre worktree ({{path}}) : fusionnez-la de là.'
      readonly emptyTitle: 'Le titre de la PR est vide.'
      readonly noWorktree: 'Cette conversation n’est pas dans un worktree.'
      readonly pushed: 'Ce commit est déjà poussé : il ne peut plus être défait ici.'
      readonly emptyTitle_mr: 'Le titre de la MR est vide.'
    }
    readonly pr: {
      readonly noGh: '« gh » (GitHub CLI) est introuvable : installez-le (brew install gh) pour ouvrir une PR depuis l’app.'
      readonly notLogged: '« gh » n’est pas connecté à GitHub : lancez « gh auth login » dans un terminal.'
      readonly noRemote: 'Le dépôt n’a pas de dépôt distant : rien où pousser la branche.'
      readonly nothing: 'Rien à pousser : aucun commit sur la branche.'
      readonly failed: 'gh pr create a échoué'
      readonly open: 'Ouvrir une PR'
      readonly title: 'Titre'
      readonly body: 'Description'
      readonly confirm: 'Pousser et ouvrir la PR'
      readonly working: 'Poussée de la branche et création de la PR…'
      readonly created: 'PR ouverte : <anchor>{{name}}</anchor>'
      readonly existed: 'Une PR existe déjà : <anchor>{{name}}</anchor>'
      readonly pushToPr: 'Pousser vers la PR'
      readonly noTool: 'L’outil de la forge est introuvable : installez-le pour ouvrir une demande de fusion depuis l’app.'
      readonly noTool_mr: '« glab » (GitLab CLI) est introuvable : installez-le (brew install glab) pour ouvrir une MR depuis l’app.'
      readonly notLogged_mr: '« glab » n’est pas connecté à {{host}} : lancez « glab auth login --hostname {{host}} » dans un terminal.'
      readonly unreachable: '{{host}} ne répond pas : vérifiez le réseau ou le VPN, puis Actualiser.'
      readonly unreachable_mr: '{{host}} ne répond pas : vérifiez le réseau ou le VPN de l’entreprise, puis Actualiser.'
      readonly certificate: 'Le certificat de {{host}} est refusé : installez le certificat de l’entreprise dans le trousseau, puis Actualiser.'
      readonly certificate_mr: '« glab » refuse le certificat de {{host}} : installez le certificat de l’entreprise dans le trousseau (ou « glab config set ca_cert <fichier> --host {{host}} »), puis Actualiser.'
      readonly unknownForge: 'Pas de PR depuis l’app : {{host}} n’est ni GitHub ni GitLab. Si c’est un GitLab : <code>glab auth login --hostname {{host}}</code>, puis Actualiser.'
      readonly failed_mr: 'glab mr create a échoué'
      readonly open_mr: 'Ouvrir une MR'
      readonly confirm_mr: 'Pousser et ouvrir la MR'
      readonly working_mr: 'Poussée de la branche et création de la MR…'
      readonly created_mr: 'MR ouverte : <anchor>{{name}}</anchor>'
      readonly existed_mr: 'Une MR existe déjà : <anchor>{{name}}</anchor>'
      readonly pushToPr_mr: 'Pousser vers la MR'
      readonly checking: 'Vérification de la forge du dépôt distant…'
      readonly unknownForge_nohost: 'Pas de PR depuis l’app : ce dépôt distant n’est ni GitHub ni GitLab. Si c’est un GitLab, connectez « glab » à son hôte, puis Actualiser.'
      readonly notFound: '« glab » ne trouve pas GitLab sur {{host}}. S’il est installé sous un sous-chemin (https://hôte/gitlab/…), déclarez-le : glab config set subfolder <chemin> --host {{host}}, puis Actualiser.'
      readonly notFound_mr: '« glab » ne trouve pas GitLab sur {{host}}. S’il est installé sous un sous-chemin (https://hôte/gitlab/…), déclarez-le : glab config set subfolder <chemin> --host {{host}}, puis Actualiser.'
    }
    readonly start: {
      readonly from: 'Départ : {{branch}} à {{hash}} · {{date}}'
      readonly fromDetached: 'Départ : commit {{hash}} · {{date}}'
      readonly subject: '« {{subject}} »'
      readonly dirty_one: '{{count}} modification non commitée du dossier d’origine n’est pas ici.'
      readonly dirty_other: '{{count}} modifications non commitées du dossier d’origine ne sont pas ici.'
      readonly dirty_many: '{{count}} modifications non commitées du dossier d’origine ne sont pas ici.'
    }
    readonly state: {
      readonly ahead_one: '{{count}} commit sur la branche'
      readonly ahead_other: '{{count}} commits sur la branche'
      readonly ahead_many: '{{count}} commits sur la branche'
      readonly behind_one: '{{count}} commit en retard sur {{base}}'
      readonly behind_other: '{{count}} commits en retard sur {{base}}'
      readonly behind_many: '{{count}} commits en retard sur {{base}}'
      readonly dirty_one: '{{count}} fichier à committer'
      readonly dirty_other: '{{count}} fichiers à committer'
      readonly dirty_many: '{{count}} fichiers à committer'
      readonly merged: 'Fusionné dans {{base}}.'
      readonly merging_one: 'Fusion arrêtée : {{count}} fichier en conflit.'
      readonly merging_other: 'Fusion arrêtée : {{count}} fichiers en conflit.'
      readonly merging_many: 'Fusion arrêtée : {{count}} fichiers en conflit.'
    }
    readonly commit: {
      readonly action: 'Committer'
      readonly actionCount: 'Committer ({{count}})'
      readonly message: 'Message du commit'
      readonly confirm: 'Committer'
      readonly cancel: 'Annuler'
      readonly select: 'Committer {{path}}'
      readonly done: 'Commit {{hash}} fait.'
      readonly undo: 'Défaire'
      readonly undone: 'Commit défait : ses modifications sont de nouveau à committer.'
    }
    readonly merge: {
      readonly action: 'Fusionner dans {{base}}'
      readonly working: 'Fusion en cours…'
      readonly dirty_one: 'Committez d’abord : {{count}} modification non commitée.'
      readonly dirty_other: 'Committez d’abord : {{count}} modifications non commitées.'
      readonly dirty_many: 'Committez d’abord : {{count}} modifications non commitées.'
      readonly nothing: 'Rien à fusionner : {{base}} a déjà tout.'
      readonly fastForward: 'Fusionné dans {{base}} (fast-forward).'
      readonly merge: 'Fusionné dans {{base}} (commit de fusion).'
      readonly conflicts_one: 'Conflit dans {{count}} fichier :'
      readonly conflicts_other: 'Conflits dans {{count}} fichiers :'
      readonly conflicts_many: 'Conflits dans {{count}} fichiers :'
      readonly resolve: 'Laisser l’agent résoudre'
      readonly resolving: 'L’agent résout les conflits…'
      readonly retry: 'Réessayer'
      readonly abort: 'Abandonner'
      readonly aborted: 'Fusion abandonnée : la branche est comme avant.'
    }
    readonly cleanup: {
      readonly action: 'Nettoyer'
      readonly ask: 'Archiver la conversation, puis supprimer le worktree et la branche <code>{{branch}}</code> ? Ressortie, la conversation continue dans le dossier principal.'
      readonly confirm: 'Nettoyer'
      readonly keep: 'Garder'
      readonly askRemote: 'Archiver la conversation, puis supprimer le worktree et la branche <code>{{branch}}</code>, ici et sur GitHub (la PR est fusionnée) ? Ressortie, la conversation continue dans le dossier principal.'
      readonly done: 'Worktree nettoyé.'
      readonly doneRemote: 'Worktree nettoyé ; branche <code>{{branch}}</code> supprimée aussi sur GitHub.'
      readonly remoteKept: 'Worktree nettoyé. La branche <code>{{branch}}</code> est gardée sur GitHub : elle a reçu des commits après la fusion.'
      readonly remoteFailed: 'La branche <code>{{branch}}</code> n’a pas pu être supprimée sur GitHub : {{message}} Supprimez-la depuis la page de la PR.'
      readonly dismiss: 'Masquer'
    }
    readonly mainDirty: {
      readonly title_one: 'Fusion refusée : le dossier principal a une modification non commitée.'
      readonly title_other: 'Fusion refusée : le dossier principal a {{count}} modifications non commitées.'
      readonly title_many: 'Fusion refusée : le dossier principal a {{count}} modifications non commitées.'
      readonly why_one: 'La fusion dans {{base}} pourrait l’écraser. Committez-la d’abord, ou mettez-la de côté : elle reviendra après la fusion.'
      readonly why_other: 'La fusion dans {{base}} pourrait les écraser. Committez-les d’abord, ou mettez-les de côté : elles reviendront après la fusion.'
      readonly why_many: 'La fusion dans {{base}} pourrait les écraser. Committez-les d’abord, ou mettez-les de côté : elles reviendront après la fusion.'
      readonly more_one: '… et {{count}} autre'
      readonly more_other: '… et {{count}} autres'
      readonly more_many: '… et {{count}} autres'
      readonly files: 'Fichiers non commités du dossier principal'
      readonly commit: 'Committer d’abord'
      readonly commitConfirm: 'Committer puis fusionner'
      readonly stash: 'Mettre de côté'
      readonly stashHint: 'git stash le temps de la fusion, puis remis'
      readonly stashRestored_one: 'Votre modification mise de côté est revenue.'
      readonly stashRestored_other: 'Vos {{count}} modifications mises de côté sont revenues.'
      readonly stashRestored_many: 'Vos {{count}} modifications mises de côté sont revenues.'
      readonly stashFailed: 'Vos modifications mises de côté n’ont pas pu revenir sans conflit ({{files}}) : elles restent dans git stash ({{ref}}).'
      readonly stashKept: 'Vos modifications mises de côté n’ont pas pu revenir : elles restent dans git stash ({{ref}}).'
    }
    readonly mr: {
      readonly error: {
        readonly 'not-logged': '{{host}} refuse la connexion de « glab » : relancez « glab auth login --hostname {{host}} » dans un terminal (jeton expiré ou révoqué ?).'
        readonly unreachable: '{{host}} ne répond pas : vérifiez le réseau ou le VPN de l’entreprise, puis réessayez.'
        readonly certificate: 'Le certificat de {{host}} est refusé : installez le certificat de l’entreprise dans le trousseau, puis réessayez.'
        readonly denied: 'Vous n’avez pas le droit de pousser sur ce projet de {{host}} : demandez le rôle Developer, ou poussez sur votre fork.'
        readonly protected: '{{branch}} n’a pas pu être poussée : cette branche est protégée sur {{host}}. Demandez l’accès, ou changez les règles de protection, puis réessayez.'
        readonly 'ssh-key': '{{host}} refuse la clé SSH : vérifiez-la (« ssh -T git@{{host}} ») ou ajoutez-la à votre compte, puis réessayez.'
        readonly 'not-found': '{{host}} ne trouve pas ce projet. Si GitLab est installé sous un sous-chemin (https://hôte/gitlab/…), déclarez-le : « glab config set subfolder <chemin> --host {{host}} », puis réessayez.'
      }
    }
  }
  readonly childrenMerge: {
    readonly recommended: {
      readonly action_one: 'Fusionner la recommandée dans {{base}}'
      readonly action_other: 'Fusionner les {{count}} recommandées dans {{base}}'
      readonly action_many: 'Fusionner les {{count}} recommandées dans {{base}}'
      readonly others_one: 'Inclure l’autre…'
      readonly others_other: 'Inclure les {{count}} autres…'
      readonly others_many: 'Inclure les {{count}} autres…'
      readonly confirm_one: 'La mère ne recommande pas {{titles}}. Fusionner quand même ?'
      readonly confirm_other: 'La mère ne recommande pas {{titles}}. Fusionner quand même ?'
      readonly confirm_many: 'La mère ne recommande pas {{titles}}. Fusionner quand même ?'
      readonly confirmAction_one: 'Fusionner les {{count}} quand même'
      readonly confirmAction_other: 'Fusionner les {{count}} quand même'
      readonly confirmAction_many: 'Fusionner les {{count}} quand même'
      readonly cancel: 'Annuler'
      readonly only_one: 'La mère recommande {{titles}} ; l’autre attend son avis.'
      readonly only_other: 'La mère recommande {{titles}} ; les {{count}} autres attendent son avis.'
      readonly only_many: 'La mère recommande {{titles}} ; les {{count}} autres attendent son avis.'
      readonly none: 'La mère ne recommande encore aucune branche.'
    }
    readonly summary: {
      readonly all_one: 'La branche est finie.'
      readonly all_other: 'Les {{count}} branches sont finies.'
      readonly all_many: 'Les {{count}} branches sont finies.'
      readonly disjoint_one: 'La branche est finie.'
      readonly disjoint_other: 'Les {{count}} branches sont finies et ne touchent pas les mêmes fichiers.'
      readonly disjoint_many: 'Les {{count}} branches sont finies et ne touchent pas les mêmes fichiers.'
      readonly some_one: '{{count}} branche finie ; {{first}}.'
      readonly some_other: '{{count}} branches finies ; {{first}}.'
      readonly some_many: '{{count}} branches finies ; {{first}}.'
      readonly someTwo_one: '{{count}} branche finie ; {{first}}, {{second}}.'
      readonly someTwo_other: '{{count}} branches finies ; {{first}}, {{second}}.'
      readonly someTwo_many: '{{count}} branches finies ; {{first}}, {{second}}.'
      readonly working_one: '{{titles}} travaille encore'
      readonly working_other: '{{titles}} travaillent encore'
      readonly working_many: '{{titles}} travaillent encore'
      readonly waiting_one: '{{titles}} attend un accord'
      readonly waiting_other: '{{titles}} attendent un accord'
      readonly waiting_many: '{{titles}} attendent un accord'
      readonly overlap: 'Les branches {{titles}} touchent {{files}} toutes les deux : la seconde pourra entrer en conflit.'
      readonly dirty_one: '{{titles}} a des modifications non commitées : à committer depuis sa vue Git.'
      readonly dirty_other: '{{titles}} ont des modifications non commitées : à committer depuis leur vue Git.'
      readonly dirty_many: '{{titles}} ont des modifications non commitées : à committer depuis leur vue Git.'
      readonly baseElsewhere: 'La branche {{base}} est extraite dans un autre worktree ({{path}}) : fusionnez-la de là.'
    }
    readonly quote: '« {{title}} »'
    readonly action_one: 'Fusionner dans {{base}}'
    readonly action_other: 'Fusionner les {{count}} dans {{base}}'
    readonly action_many: 'Fusionner les {{count}} dans {{base}}'
    readonly cleanup: 'Puis nettoyer'
    readonly cleanupHint: 'Archiver chaque conversation fusionnée, puis supprimer son worktree et sa branche'
    readonly stop: 'Arrêter'
    readonly progress_one: 'Fusion dans {{base}}, l’une après l’autre : {{count}} sur {{total}} faite. Au premier conflit, la fille concernée le résout, puis la fusion reprend.'
    readonly progress_other: 'Fusion dans {{base}}, l’une après l’autre : {{count}} sur {{total}} faites. Au premier conflit, la fille concernée le résout, puis la fusion reprend.'
    readonly progress_many: 'Fusion dans {{base}}, l’une après l’autre : {{count}} sur {{total}} faites. Au premier conflit, la fille concernée le résout, puis la fusion reprend.'
    readonly stopping: 'Arrêt après la fusion en cours…'
    readonly result: {
      readonly done_one: '{{count}} fusionnée dans {{base}} en {{duration}}.'
      readonly done_other: '{{count}} fusionnées dans {{base}} en {{duration}}.'
      readonly done_many: '{{count}} fusionnées dans {{base}} en {{duration}}.'
      readonly upToDate_one: '{{count}} déjà à jour.'
      readonly upToDate_other: '{{count}} déjà à jour.'
      readonly upToDate_many: '{{count}} déjà à jour.'
      readonly cleaned_one: 'Conversation archivée, worktree et branche supprimés.'
      readonly cleaned_other: 'Conversations archivées, worktrees et branches supprimés.'
      readonly cleaned_many: 'Conversations archivées, worktrees et branches supprimés.'
      readonly stopped_one: 'Fusion arrêtée : {{count}} fusionnée dans {{base}}, les autres restent en attente.'
      readonly stopped_other: 'Fusion arrêtée : {{count}} fusionnées dans {{base}}, les autres restent en attente.'
      readonly stopped_many: 'Fusion arrêtée : {{count}} fusionnées dans {{base}}, les autres restent en attente.'
      readonly interrupted_one: 'Fusion interrompue par la fermeture de l’app : {{count}} fusionnée dans {{base}}.'
      readonly interrupted_other: 'Fusion interrompue par la fermeture de l’app : {{count}} fusionnées dans {{base}}.'
      readonly interrupted_many: 'Fusion interrompue par la fermeture de l’app : {{count}} fusionnées dans {{base}}.'
      readonly conflict: 'Fusion arrêtée sur {{title}} : il reste des conflits dans {{files}}.'
      readonly failed: 'Fusion arrêtée sur {{title}} : {{error}}'
    }
    readonly retry: 'Réessayer'
    readonly abort: 'Abandonner'
    readonly showConflict: 'Voir le conflit'
    readonly row: {
      readonly pending: 'en attente'
      readonly merging: 'fusion en cours'
      readonly resolving: 'l’agent résout le conflit'
      readonly merged: 'fusionnée'
      readonly upToDate: 'déjà à jour'
      readonly conflict: 'conflit'
      readonly dirty: 'non commitée'
      readonly failed: 'échec'
      readonly cleaned: 'nettoyée'
    }
    readonly duration: {
      readonly seconds: '{{count}} s'
      readonly minutes: '{{minutes}} min {{seconds}} s'
    }
    readonly error: {
      readonly running: 'Une fusion des conversations filles est déjà en cours ici.'
      readonly none: 'Aucune conversation fille à fusionner.'
      readonly gone: 'Une conversation fille a été supprimée, archivée ou n’est plus dans un worktree : relisez la carte « Sous-tâches ».'
      readonly prompt: 'la consigne de résolution n’a pas pu partir ({{error}})'
      readonly mainDirty_one: 'Le dossier principal a une modification non commitée ({{files}}) : committez-la ou mettez-la de côté avant de fusionner.'
      readonly mainDirty_other: 'Le dossier principal a {{count}} modifications non commitées ({{files}}) : committez-les ou mettez-les de côté avant de fusionner.'
      readonly mainDirty_many: 'Le dossier principal a {{count}} modifications non commitées ({{files}}) : committez-les ou mettez-les de côté avant de fusionner.'
    }
    readonly stashKept_one: 'Votre modification est mise de côté le temps de la fusion.'
    readonly stashKept_other: 'Vos {{count}} modifications sont mises de côté le temps de la fusion.'
    readonly stashKept_many: 'Vos {{count}} modifications sont mises de côté le temps de la fusion.'
  }
  readonly handover: {
    readonly error: {
      readonly agent: 'Cet agent n’est pas disponible pour continuer la conversation.'
      readonly busy: 'Attendez la fin de la réponse, ou arrêtez-la, avant de changer d’agent.'
    }
    readonly notice: {
      readonly modelMissing: '{{agent}} ne propose pas le modèle « {{model}} » : il répond avec son modèle par défaut.'
    }
    readonly menu: {
      readonly continue: 'Continuer avec'
      readonly newConversation: 'Nouvelle conversation avec'
      readonly otherModel: '{{agent}} — autre modèle…'
      readonly choose: '{{agent}}…'
      readonly recent: 'récent'
      readonly recentWith: 'récent · {{provider}}'
    }
    readonly dialog: {
      readonly title: 'Continuer avec {{agent}}'
      readonly description: 'La conversation reste la même : une nouvelle session s’ouvre chez {{agent}}, le fil reste affiché.'
      readonly model: 'Modèle'
      readonly defaultModel: 'Modèle par défaut de {{agent}}'
      readonly whereTitle: 'Vos messages partiront à'
      readonly agent: 'Agent'
      readonly provider: 'Fournisseur'
      readonly address: 'Adresse'
      readonly service: 'Service'
      readonly prefix: '« {{provider}} », configuré dans {{agent}}'
      readonly unknownModel: 'celui que {{agent}} choisit'
      readonly sent_one: 'L’échange jusqu’ici ({{count}} message) partira en texte avec votre prochain message, pas avant. Les résultats complets des outils ne sont pas transmis : seulement leur titre et les fichiers touchés.'
      readonly sent_many: 'L’échange jusqu’ici ({{count}} messages) partira en texte avec votre prochain message, pas avant. Les résultats complets des outils ne sont pas transmis : seulement leur titre et les fichiers touchés.'
      readonly sent_other: 'L’échange jusqu’ici ({{count}} messages) partira en texte avec votre prochain message, pas avant. Les résultats complets des outils ne sont pas transmis : seulement leur titre et les fichiers touchés.'
      readonly stops: '{{agent}} ne recevra plus rien de cette conversation ; sa session reste chez lui.'
      readonly confirm: 'Continuer avec {{agent}}'
      readonly switching: 'Démarrage de {{agent}}…'
    }
    readonly thread: {
      readonly title: 'Suite avec {{agent}}'
      readonly detail: 'Avant : {{from}}. L’échange précédent lui est transmis en texte avec le premier message.'
      readonly renewTitle: 'Nouvelle session avec {{agent}}'
      readonly renewDetailNoResume: '{{agent}} ne sait pas reprendre sa session précédente. L’échange précédent lui est transmis en texte avec le premier message.'
      readonly renewDetailLost: '{{agent}} a perdu sa session précédente. L’échange précédent lui est transmis en texte avec le premier message.'
      readonly renewDetailTurnLimit: '{{agent}} refusait de continuer dans sa session précédente, dont la limite d’étapes était atteinte. L’échange précédent lui est transmis en texte avec votre message.'
    }
  }
  readonly aboutWindow: {
    readonly version: 'Version {{version}} · {{date}}'
    readonly whatsNew: 'Nouveautés'
    readonly github: 'GitHub'
    readonly license: 'Licence Apache 2.0'
    readonly copyInfo: 'Copier les infos techniques'
    readonly copyInfoHint: 'Version, commit, Electron, macOS et agents installés, pour un signalement'
    readonly copied: 'Copié'
    readonly reportIssueHint: 'Ouvre dans le navigateur une issue GitHub préremplie avec la version et les infos techniques'
    readonly notAffiliated: 'Projet indépendant, non affilié à IBM.'
  }
  readonly inbox: {
    readonly title: 'À traiter'
    readonly count_one: '{{count}} conversation à traiter'
    readonly count_many: '{{count}} conversations à traiter'
    readonly count_other: '{{count}} conversations à traiter'
    readonly reason: {
      readonly permission: 'Autorisation : {{detail}}'
      readonly question: 'Question : {{detail}}'
      readonly permissionPlain: 'Autorisation'
      readonly questionPlain: 'Question'
      readonly authPlain: 'Connexion à faire'
      readonly trustPlain: 'Dossier à approuver'
      readonly savePlain: '« Enregistrer sous » en attente'
      readonly pageDialogPlain: 'Boîte d’une page en attente'
      readonly requestPlain: 'Attend votre réponse'
      readonly donePlain: 'Réponse à lire'
      readonly report: 'Compte rendu à lire'
      readonly errorPlain: 'Erreur de l’agent'
    }
    readonly childOf: 'fille de « {{title}} »'
    readonly ago: {
      readonly now: 'à l’instant'
      readonly minutes_one: '{{count}} min'
      readonly minutes_many: '{{count}} min'
      readonly minutes_other: '{{count}} min'
      readonly hours_one: '{{count}} h'
      readonly hours_many: '{{count}} h'
      readonly hours_other: '{{count}} h'
      readonly days_one: '{{count}} j'
      readonly days_many: '{{count}} j'
      readonly days_other: '{{count}} j'
    }
  }
  readonly acpTab: {
    readonly filter: 'Filtrer : méthode, outil, texte'
    readonly group: 'Regrouper les morceaux'
    readonly pause: 'Mettre en pause'
    readonly resume: 'Reprendre'
    readonly waiting: '{{count}} en attente'
    readonly copyAll: 'Copier tout (NDJSON)'
    readonly copySelection: 'Copier la sélection (NDJSON)'
    readonly openLog: 'Ouvrir agents.log'
    readonly openLogEmpty: 'agents.log est vide : passez le journal à Détaillé (Réglages › Diagnostic)'
    readonly foot: 'Clés et jetons masqués · {{max}} derniers messages de cette conversation, en mémoire seulement'
    readonly empty: 'Aucun échange pour l’instant : ils s’affichent dès que l’agent démarre.'
    readonly noMatch: 'Aucun message ne correspond au filtre.'
    readonly list: 'Messages échangés avec l’agent'
    readonly response: 'réponse #{{id}}'
    readonly error: 'erreur #{{id}}'
    readonly grouped: 'regroupés'
    readonly after: '{{time}} après'
    readonly notJson: 'ligne non JSON'
    readonly truncatedLine: 'ligne tronquée'
    readonly truncated: 'Message tronqué : seul le début est gardé ({{size}} au total).'
    readonly out: 'Vers l’agent'
    readonly in: 'De l’agent'
  }
  readonly agents: {
    readonly noneHint: 'Installez Bob Shell (commande bob) ou OpenCode, puis Réglages › Diagnostic › Relire le PATH.'
  }
  readonly customAgents: {
    readonly apiKey: 'Clé d’API ({{name}})'
    readonly error: { readonly unknown: 'Cet agent déclaré n’existe plus.' }
    readonly problem: {
      readonly labelMissing: 'Donnez-lui un nom.'
      readonly labelLong: '{{max}} caractères au plus.'
      readonly commandMissing: 'Écrivez la commande qui le lance.'
      readonly quote: 'Un guillemet n’est pas refermé.'
      readonly commandLong: 'Commande trop longue.'
      readonly envLine: 'Ligne {{line}} : `NOM=valeur` attendu (« {{text}} »).'
      readonly envMany: '{{max}} variables au plus.'
      readonly apiKeyName: 'Lettres, chiffres et `_`, sans commencer par un chiffre.'
      readonly apiKeyInEnv: '{{name}} est aussi dans les variables : retirez-la de là, l’app y pose la clé.'
      readonly compact: 'Une commande « / » sans espace, comme `/compact`.'
    }
    readonly form: {
      readonly newTitle: 'Nouvel agent ACP'
      readonly editTitle: 'Modifier {{agent}}'
      readonly intro: 'Tout agent qui parle ACP sur son entrée et sa sortie standard. Ce qu’il sait faire est lu à son démarrage.'
      readonly label: 'Nom'
      readonly labelHint: 'Celui qu’on voit dans la liste et dans le menu des agents.'
      readonly command: 'Commande'
      readonly commandHint: 'Comme dans un terminal : la commande, puis ses arguments. Des guillemets autour d’un chemin qui contient des espaces.'
      readonly env: 'Variables d’environnement'
      readonly envHint: 'Une par ligne : `NOM=valeur`. Pas de secret ici : la clé d’API se déclare plus bas.'
      readonly optional: 'Facultatif'
      readonly apiKeyEnv: 'Variable de la clé d’API'
      readonly apiKeyEnvHint: 'La clé se saisit ensuite sur la page de l’agent, chiffrée dans le trousseau macOS.'
      readonly compact: 'Commande de compaction'
      readonly compactHint: 'Seulement si l’agent ne l’annonce pas parmi ses commandes (ex. `/compact`).'
      readonly add: 'Ajouter'
      readonly save: 'Enregistrer'
      readonly nextStart: 'Pris en compte au prochain démarrage de l’agent.'
    }
    readonly add: 'Ajouter un agent ACP…'
    readonly edit: 'Modifier…'
    readonly commandMissing: 'Commande introuvable'
    readonly declared: 'Déclaré dans Bobine'
    readonly remove: 'Supprimer cet agent'
    readonly removeHint: 'Ses conversations restent consultables, en lecture seule.'
    readonly removeButton: 'Supprimer…'
    readonly removeConfirm: 'Supprimer {{agent}} ? Sa clé d’API est aussi oubliée.'
    readonly removeAction: 'Supprimer'
  }
  readonly imageZoom: {
    readonly open: 'Voir en grand'
    readonly description: 'L’image en grand ; glissez-la vers le Finder pour l’enregistrer.'
  }
  readonly editor: {
    readonly open: 'Ouvrir dans {{editor}}'
    readonly openAtLine: 'Ouvrir dans {{editor}}, ligne {{line}}'
    readonly missing: 'Fichier introuvable : {{path}}'
    readonly outside: 'Hors du dossier de la conversation, non ouvert : {{path}}'
    readonly none: 'Aucun éditeur installé : réglez-le dans Réglages › Général.'
  }
  readonly turnGuards: {
    readonly stalled: {
      readonly notice_one: 'Aucune sortie depuis {{count}} min'
      readonly notice_many: 'Aucune sortie depuis {{count}} min'
      readonly notice_other: 'Aucune sortie depuis {{count}} min'
      readonly hint: 'La commande ne rend plus rien : elle attend peut-être une saisie ou le réseau.'
      readonly interrupt: 'Interrompre'
      readonly interruptTip: 'Arrêter la réponse de l’agent, comme ■'
    }
    readonly compact: {
      readonly button: 'Compacter'
      readonly tip: 'Contexte presque plein : résumer la conversation ({{command}})'
    }
    readonly cap: {
      readonly title: 'Plafond atteint'
      readonly interrupted: 'La conversation a coûté {{spent}}, au-delà de son plafond de {{limit}} : Bobine a interrompu la réponse à la fin de l’outil en cours.'
      readonly ended: 'La conversation a coûté {{spent}}, au-delà de son plafond de {{limit}}.'
      readonly continue: 'Continuer (plafond + {{step}})'
      readonly stop: 'Arrêter'
      readonly continued: 'Plafond relevé à {{limit}}.'
      readonly stopped: 'Arrêté au plafond.'
      readonly row: 'Plafond'
      readonly none: 'Aucun'
      readonly noneTip: 'Pas de plafond pour cette conversation'
      readonly default: 'Par défaut'
      readonly defaultTip: 'Les montants des réglages'
      readonly input: 'Plafond de cette conversation'
      readonly tokensUnit: 'jetons'
      readonly fromSettings: '{{limit}} (réglages)'
      readonly export: 'Plafond atteint : {{limit}}'
      readonly held: 'Votre message attend votre accord :'
      readonly heldSent: 'Votre message est parti :'
      readonly heldDropped: 'Message non envoyé : arrêté au plafond.'
    }
    readonly settings: {
      readonly title: 'Pendant la réponse'
      readonly stalled: {
        readonly label: 'Commande sans sortie'
        readonly hint: 'Signaler une commande qui ne rend plus rien depuis ce nombre de minutes, quand l’agent envoie la sortie de ses commandes.'
        readonly less: 'Signaler plus tôt'
        readonly more: 'Signaler plus tard'
      }
      readonly cap: {
        readonly label: 'Plafond par conversation'
        readonly hint: 'Pour les nouvelles conversations : au-delà, Bobine interrompt la réponse à la fin de l’outil en cours et demande s’il faut continuer ; un nouveau message attend votre accord. Modifiable dans le détail de la consommation de chaque conversation.'
      }
      readonly capAmount: {
        readonly label: 'Montant'
        readonly hint: 'Un seul montant, compté dans l’unité de l’agent : bobcoins pour Bob, dollars pour les autres.'
      }
      readonly capTokens: {
        readonly label: 'Agent sans montant connu'
        readonly hint: 'Pour un agent qui ne donne pas son coût, le plafond porte sur les jetons, comptés à la fin de chaque échange.'
      }
    }
    readonly search: {
      readonly stalled: 'commande bloquée sortie silencieuse terminal attente minutes interrompre'
      readonly cap: 'plafond budget dépense limite bobcoins dollars interrompre'
    }
    readonly limit: {
      readonly title: 'L’agent s’est arrêté avant la fin'
      readonly detail: 'Il a atteint son nombre maximal d’étapes pour ce tour.'
      readonly continue: 'Continuer'
      readonly refusedTitle: 'L’agent refuse de continuer ici'
      readonly refusedDetail: 'Il a refusé votre message sans rien faire : sa limite vaut pour toute la session.'
      readonly reopen: 'Rouvrir la session et continuer'
      readonly renew: 'Nouvelle session avec le résumé'
      readonly continued: 'Vous lui avez demandé de continuer.'
      readonly reopened: 'Session rouverte : votre message lui a été renvoyé.'
      readonly renewed: 'Nouvelle session ouverte : votre message lui a été renvoyé avec le résumé de l’échange.'
      readonly export: 'Arrêt : nombre maximal d’étapes de l’agent atteint.'
      readonly exportRefused: 'L’agent a refusé de continuer : sa limite d’étapes vaut pour toute la session.'
    }
  }
  readonly sessionTab: {
    readonly environment: 'Environnement'
    readonly agent: 'Agent'
    readonly model: 'Modèle'
    readonly mode: 'Mode'
    readonly folder: 'Dossier'
    readonly branch: 'Branche'
    readonly worktree: 'Worktree'
    readonly branchTip: 'Voir l’état git dans l’onglet Modifications'
    readonly context: 'Contexte'
    readonly contextTotal: '{{used}} sur {{size}} ({{percent}})'
    readonly contextUsed: '≈ {{used}} utilisés'
    readonly noTotal: '{{agent}} ne donne pas le remplissage de son contexte : seul ce qui est connu est compté, sans le prompt système ni les outils intégrés.'
    readonly estimateHint: '≈ : estimé'
    readonly estimateTip: 'Environ 4 caractères par jeton'
    readonly approx: '≈ {{tokens}}'
    readonly measuring: 'mesure…'
    readonly measure: 'Mesurer'
    readonly measureTip: 'Mesurer : lancer les serveurs MCP de l’agent pour lire leurs outils, comme « Tester »'
    readonly measuredOf_one: '{{count}} sur {{total}} mesuré'
    readonly measuredOf_many: '{{count}} sur {{total}} mesurés'
    readonly measuredOf_other: '{{count}} sur {{total}} mesurés'
    readonly line: {
      readonly messages: 'Messages'
      readonly bobine: 'Outils de Bobine'
      readonly mcp: 'Autres serveurs MCP'
      readonly agent: 'Agent (non détaillé)'
      readonly free: 'Libre'
      readonly memory: 'Mémoire'
    }
    readonly lineTip: {
      readonly messages: 'Texte du fil et résultats d’outils depuis la dernière compaction'
      readonly bobine: 'Définitions des outils que Bobine donne à l’agent'
      readonly mcp: 'Définitions des outils des autres serveurs MCP de l’agent, mesurées sur demande'
      readonly agent: 'Le reste du total donné par l’agent : prompt système, outils intégrés, skills, mémoire…'
      readonly free: 'Place encore libre dans la fenêtre de contexte'
      readonly memory: 'Index de la mémoire commune joint au début de la session (souvenirs « Vous » et du projet). Cliquer pour les voir.'
    }
    readonly changes: 'Modifications'
    readonly changesFiles_one: '{{count}} fichier'
    readonly changesFiles_many: '{{count}} fichiers'
    readonly changesFiles_other: '{{count}} fichiers'
    readonly changesTip: 'Ouvrir l’onglet Modifications'
    readonly changesConversation: 'Conversation'
    readonly changesConversationTip: 'Voir ce que cette conversation a modifié'
    readonly changesFolder: 'Dossier'
    readonly changesNone: 'Aucune'
    readonly changesUncommitted_one: '{{count}} fichier non commité'
    readonly changesUncommitted_many: '{{count}} fichiers non commités'
    readonly changesUncommitted_other: '{{count}} fichiers non commités'
    readonly running: 'En cours'
    readonly nothingRunning: 'Rien en arrière-plan pour cette conversation.'
    readonly kind: {
      readonly terminal: 'Terminal'
      readonly server: 'Serveur de dev'
      readonly subagent: 'Sous-agent'
      readonly child: 'Conversation fille'
    }
    readonly stop: 'Arrêter « {{label}} »'
    readonly openChild: 'Ouvrir « {{label}} »'
    readonly finished: 'Terminées : {{count}}'
    readonly noStop: 'Bobine ne sait pas arrêter un sous-agent seul : l’arrêt du tour l’arrête.'
    readonly pr: 'Pull request'
    readonly prTip: 'Voir la PR dans la vue Git'
    readonly extraFolders: 'Autres dossiers'
    readonly addFolder: 'Ajouter un dossier…'
    readonly addFolderTip: 'L’agent voit aussi ce dossier. Sa session repart aussitôt avec la nouvelle liste ; le fil est gardé.'
    readonly removeFolder: 'Retirer {{name}} de la conversation'
    readonly foldersBusy: 'Après la réponse de l’agent'
    readonly foldersUnsupported: 'Non transmis : {{agent}} ne prend pas d’autres dossiers que le dossier de travail.'
  }
  readonly prTrack: {
    readonly title: '#{{number}} {{title}}'
    readonly refresh: 'Actualiser'
    readonly error: 'Suivi de la PR impossible : {{message}}'
    readonly state: {
      readonly open: 'Ouverte'
      readonly draft: 'Brouillon'
      readonly merged: 'Fusionnée'
      readonly closed: 'Fermée'
    }
    readonly checks: {
      readonly none: 'Aucun contrôle de CI'
      readonly failed_one: '{{count}} en échec'
      readonly failed_many: '{{count}} en échec'
      readonly failed_other: '{{count}} en échec'
      readonly pending_one: '{{count}} en cours'
      readonly pending_many: '{{count}} en cours'
      readonly pending_other: '{{count}} en cours'
      readonly passed_one: '{{count}} réussi'
      readonly passed_many: '{{count}} réussis'
      readonly passed_other: '{{count}} réussis'
      readonly skipped_one: '{{count}} ignoré'
      readonly skipped_many: '{{count}} ignorés'
      readonly skipped_other: '{{count}} ignorés'
    }
    readonly checkState: {
      readonly passed: 'Réussi'
      readonly failed: 'En échec'
      readonly pending: 'En cours'
      readonly skipped: 'Ignoré'
    }
    readonly comments_one: '{{count}} commentaire'
    readonly comments_many: '{{count}} commentaires'
    readonly comments_other: '{{count}} commentaires'
    readonly review: {
      readonly approved: 'Approuvée'
      readonly 'changes-requested': 'Changements demandés'
      readonly 'review-required': 'Relecture demandée'
    }
    readonly mergeable: {
      readonly mergeable: 'Fusionnable'
      readonly conflicting: 'En conflit avec la base'
    }
    readonly fix: 'Corriger les contrôles en échec'
    readonly autoFix: 'Corriger d’office'
    readonly autoMerge: 'Fusionner quand tout est vert'
    readonly event: {
      readonly fixSent_one: 'Contrôle en échec envoyé à l’agent.'
      readonly fixSent_many: '{{count}} contrôles en échec envoyés à l’agent.'
      readonly fixSent_other: '{{count}} contrôles en échec envoyés à l’agent.'
      readonly fixSentAuto_one: 'Contrôle en échec envoyé d’office à l’agent.'
      readonly fixSentAuto_many: '{{count}} contrôles en échec envoyés d’office à l’agent.'
      readonly fixSentAuto_other: '{{count}} contrôles en échec envoyés d’office à l’agent.'
      readonly merged: 'PR fusionnée par l’app ({{method}}) : tout était vert.'
      readonly mergeFailed: 'La fusion de la PR a échoué : {{message}}'
      readonly fixFailed: 'La consigne n’a pas pu partir à l’agent : {{message}}'
      readonly noMergeMethod: 'Le dépôt ne permet aucune méthode de fusion à l’app.'
      readonly mergedNoCi: 'PR fusionnée ({{method}}), sans CI détectée.'
    }
    readonly method: {
      readonly merge: 'commit de fusion'
      readonly squash: 'squash'
      readonly rebase: 'rebase'
    }
    readonly autoMergeWith: 'Fusionner quand tout est vert ({{method}})'
    readonly wait: {
      readonly draft: 'Fusion en attente : la PR est un brouillon (à marquer prête sur GitHub).'
      readonly conflicting: 'Fusion en attente : conflit avec {{base}} à résoudre (« Fusionner dans {{base}} », puis pousser).'
      readonly 'changes-requested': 'Fusion en attente : un relecteur demande des modifications.'
      readonly 'review-required': 'Fusion en attente : la PR doit être approuvée par un relecteur.'
      readonly failed: 'Fusion en attente : des contrôles sont en échec.'
      readonly pending: 'Fusion dès que les contrôles seront verts.'
      readonly behind: 'Fusion en attente : la branche doit d’abord reprendre {{base}} (règle de la branche sur GitHub).'
      readonly blocked: 'Fusion en attente : bloquée par les règles de {{base}} sur GitHub (contrôle ou relecture requis).'
      readonly awaited: 'Fusion en attente : GitHub n’a pas encore signalé les contrôles.'
      readonly silent: 'Fusion en attente : aucun contrôle signalé depuis 5 min. La CI du dépôt se lance-t-elle sur les pull requests ?'
      readonly 'no-ci': 'Aucune CI détectée : rien ne sera fusionné d’office. Fusionnez quand vous voulez.'
      readonly mergeability: 'Fusion en attente : GitHub calcule si la PR est fusionnable.'
    }
    readonly checksAwaited: 'Contrôles en attente'
    readonly checksSilent: 'Aucun contrôle signalé'
    readonly checksNoCi: 'Aucune CI détectée'
    readonly mergeNow: 'Fusionner maintenant'
    readonly mergingNow: 'Fusion…'
    readonly rulesUnreadable: 'Règles de la branche illisibles sur GitHub : une CI est supposée.'
    readonly mergeabilityUnreported: 'Fusion en attente : GitHub ne dit pas si la PR est fusionnable (rien depuis 10 min). Rien ne sera fusionné d’office ; fusionnez depuis GitHub.'
  }
  readonly worktreeSetup: {
    readonly title: 'Préparation du worktree'
    readonly copied_one: '{{count}} fichier copié depuis le dossier d’origine'
    readonly copied_many: '{{count}} fichiers copiés depuis le dossier d’origine'
    readonly copied_other: '{{count}} fichiers copiés depuis le dossier d’origine'
    readonly copiedNone: 'Aucun fichier de .worktreeinclude à copier'
    readonly skipped_one: '{{count}} ignoré (lien, hors du dépôt ou déjà présent)'
    readonly skipped_many: '{{count}} ignorés (liens, hors du dépôt ou déjà présents)'
    readonly skipped_other: '{{count}} ignorés (liens, hors du dépôt ou déjà présents)'
    readonly truncated_one: '{{count}} non copié (plafond de 5 000 fichiers ou 500 Mo)'
    readonly truncated_many: '{{count}} non copiés (plafond de 5 000 fichiers ou 500 Mo)'
    readonly truncated_other: '{{count}} non copiés (plafond de 5 000 fichiers ou 500 Mo)'
    readonly copyError: 'Copie interrompue : {{error}}'
    readonly running: 'En cours…'
    readonly copying: 'Copie des fichiers…'
    readonly done: 'Réussie en {{seconds}} s'
    readonly doneShort: 'Réussie'
    readonly failed: 'Échec (code {{code}})'
    readonly timedOut: 'Arrêtée au bout de 15 min'
    readonly notStarted: 'Impossible à lancer : {{error}}'
    readonly failedHint: 'La conversation continue ; l’agent sait que la préparation a échoué.'
    readonly approval: 'Ce dépôt propose cette commande (.bobine/worktree.json). Bobine ne la lance qu’avec votre accord.'
    readonly approve: 'Autoriser et lancer'
    readonly approveTitle: 'Lancer la commande dans ce worktree. L’accord couvre les commandes montrées (à la création et à la suppression) pour ce dépôt, tant que .bobine/worktree.json ne change pas'
    readonly output: 'Sortie'
    readonly waiting: 'Message envoyé à l’agent à la fin de la préparation du worktree.'
    readonly export: 'Préparation du worktree : {{command}} — {{state}}'
    readonly exportCopied: 'Préparation du worktree : {{count}} fichier(s) copié(s)'
    readonly skip: 'Continuer sans préparer'
    readonly skipTitle: 'Ne pas lancer la commande dans ce worktree ; les messages en attente partent, et l’agent sait que la préparation n’a pas eu lieu'
    readonly skipped: 'Non lancée'
    readonly skippedHint: 'La conversation continue sans préparation ; l’agent le sait.'
    readonly held_one: 'Votre message attend : autorisez la préparation, ou continuez sans elle.'
    readonly held_many: 'Vos {{count}} messages attendent : autorisez la préparation, ou continuez sans elle.'
    readonly held_other: 'Vos {{count}} messages attendent : autorisez la préparation, ou continuez sans elle.'
    readonly filesTitle: 'Fichiers copiés'
    readonly more_one: 'et {{count}} autre'
    readonly more_many: 'et {{count}} autres'
    readonly more_other: 'et {{count}} autres'
    readonly atCreate: 'À la création'
    readonly atRemove: 'À la suppression'
    readonly approvalBoth: 'Ce dépôt propose ces commandes (.bobine/worktree.json). Bobine ne les lance qu’avec votre accord, qui couvre les deux.'
    readonly approvalArchive: 'Ce dépôt propose une commande à lancer à la suppression du worktree (.bobine/worktree.json). Bobine ne la lance qu’avec votre accord ; rien ne tourne maintenant.'
    readonly approveArchive: 'Autoriser'
    readonly approveArchiveTitle: 'Lancer cette commande à chaque suppression d’un worktree de ce dépôt, tant que .bobine/worktree.json ne change pas'
    readonly refuseArchive: 'Ne pas autoriser'
    readonly refuseArchiveTitle: 'Ne pas lancer cette commande à la suppression de ce worktree'
    readonly archiveApproved: 'Autorisée'
    readonly notApproved: 'Non autorisée'
    readonly changed: 'Le fichier .bobine/worktree.json a changé depuis l’affichage : rien n’a été lancé. Vérifiez les commandes ci-dessus avant d’autoriser.'
    readonly heldRunning_one: 'Votre message attend la fin de la préparation.'
    readonly heldRunning_many: 'Vos {{count}} messages attendent la fin de la préparation.'
    readonly heldRunning_other: 'Vos {{count}} messages attendent la fin de la préparation.'
    readonly stop: 'Arrêter'
    readonly stopTitle: 'Arrêter la commande ; les messages en attente partent, et l’agent sait qu’elle n’a pas abouti'
    readonly proceed: 'Continuer sans attendre'
    readonly proceedTitle: 'Laisser la commande finir ; les messages en attente partent maintenant, et l’agent sait qu’elle tourne encore'
    readonly proceededHint: 'Vos messages sont partis sans attendre la fin ; l’agent le sait.'
    readonly stopped: 'Arrêtée'
    readonly unattendedHint: 'Exécution planifiée : cette commande n’est pas autorisée pour ce dépôt, la conversation a continué sans elle.'
  }
  readonly aside: {
    readonly title: 'Aparté'
    readonly outside: 'Hors du fil'
    readonly outsideWith: 'Hors du fil · {{agent}}, session à part'
    readonly costHint: 'Coût de l’aparté, compté dans celui de la conversation'
    readonly close: 'Fermer l’aparté'
    readonly answering: 'Réponse en cours…'
    readonly refused_one: 'L’agent a voulu modifier quelque chose : refusé, l’aparté est en lecture seule.'
    readonly refused_other: 'L’agent a voulu modifier quelque chose ({{count}} fois) : refusé, l’aparté est en lecture seule.'
    readonly refused_many: 'L’agent a voulu modifier quelque chose ({{count}} fois) : refusé, l’aparté est en lecture seule.'
    readonly addToThread: 'Ajouter au fil'
    readonly placeholder: 'Une question à côté, sans rien ajouter à la conversation…'
    readonly placeholderMore: 'Une autre question à côté…'
    readonly question: 'Question en aparté'
    readonly withContext: 'Joindre l’échange récent (≈ {{tokens}} jetons)'
    readonly ask: 'Demander'
    readonly error: {
      readonly busy: 'L’aparté répond encore : attendez sa réponse.'
      readonly needsAction: '{{agent}} attend une action (connexion, dossier à approuver…) : réglez-la dans la conversation, puis reposez la question.'
      readonly stopped: 'L’agent de l’aparté s’est arrêté.'
    }
  }
  readonly roleWork: {
    readonly brief: 'Consigne du rôle'
    readonly readOnly: 'lecture seule'
    readonly readOnlyRequested: 'lecture seule demandée'
    readonly readOnlyRequestedHint: 'L’agent de cette conversation écrit sans demander d’autorisation : la lecture seule lui est seulement demandée, et Bobine vérifie le dossier après chaque tour.'
    readonly writes: 'écrit du code'
    readonly mode: 'mode {{mode}}'
    readonly byAgent: 'proposé par l’agent'
    readonly prompt: 'Consigne'
    readonly hides: 'Rôle du projet : il remplace le rôle {{scopes}} du même nom.'
    readonly titleBadge: 'Rôle : {{label}}'
    readonly scope: {
      readonly builtin: 'fourni'
      readonly user: 'personnel'
      readonly project: 'du projet'
    }
    readonly menu: {
      readonly title: 'Rôles'
      readonly byDescription: 'Rôles dont la description correspond'
      readonly hint: 'Votre demande partira dans une conversation fille'
      readonly all_one: 'Tous les rôles ({{count}})'
      readonly all_many: 'Tous les rôles ({{count}})'
      readonly all_other: 'Tous les rôles ({{count}})'
      readonly option: '{{label}} : {{description}}'
      readonly project: 'Rôle du projet (vient du dépôt)'
      readonly new: 'Nouveau rôle…'
      readonly newNamed: 'Nouveau rôle « {{name}} »'
      readonly manage: 'Gérer'
    }
    readonly invite: {
      readonly title: 'Confiez ce travail à un rôle'
      readonly text: 'Un expert sécu, un reviewer, un architecte… créé une fois, appelé avec @, au travail dans une conversation fille.'
      readonly create: 'Créer un rôle'
      readonly hide: 'Ne plus montrer'
    }
    readonly token: { readonly remove: 'Retirer {{label}}' }
    readonly destination: {
      readonly one: 'Partira à <strong>{{label}}</strong>, dans une conversation fille'
      readonly many_one: 'Partira à <strong>{{count}} rôle</strong>, une conversation fille chacun, en parallèle'
      readonly many_many: 'Partira à <strong>{{count}} rôles</strong>, une conversation fille chacun, en parallèle'
      readonly many_other: 'Partira à <strong>{{count}} rôles</strong>, une conversation fille chacun, en parallèle'
      readonly sameFolder: 'dans ce dossier'
      readonly worktree: 'son worktree'
      readonly draft: 'Écrivez d’abord dans cette conversation : un rôle part d’une conversation de l’historique.'
      readonly attachments: 'Les pièces jointes ne partent pas aux rôles : retirez-les, ou envoyez sans rôle.'
      readonly empty: 'Écrivez votre demande après le rôle : c’est elle qui part.'
      readonly sending: 'Lancement…'
      readonly failed: '{{label}} n’est pas parti : {{error}}'
    }
    readonly state: {
      readonly running: 'au travail'
      readonly waiting: 'attend votre accord'
      readonly unread: 'a rendu son compte rendu'
      readonly done: 'a fini'
      readonly error: 'en échec'
    }
    readonly report: {
      readonly done: '{{role}} a rendu son compte rendu — {{title}}'
      readonly stopped: '{{role}} a été arrêté — {{title}}'
      readonly error: '{{role}} a échoué — {{title}}'
      readonly saveAsRole: 'Enregistrer comme rôle…'
    }
    readonly proposalsWhere: 'L’agent propose de confier ce travail à des conversations filles : un rôle en lecture seule travaille dans ce dossier, les autres chacune dans son worktree. Vous pouvez aussi lui demander de le faire ici.'
    readonly where: { readonly sameFolder: 'dans ce dossier'; readonly worktree: 'son worktree' }
  }
  readonly review: {
    readonly action: 'Faire relire…'
    readonly actionTip: 'Faire relire : un autre agent relit ces modifications, sans rien modifier, et pose ses remarques sur le diff'
    readonly error: {
      readonly noGit: 'Relecture impossible : le dossier de la conversation n’est pas dans un dépôt git.'
      readonly busy: 'La conversation répond encore : attendez la fin de sa réponse pour la faire relire.'
      readonly reviewer: 'Une relecture ne se fait pas relire.'
      readonly nothing: 'Rien à relire : aucune modification dans ce dossier.'
      readonly notReviewer: 'Cette conversation n’est pas une relecture.'
    }
    readonly title: 'Relecture : {{title}}'
    readonly dialog: {
      readonly title: 'Faire relire « {{title}} »'
      readonly description: 'Une conversation fille relit ce travail dans son dossier, sans rien modifier : les erreurs d’abord, puis ce qui se simplifie. Ses remarques arrivent sur les lignes du diff ; vous choisissez ensuite celles à renvoyer.'
      readonly scopeBranch: 'Relu : tout le travail de la branche {{branch}}, commits et modifications non commitées.'
      readonly scopeUncommitted: 'Relu : les modifications non commitées du dossier.'
      readonly focus: 'Points à surveiller (facultatif)'
      readonly placeholder: 'Par exemple : la gestion des erreurs réseau'
      readonly suggested: 'Agent et modèle de la conversation relue, suggérés : à confirmer ou changer.'
      readonly cost: 'La relecture est une conversation de plus : elle coûte comme telle. Son coût s’affiche sur sa carte et sur sa ligne.'
      readonly launch: 'Lancer la relecture'
      readonly launching: 'Lancement…'
    }
    readonly card: {
      readonly running: 'Relecture en cours par {{agent}}'
      readonly reported_one: 'Relecture par {{agent}} : {{count}} remarque'
      readonly reported_many: 'Relecture par {{agent}} : {{count}} remarques'
      readonly reported_other: 'Relecture par {{agent}} : {{count}} remarques'
      readonly none: 'Relecture par {{agent}} : rien à signaler'
      readonly silent: 'Relecture par {{agent}} : finie sans remarques structurées, sa réponse est dans son fil'
      readonly failed: 'Relecture impossible : {{error}}'
      readonly changed: 'Le dossier a changé pendant la relecture (relecteur, cette conversation ou vous) : vérifiez la vue Git ; les lignes citées ont pu bouger.'
      readonly scopeBranch: 'Branche depuis {{base}}'
      readonly scopeUncommitted: 'Modifications non commitées'
      readonly files_one: '{{count}} fichier'
      readonly files_many: '{{count}} fichiers'
      readonly files_other: '{{count}} fichiers'
      readonly open: 'Ouvrir la relecture'
      readonly showNotes: 'Voir sur le diff'
      readonly severe_one: '{{count}} haute'
      readonly severe_many: '{{count}} hautes'
      readonly severe_other: '{{count}} hautes'
    }
    readonly severity: { readonly high: 'Haute'; readonly medium: 'Moyenne'; readonly low: 'Basse' }
    readonly category: {
      readonly correctness: 'Correction'
      readonly simplification: 'Simplification'
    }
    readonly notes: {
      readonly title: 'Remarques de la relecture'
      readonly remove: 'Retirer la remarque'
      readonly line: '{{file}}, ligne {{line}}'
      readonly lines: '{{file}}, lignes {{from}} à {{to}}'
    }
    readonly notice: {
      readonly changed: 'Le dossier relu a changé pendant ce tour : une relecture ne doit rien modifier. Vérifiez la vue Git de la conversation relue.'
    }
    readonly export_one: 'Relecture « {{title}} » : {{count}} remarque'
    readonly export_many: 'Relecture « {{title}} » : {{count}} remarques'
    readonly export_other: 'Relecture « {{title}} » : {{count}} remarques'
  }
  readonly scheduled: {
    readonly title: 'Tâches planifiées'
    readonly intro: 'À l’heure dite, Bobine ouvre une nouvelle conversation et envoie la consigne. Vous êtes prévenu à la fin ; l’exécution est rangée dans la barre latérale.'
    readonly openOnly: 'Les tâches ne tournent que lorsque Bobine est ouverte. Les échéances manquées (Mac en veille, app fermée) ne sont pas rejouées : au plus un rattrapage.'
    readonly keepAwake: 'Pendant une exécution, « Empêcher la mise en veille » (Réglages › Général) garde le Mac éveillé.'
    readonly new: 'Nouvelle tâche'
    readonly empty: 'Aucune tâche planifiée'
    readonly list: 'Tâches'
    readonly schedule: {
      readonly once: 'Le {{date}}'
      readonly daily: 'Chaque jour à {{time}}'
      readonly weekdays: 'Du lundi au vendredi à {{time}}'
      readonly interval_one: 'Toutes les heures'
      readonly interval_many: 'Toutes les {{count}} heures'
      readonly interval_other: 'Toutes les {{count}} heures'
    }
    readonly next: 'Prochaine : {{date}}'
    readonly paused: 'En pause'
    readonly noNext: 'Aucune échéance à venir'
    readonly worktree: 'Nouveau worktree'
    readonly estimate_one: '≈ {{cost}} par exécution (dernière)'
    readonly estimate_many: '≈ {{cost}} par exécution ({{count}} dernières)'
    readonly estimate_other: '≈ {{cost}} par exécution ({{count}} dernières)'
    readonly noEstimate: 'Coût inconnu tant qu’elle n’a pas tourné'
    readonly cap: 'Plafond : {{cap}}'
    readonly capBoth: 'Plafond : {{amount}} ou {{tokens}}'
    readonly capAmount: '{{amount}} (devise de l’agent)'
    readonly noCap: 'Plafond des réglages'
    readonly runs: 'Dernières exécutions'
    readonly noRuns: 'Pas encore lancée.'
    readonly outcome: {
      readonly running: 'En cours'
      readonly done: 'Terminée'
      readonly error: 'En erreur'
      readonly capped: 'Arrêtée au plafond'
      readonly failed: 'Lancement impossible'
      readonly skipped: 'Sautée : la précédente tournait encore'
      readonly missed: 'Manquée'
      readonly stopped: 'Interrompue'
    }
    readonly manual: 'à la main'
    readonly catchUp: 'rattrapage'
    readonly setupNotApproved: 'préparation non autorisée'
    readonly missedCount_one: '{{count}} échéance manquée'
    readonly missedCount_many: '{{count}} échéances manquées'
    readonly missedCount_other: '{{count}} échéances manquées'
    readonly open: 'Ouvrir'
    readonly openTip: 'Ouvrir la conversation de cette exécution'
    readonly actions: {
      readonly runNow: 'Lancer maintenant'
      readonly pause: 'Mettre en pause'
      readonly resume: 'Reprendre'
      readonly edit: 'Modifier'
      readonly delete: 'Supprimer'
      readonly confirmDelete: 'Supprimer « {{name}} » et l’historique de ses exécutions ? Les conversations déjà lancées restent dans la barre latérale.'
      readonly cancel: 'Annuler'
      readonly more: 'Plus d’actions'
    }
    readonly form: {
      readonly titleNew: 'Nouvelle tâche planifiée'
      readonly titleEdit: 'Modifier la tâche'
      readonly name: 'Nom'
      readonly namePlaceholder: 'D’après la consigne'
      readonly instruction: 'Consigne'
      readonly instructionPlaceholder: 'Ce que l’agent doit faire à chaque exécution'
      readonly folder: 'Dossier'
      readonly chooseFolder: 'Choisir…'
      readonly noFolder: 'Aucun dossier choisi'
      readonly agent: 'Agent'
      readonly frequency: 'Fréquence'
      readonly kind: {
        readonly once: 'Une fois'
        readonly daily: 'Chaque jour'
        readonly weekdays: 'Jours de semaine'
        readonly interval: 'Toutes les N heures'
      }
      readonly at: 'Date et heure'
      readonly time: 'Heure'
      readonly hours: 'Toutes les (heures)'
      readonly worktree: 'Chaque exécution dans un nouveau worktree'
      readonly worktreeHint: 'Le dossier doit être un dépôt git ; les modifications restent sur une branche à part.'
      readonly catchUp: 'Rattraper une échéance manquée (une seule exécution)'
      readonly capTitle: 'Plafond par exécution'
      readonly capHint: 'Le tour s’arrête au plafond et la conversation attend votre accord. Montant dans la devise de l’agent (bobcoins pour Bob) ; jetons quand l’agent ne donne pas de coût. Vide : le plafond des réglages.'
      readonly capAmount: 'Montant'
      readonly capTokens: 'Jetons'
      readonly permissions: 'Une exécution planifiée n’accorde rien de plus qu’une conversation ordinaire : une demande d’autorisation attend votre réponse et vous prévient.'
      readonly save: 'Enregistrer'
      readonly cancel: 'Annuler'
      readonly pastDate: 'Cette date est déjà passée.'
      readonly noCapWarning: 'Coût inconnu et jusqu’à {{count}} exécutions par jour : fixez un plafond pour borner la dépense.'
    }
    readonly error: {
      readonly alreadyRunning: 'Une exécution de cette tâche tourne encore.'
      readonly folderMissing: 'Dossier introuvable : {{folder}}'
      readonly notifyTitle: 'Tâche planifiée « {{name}} » non lancée'
    }
    readonly perDay: '≈ {{cost}} par jour'
    readonly emptyHint: 'Une consigne qui part toute seule : une fois, chaque jour ou toutes les N heures.'
  }
  readonly turnSummary: {
    readonly done: 'Terminé en {{duration}}'
    readonly files_one: '{{count}} fichier +{{added}} −{{removed}}'
    readonly files_many: '{{count}} fichiers +{{added}} −{{removed}}'
    readonly files_other: '{{count}} fichiers +{{added}} −{{removed}}'
    readonly doneQuick: 'Terminé'
    readonly cost: '≈ {{cost}}'
  }
  readonly cap: {
    readonly more_one: '⋯ {{n}} ligne de plus'
    readonly more_other: '⋯ {{n}} lignes de plus'
    readonly more_many: '⋯ {{n}} lignes de plus'
    readonly moreRemoved_one: '⋯ {{n}} ligne retirée de plus'
    readonly moreRemoved_other: '⋯ {{n}} lignes retirées de plus'
    readonly moreRemoved_many: '⋯ {{n}} lignes retirées de plus'
    readonly moreAdded_one: '⋯ {{n}} ligne ajoutée de plus'
    readonly moreAdded_other: '⋯ {{n}} lignes ajoutées de plus'
    readonly moreAdded_many: '⋯ {{n}} lignes ajoutées de plus'
    readonly hiddenStart_one: '{{n}} première ligne masquée ({{size}} au total)'
    readonly hiddenStart_other: '{{n}} premières lignes masquées ({{size}} au total)'
    readonly hiddenStart_many: '{{n}} premières lignes masquées ({{size}} au total)'
    readonly hiddenChars: 'Début masqué ({{size}} au total)'
    readonly showAll: 'Afficher tout'
    readonly showing: 'Affichage… {{done}} / {{total}}'
    readonly shown_one: '{{n}} ligne affichée'
    readonly shown_other: '{{n}} lignes affichées'
    readonly shown_many: '{{n}} lignes affichées'
    readonly copyAll: 'Copier tout'
    readonly openFailed: 'Ouverture impossible : {{error}}'
    readonly foundHidden: 'Trouvé dans le contenu masqué'
  }
  readonly help: {
    readonly title: 'Aide de Bobine'
    readonly nav: "Sommaire de l'aide"
    readonly search: {
      readonly placeholder: 'Rechercher'
      readonly label: "Rechercher dans l'aide"
      readonly empty: 'Aucune page ne contient ces mots.'
      readonly keys: '↑↓ résultats · ↩ ouvrir · Échap effacer'
    }
    readonly link: 'Aide : {{section}}'
    readonly howItWorks: 'Comment ça marche'
  }
  readonly tips: {
    readonly label: 'Astuce de Bobine'
    readonly learnMore: 'En savoir plus'
    readonly never: 'Ne plus montrer'
    readonly close: 'Fermer pour aujourd’hui'
    readonly aside: {
      readonly text: 'Une question à côté sans interrompre l’agent : <kbd>/btw</kbd> ou <kbd>⇧⌘A</kbd>'
      readonly try: 'Essayer'
    }
    readonly context: {
      readonly text: 'Contexte plein à {{percent}} % : l’agent oubliera bientôt le début. Repartir d’un résumé ?'
    }
    readonly review: {
      readonly text: 'Gros changement : le faire relire par un autre agent avant de fusionner ?'
    }
    readonly scheduled: {
      readonly text: 'Troisième fois ce message. En faire une tâche planifiée ?'
      readonly plan: 'Planifier…'
    }
  }
  readonly onboarding: {
    readonly timeout: {
      readonly reply: 'L’agent n’a pas répondu au message d’essai'
      readonly authenticate: 'La connexion n’a pas abouti à temps'
    }
    readonly noReply: 'L’agent n’a rien répondu ({{reason}}).'
    readonly toolRefused: 'L’agent a voulu utiliser un outil : refusé pendant l’essai, qui s’est arrêté là.'
    readonly trialFolderName: 'essai'
    readonly steps: {
      readonly agent: 'Agent'
      readonly connect: 'Connexion'
      readonly folder: 'Dossier'
      readonly trial: 'Essai'
      readonly label: 'Étapes de l’accueil'
      readonly back: 'Revenir à l’étape {{step}}'
    }
    readonly skipAll: 'Passer l’accueil'
    readonly skipStep: 'Passer cette étape'
    readonly continue: 'Continuer'
    readonly cancel: 'Annuler'
    readonly retry: 'Réessayer'
    readonly otherAgent: 'Choisir un autre agent'
    readonly start: 'Commencer'
    readonly agent: {
      readonly title: 'Bienvenue dans Bobine'
      readonly subtitle: 'Quatre étapes courtes. Tout se change ensuite dans Réglages.'
      readonly found: 'trouvé'
      readonly foundVersion: 'trouvé · {{version}}'
      readonly missing: 'introuvable'
      readonly note: 'Un autre agent ACP s’ajoute dans Réglages › Agents.'
      readonly group: 'Agent'
      readonly noneSubtitle: 'Bobine pilote un agent de code installé sur ce Mac. Installez-en un, puis cherchez à nouveau.'
      readonly search: 'Chercher à nouveau'
      readonly stillNone: 'Toujours aucun agent trouvé.'
      readonly explore: 'Explorer sans agent'
    }
    readonly connect: {
      readonly title: 'Connecter {{agent}}'
      readonly checking: 'Vérification, sans aucun message au modèle…'
      readonly readyTitle: '{{agent}} est prêt'
      readonly readyText: 'Il a démarré en {{seconds}} s. L’essai vérifiera la réponse du modèle.'
      readonly cancelled: 'Vérification annulée. L’agent a été arrêté.'
    }
    readonly folder: {
      readonly title: 'Où travailler ?'
      readonly subtitle: 'L’agent lit et modifie les fichiers de ce dossier, avec votre accord.'
      readonly projectTitle: 'Un projet existant'
      readonly projectHelp: 'De préférence un dépôt git.'
      readonly choose: 'Choisir…'
      readonly trialTitle: 'Un dossier d’essai vide'
      readonly trialHelp: 'Pour découvrir sans rien toucher : {{path}}'
      readonly create: 'Créer'
    }
    readonly trial: {
      readonly title: '{{agent}} répond-il ?'
      readonly subtitle: 'Un message d’essai très court, pour vérifier que tout marche de bout en bout.'
      readonly toSend: 'Message à envoyer :'
      readonly cost: 'Coût : celui d’un message très court, rien avec un modèle gratuit. Le montant exact s’affiche après, si l’agent le donne.'
      readonly model: 'Modèle : {{model}}'
      readonly send: 'Envoyer le message d’essai'
      readonly waiting: 'En attente de la réponse…'
      readonly waitingFor: '{{seconds}} s · {{max}} s au plus'
      readonly repliedTitle: '{{agent}} a répondu en {{seconds}} s'
      readonly cost2: 'Coût {{amount}}'
      readonly tokens: '{{input}} jetons envoyés · {{output}} reçus'
      readonly toolRefused: 'Il a voulu utiliser un outil : refusé pendant l’essai.'
      readonly cancelled: 'Essai annulé. L’agent a été arrêté.'
    }
    readonly error: {
      readonly missing: '{{agent}} est introuvable'
      readonly network: 'Réseau injoignable'
      readonly networkText: '{{agent}} n’a pas pu joindre son modèle. Vérifiez la connexion, le VPN ou le proxy.'
      readonly rateLimit: 'Trop de demandes'
      readonly rateLimitText: 'Le modèle fait patienter {{agent}}. Réessayez dans un moment.'
      readonly networkSettings: 'Réglages › Réseau'
      readonly timeout: 'Pas de réponse à temps'
      readonly timeoutText: '{{agent}} a été arrêté. Le modèle est peut-être surchargé : réessayez, ou changez de modèle plus tard dans la conversation.'
      readonly crashed: '{{agent}} s’est arrêté'
      readonly crashedText: 'L’agent a quitté pendant l’essai. Rien n’a été modifié.'
      readonly failed: '{{agent}} n’a pas répondu'
      readonly details: 'Détails'
      readonly openLog: 'Ouvrir le journal'
    }
    readonly home: {
      readonly runTests: 'Lance les tests ({{command}})'
      readonly runTestsText: 'Lance les tests avec `{{command}}` et explique les échecs éventuels.'
      readonly gettingStarted: 'Premiers pas'
      readonly permissions: 'Autorisations'
      readonly help: 'Aide : ⌘?'
    }
    readonly unknownMethod: 'Méthode de connexion inconnue de l’agent.'
  }
  readonly memory: {
    readonly export: {
      readonly remember: 'Souvenir proposé : {{name}}'
      readonly forget: 'Oubli proposé : {{name}}'
      readonly titleUser: 'Mémoire — Vous'
      readonly titleProject: 'Mémoire — {{project}}'
    }
    readonly status: {
      readonly pending: 'en attente'
      readonly kept: 'retenu'
      readonly forgotten: 'oublié'
      readonly declined: 'non retenu'
    }
    readonly attach: {
      readonly title: 'Rattacher ces souvenirs à un dossier'
      readonly button: 'Rattacher'
    }
    readonly card: {
      readonly rememberTitle: 'Retenir ce souvenir ?'
      readonly forgetTitle: 'Oublier ce souvenir ?'
      readonly by: 'proposé par {{agent}}'
      readonly external: "Proposé juste après la lecture {{source}}. Un contenu externe peut glisser des consignes à l'agent : vérifiez ce texte, il reviendra à chaque session de ce projet."
      readonly command: 'Il contient une commande à exécuter.'
      readonly changed: 'Modifié depuis la proposition (le {{date}})'
      readonly replaces: 'Remplace « {{description}} », retenu le {{date}} :'
      readonly remember: 'Retenir'
      readonly forget: 'Oublier'
      readonly no: 'Non'
      readonly off: 'Mémoire désactivée'
      readonly settings: 'Réglages'
      readonly showAll_one: 'Tout afficher ({{count}} ligne)'
      readonly showAll_other: 'Tout afficher ({{count}} lignes)'
      readonly showAll_many: 'Tout afficher ({{count}} lignes)'
      readonly deletedSince: 'Supprimé depuis la proposition : « Retenir » le recrée.'
    }
    readonly decided: {
      readonly kept: 'Retenu :'
      readonly declined: 'Non retenu :'
      readonly forgotten: 'Oublié :'
      readonly view: 'Voir'
    }
    readonly scope: {
      readonly user: 'Vous · tous les projets'
      readonly project: 'Ce projet'
      readonly projectNamed: 'Ce projet · {{project}}'
    }
    readonly source: {
      readonly web: 'd’une page web'
      readonly webNamed: 'd’une page de {{host}}'
      readonly browser: 'd’une page du navigateur intégré'
      readonly mcp: 'd’un résultat du serveur MCP {{server}}'
      readonly attachment: 'd’une pièce jointe'
      readonly unknown: 'd’un contenu externe'
    }
    readonly type: {
      readonly user: 'Profil'
      readonly feedback: 'Préférence'
      readonly project: 'Projet'
      readonly reference: 'Référence'
    }
    readonly pill: 'Mémoire'
    readonly pillCount: 'Mémoire · {{count}}'
    readonly keyLocked: 'Bobine ne peut pas lire sa clé dans le trousseau : rien ne peut être retenu pour l’instant.'
  }
  readonly silenceBanner: {
    readonly title: 'L’agent n’a rien envoyé depuis {{minutes}} min'
    readonly detail: 'C’est normal pendant une longue commande ou une longue réflexion. Vous pouvez attendre, ou arrêter la réponse : la conversation est gardée.'
    readonly wait: 'Attendre'
    readonly stop: 'Arrêter'
  }
  readonly appAlert: {
    readonly internal: {
      readonly title_one: 'Bobine a rencontré un problème interne'
      readonly title_many: 'Bobine a rencontré {{count}} problèmes internes'
      readonly title_other: 'Bobine a rencontré {{count}} problèmes internes'
      readonly detail: 'Bobine continue de fonctionner, mais la dernière action a pu échouer. Si quelque chose semble bloqué, quittez et rouvrez Bobine.'
    }
    readonly crashed: {
      readonly title: 'Bobine s’est arrêtée de façon inattendue la dernière fois'
      readonly detail: 'Vos conversations sont gardées. Un rapport a été rangé sur ce Mac ; rien n’a été envoyé. Il peut contenir des extraits de vos conversations, voire des secrets (fin du journal, mémoire de Bobine dans les fichiers .dmp) : relisez-le avant de le joindre.'
      readonly show: 'Afficher le rapport'
    }
    readonly close: 'Fermer'
  }
  readonly crashReport: {
    readonly intro: 'Rapport local de Bobine : rien n’a été envoyé.'
    readonly privacy: 'Attention : la fin du journal peut contenir des extraits de vos conversations, et les minidumps (.dmp) une copie de la mémoire de Bobine au moment du plantage (conversations, voire clés ou jetons). Relisez avant de joindre, et ne donnez les .dmp qu’à quelqu’un de confiance.'
    readonly stopped: 'Lancement arrêté sans quitter : {{startedAt}} (pid {{pid}}, version {{version}})'
    readonly seen: 'Vu au lancement suivant : {{at}}'
    readonly dumps: 'Minidumps copiés : {{count}}'
    readonly logTail: '--- Fin du journal ({{lines}} dernières lignes) ---'
    readonly noLog: '(journal absent)'
    readonly unknown: 'inconnu'
  }
  readonly profile: {
    readonly readOnly: {
      readonly notice: 'Ce profil vient d’une version plus récente de Bobine. Celle-ci peut afficher vos conversations, mais pas en enregistrer : mettez Bobine à jour pour continuer.'
      readonly line: 'Lecture seule : cette version ne peut pas enregistrer.'
      readonly update: 'Mettre à jour Bobine'
      readonly refused: 'Lecture seule : cette version de Bobine ne peut pas enregistrer ce profil. Mettez Bobine à jour pour continuer.'
      readonly scheduled: 'Lecture seule : les tâches planifiées ne se lancent pas avec cette version de Bobine.'
      readonly noticeUnreadable: 'La version de ce profil est illisible : par prudence, Bobine l’ouvre sans rien y enregistrer. Vos conversations se relisent ; mettez Bobine à jour pour continuer.'
      readonly refusedShort: 'Cette version ne peut pas modifier ce profil.'
    }
    readonly notice: {
      readonly settingsDamaged: 'Vos réglages étaient illisibles : ils ont été mis de côté, et Bobine repart des réglages par défaut.'
      readonly approvalsDamaged: 'Les autorisations retenues étaient illisibles : elles ont été mises de côté. Bobine vous les redemandera.'
      readonly historyDamaged_one: 'Une partie de l’historique était illisible : elle a été mise de côté.'
      readonly historyDamaged_many: 'Une partie de l’historique était illisible : elle a été mise de côté.'
      readonly historyDamaged_other: 'Une partie de l’historique était illisible : elle a été mise de côté.'
      readonly indexRebuilt_one: 'La liste des conversations était illisible : elle a été refaite à partir de la conversation trouvée sur le disque.'
      readonly indexRebuilt_many: 'La liste des conversations était illisible : elle a été refaite à partir des {{count}} conversations trouvées sur le disque.'
      readonly indexRebuilt_other: 'La liste des conversations était illisible : elle a été refaite à partir des {{count}} conversations trouvées sur le disque.'
      readonly found_one: 'Une conversation absente de la liste a été retrouvée sur le disque.'
      readonly found_many: '{{count}} conversations absentes de la liste ont été retrouvées sur le disque.'
      readonly found_other: '{{count}} conversations absentes de la liste ont été retrouvées sur le disque.'
      readonly restored: 'Sauvegarde du {{date}} restaurée. Ce qu’il y avait avant est gardé à côté.'
      readonly restoreFailed: 'La sauvegarde n’a pas pu être restaurée : {{reason}}. Rien n’a changé.'
      readonly unsavedAtQuit_one: 'Au dernier arrêt, {{reason}} : les derniers messages de {{names}} n’ont pas pu être enregistrés.'
      readonly unsavedAtQuit_many: 'Au dernier arrêt, {{reason}} : les derniers messages de {{names}} n’ont pas pu être enregistrés.'
      readonly unsavedAtQuit_other: 'Au dernier arrêt, {{reason}} : les derniers messages de {{names}} n’ont pas pu être enregistrés.'
      readonly details: 'Détails'
      readonly dismiss: 'Fermer l’avis'
      readonly unreadable_one: 'Un fichier du profil n’a pas pu être lu : Bobine le laisse tel quel et n’y écrira pas avant le prochain lancement.'
      readonly unreadable_many: 'Des fichiers du profil n’ont pas pu être lus : Bobine les laisse tels quels et n’y écrira pas avant le prochain lancement.'
      readonly unreadable_other: 'Des fichiers du profil n’ont pas pu être lus : Bobine les laisse tels quels et n’y écrira pas avant le prochain lancement.'
      readonly restoreInterrupted: 'La restauration de la dernière fois a été interrompue : tout a été remis comme avant.'
    }
    readonly error: {
      readonly diskFull: 'le disque est plein'
      readonly noPermission: 'Bobine n’a pas le droit d’écrire dans ce dossier'
      readonly other: 'une erreur est survenue'
    }
    readonly names: {
      readonly one: '« {{a}} »'
      readonly two: '« {{a}} » et « {{b}} »'
      readonly three: '« {{a}} », « {{b}} » et « {{c}} »'
      readonly count_one: '{{count}} conversation'
      readonly count_many: '{{count}} conversations'
      readonly count_other: '{{count}} conversations'
    }
    readonly quit: {
      readonly title_one: '{{names}} n’est pas enregistrée'
      readonly title_many: '{{names}} ne sont pas enregistrées'
      readonly title_other: '{{names}} ne sont pas enregistrées'
      readonly detail_one: '{{reason}} : ses derniers messages seraient perdus. Libérez de la place, puis réessayez.'
      readonly detail_many: '{{reason}} : leurs derniers messages seraient perdus. Libérez de la place, puis réessayez.'
      readonly detail_other: '{{reason}} : leurs derniers messages seraient perdus. Libérez de la place, puis réessayez.'
      readonly retry: 'Réessayer'
      readonly discard_one: 'Quitter sans l’enregistrer'
      readonly discard_many: 'Quitter sans les enregistrer'
      readonly discard_other: 'Quitter sans les enregistrer'
      readonly diskFull: 'Le disque est plein'
      readonly failed: 'L’enregistrement a échoué'
    }
    readonly trashNotice: 'La session de cette conversation a été supprimée chez {{agent}} : elle continuera dans une session neuve, qui reçoit l’échange d’avant en texte.'
    readonly trash: {
      readonly alreadyThere: 'Cette conversation est déjà dans l’historique.'
      readonly missing: 'Cette conversation n’est plus dans la corbeille.'
    }
    readonly backup: {
      readonly insideProfile: 'Choisissez un dossier hors du dossier de données de Bobine.'
      readonly failed: 'La sauvegarde n’a pas pu se faire : {{reason}}. Rien n’a été gardé à moitié.'
    }
  }
  readonly approvalRules: {
    readonly card: {
      readonly toggle: 'Pour tous les projets'
      readonly toggleTools: 'Bobine, Bob IDE, Bob Shell'
      readonly prefixLabel: 'Commande, ou début de commande'
      readonly partsLabel: 'Bob compare chaque partie de cette commande à ses listes : choisissez celles à régler.'
      readonly partLabel: 'Partie {{n}}'
      readonly partInclude: 'Inclure la partie {{n}}'
      readonly prefixHint: 'Toute commande qui commence ainsi passera sans demander (ou sera refusée), dans tous vos projets.'
      readonly oneWord: 'Un seul mot : toute commande `{{word}}` passerait, y compris `{{example}}` ou un script qui en lance d’autres. Préférez la commande entière.'
      readonly firstTime: 'Première commande autorisée partout : Bobine active aussi « Commandes de la liste » pour tous les projets, comme la case Execute de Bob IDE (à partir de la prochaine conversation). Les commandes de lecture que Bob autorise d’office (`cat`, `ls`, `git status`…) passeront alors aussi sans demander.'
      readonly seeList: 'Voir la liste'
      readonly executeForbidden: 'Votre organisation interdit d’approuver les commandes sans demander : Bob demandera quand même.'
      readonly allow: 'Autoriser partout'
      readonly deny: 'Refuser partout'
      readonly nothingSelected: 'Choisissez au moins une partie.'
      readonly allowedDone_one: '{{command}} autorisée pour tous les projets'
      readonly allowedDone_many: '{{command}} autorisées pour tous les projets'
      readonly allowedDone_other: '{{command}} autorisées pour tous les projets'
      readonly deniedDone_one: '{{command}} refusée pour tous les projets'
      readonly deniedDone_many: '{{command}} refusées pour tous les projets'
      readonly deniedDone_other: '{{command}} refusées pour tous les projets'
      readonly manage: 'Gérer'
      readonly alreadyAllowed: 'déjà autorisée partout'
      readonly alreadyDenied: 'refusée partout'
      readonly coveredAllowed: '`{{command}}` : déjà autorisée partout'
      readonly coveredDenied: '`{{command}}` : refusée partout'
      readonly oneWordAny: 'Un seul mot : toute commande qui commence par `{{word}}` passerait, quels que soient ses arguments. Préférez la commande entière.'
      readonly confirmOneWord: 'Autoriser quand même'
      readonly whenNow: '« Autoriser partout » et « Refuser partout » s’appliquent tout de suite, y compris dans les conversations ouvertes. Cette carte reçoit aussi votre réponse : « {{always}} », ou « {{reject}} ».'
      readonly whenNext: '« Autoriser partout » vaut à partir de la prochaine conversation ; cette carte reçoit votre réponse « {{always}} ». « Refuser partout » s’applique tout de suite, et cette carte reçoit « {{reject}} ».'
    }
    readonly error: {
      readonly unsupported: 'Cet agent n’a pas de règles pour tous les projets.'
      readonly unreadable: 'Le fichier de réglages de Bob est illisible.'
      readonly 'invalid-json': 'Le fichier de réglages de Bob n’est pas du JSON valide.'
      readonly 'unexpected-format': 'Le fichier de réglages de Bob n’a pas la forme attendue.'
      readonly 'forbidden-group': 'Votre organisation interdit ce groupe : Bob demande à chaque fois.'
      readonly 'invalid-command': 'Commande vide ou trop longue.'
      readonly changed: 'Le fichier a changé pendant l’enregistrement (Bob IDE ouvert ?). Réessayez.'
      readonly 'write-failed': 'Le fichier n’a pas pu être enregistré.'
      readonly failed: 'Échec : {{message}}'
      readonly nothingWritten: 'Rien n’a été écrit.'
      readonly line: 'ligne {{line}}'
    }
    readonly page: {
      readonly entry: 'Approbations pour tous les projets'
      readonly entryHint: 'Groupes, commandes autorisées et refusées, partagés avec Bob IDE et Bob Shell.'
      readonly title: 'Approbations'
      readonly intro: 'Règles d’IBM Bob pour tous vos projets. Bob IDE et Bob Shell lisent le même fichier : ce que vous changez ici vaut aussi chez eux, et inversement. Une commande refusée l’est tout de suite ; une commande autorisée passe tout de suite si « Commandes de la liste » était déjà activé au début de la conversation, sinon à la prochaine ; les groupes valent à partir de la prochaine conversation.'
      readonly openFile: 'Ouvrir le fichier'
      readonly groups: 'Approuver sans demander, dans toutes les conversations'
      readonly outside: 'Aussi hors du dossier du projet'
      readonly outsideLabel: '{{group}} : aussi hors du dossier du projet'
      readonly forbidden: 'Interdit par votre organisation : Bob demande à chaque fois.'
      readonly autoOff: 'Bob a coupé les approbations automatiques dans ce fichier (« autoApprovalEnabled ») : il demande tout, quels que soient ces réglages.'
      readonly allowed: 'Commandes autorisées'
      readonly denied: 'Commandes refusées'
      readonly placeholder: 'Commande, ou début de commande'
      readonly add: 'Ajouter'
      readonly addLabel: 'Ajouter aux {{list}}'
      readonly editLabel: 'Modifier {{command}}'
      readonly removeLabel: 'Retirer {{command}}'
      readonly removeConfirm: 'Retirer {{command}} ?'
      readonly remove: 'Retirer'
      readonly count_one: '{{count}} commande'
      readonly count_many: '{{count}} commandes'
      readonly count_other: '{{count}} commandes'
      readonly showAll: 'Tout afficher'
      readonly none: 'Aucune commande.'
      readonly defaultBadge: 'liste par défaut de Bob'
      readonly defaultNote: 'Votre fichier n’a pas encore de liste : Bob utilise celle-ci. Ajouter, modifier ou retirer une commande l’écrit dans le fichier, avec ces commandes, comme le fait Bob IDE.'
      readonly securityNote: 'Bob IDE fait aussi vérifier chaque commande par un modèle avant de la lancer. Cette vérification n’a pas lieu quand Bob travaille dans Bobine : une commande de cette liste y passe sans elle.'
      readonly deniedHint: 'Bob refuse ces commandes sans vous les montrer, dans tous vos projets.'
      readonly unreadableHint: 'Bobine ne peut pas montrer ses règles et n’y écrit rien. Corrigez-le (ou ouvrez Bob IDE), puis relisez-le.'
      readonly reload: 'Relire'
      readonly cardsHidden: 'Sur les cartes de commande, « Pour tous les projets » est masqué tant que le fichier est illisible.'
      readonly group: {
        readonly read: 'Lecture'
        readonly readHint: 'Lire des fichiers, lister et chercher.'
        readonly edit: 'Modifications'
        readonly editHint: 'Créer, modifier, supprimer des fichiers.'
        readonly execute: 'Commandes de la liste'
        readonly executeHint: 'Seulement les commandes autorisées plus bas. Les autres sont toujours demandées.'
        readonly mcp: 'Outils MCP'
        readonly mcpHint: 'Un outil passe seulement s’il est aussi autorisé un par un dans les réglages MCP de Bob.'
        readonly mode: 'Changement de mode'
        readonly subtask: 'Sous-tâches'
        readonly subagent: 'Sous-agents'
        readonly skill: 'Skills'
        readonly todo: 'Liste de tâches'
      }
      readonly outsideEffect: 'L’activer autorise aussi Bob à travailler hors du dossier du projet : les autres groupes y demanderont votre accord explicite.'
      readonly outsideStillOn: 'Bob reste autorisé à travailler hors du dossier du projet : chaque outil y demande votre accord explicite.'
      readonly outsideTurnOff: 'Ne plus l’autoriser'
      readonly oneWordConfirm: 'Autoriser « {{word}} » partout ?'
    }
    readonly terminal: {
      readonly denied: 'Commande refusée partout par les règles de l’agent (« {{command}} ») : Bobine ne la lance pas non plus avec ses propres outils.'
    }
  }
  readonly roleForm: {
    readonly label: {
      readonly label: 'Nom'
      readonly placeholder: 'Expert sécurité'
      readonly missing: 'Donnez un nom au rôle.'
    }
    readonly name: {
      readonly label: 'Identifiant'
      readonly hint: 'Tapé après @ ; minuscules, chiffres et tirets.'
      readonly replaces: 'Remplacera le rôle « {{label}} » ({{scope}}) du même identifiant.'
    }
    readonly icon: 'Icône'
    readonly color: 'Couleur'
    readonly suggested: 'Suggérées d’après le nom : choisissez-en d’autres si vous voulez.'
    readonly description: {
      readonly label: 'Quand faire appel à lui ?'
      readonly hint: 'Une ou deux phrases. L’agent principal s’en sert pour choisir à qui confier un travail.'
      readonly placeholder: 'Relit le code sensible : authentification, secrets, entrées non fiables. À appeler avant de fusionner.'
      readonly goodTitle: 'Dit quand l’appeler'
      readonly goodText: '« À appeler avant de fusionner un changement qui touche la sécurité. »'
      readonly vagueTitle: 'Trop vague'
      readonly vagueText: '« Un expert en sécurité très compétent. »'
    }
    readonly prompt: {
      readonly label: 'Consigne'
      readonly hint: 'Reçue par le rôle au début de chaque conversation fille, avant votre demande. Markdown accepté.'
      readonly placeholder: 'Tu es… Pour chaque problème trouvé : où, pourquoi, quoi faire.'
    }
    readonly tools: {
      readonly label: 'Outils de Bobine'
      readonly all: 'Tous ceux de la conversation'
      readonly hint: 'Les questions et le lien avec la conversation mère restent toujours.'
    }
    readonly agent: {
      readonly label: 'Agent'
      readonly conversation: 'Celui de la conversation'
      readonly missing: '{{agent}} (indisponible)'
      readonly hint: 'Mode et modèle : laissez vide pour ceux de l’agent. Un mode que l’agent n’a pas est ignoré, la consigne part quand même.'
    }
    readonly mode: { readonly label: 'Mode' }
    readonly model: { readonly label: 'Modèle' }
    readonly agentDefault: 'Par défaut de l’agent'
    readonly readOnly: {
      readonly label: 'Lecture seule'
      readonly hint: 'Même dossier, sans worktree : Bobine refuse ses écritures et vérifie le dossier après chaque tour.'
      readonly requested: 'Avec {{agent}}, la lecture seule n’est que demandée : cet agent écrit sans demander d’autorisation. Bobine signale tout changement du dossier.'
    }
    readonly scope: {
      readonly label: 'Portée'
      readonly user: 'Personnel'
      readonly userHint: 'Dans tous mes projets, sur cet ordinateur.'
      readonly project: 'Ce projet · {{project}}'
      readonly projectNone: 'Ce projet'
      readonly projectHint: 'Partagé par git : .bobine/roles/'
      readonly projectMissing: 'Ouvrez une conversation dans un projet pour y enregistrer un rôle.'
    }
  }
  readonly roleWizard: {
    readonly title: 'Nouveau rôle'
    readonly description: 'Créer un rôle en trois étapes : qui, comment, avec quoi.'
    readonly steps: 'Étapes'
    readonly step: { readonly who: 'Qui'; readonly how: 'Comment'; readonly with: 'Avec quoi' }
    readonly templates: 'Partir d’un modèle'
    readonly blank: 'Page blanche'
    readonly blankHint: 'vous écrivez tout'
    readonly replacePrompt: 'Remplacer la consigne déjà écrite par celle de « {{label}} » ?'
    readonly replace: 'Remplacer'
    readonly discard: 'Abandonner ce rôle ? Ce qui a été saisi sera perdu.'
    readonly discardConfirm: 'Abandonner'
    readonly keepEditing: 'Continuer'
    readonly shortcut: '⌘ Entrée : étape suivante, ou créer'
    readonly shortcutKeys: '⌘↩'
    readonly back: 'Retour'
    readonly next: 'Suivant'
    readonly create: 'Créer'
    readonly createAndTry: 'Créer et essayer'
    readonly preview: {
      readonly title: 'Aperçu'
      readonly live: 'en direct'
      readonly unnamed: 'Nouveau rôle'
      readonly noDescription: 'Quand faire appel à lui…'
      readonly menu: 'Dans le menu @'
      readonly thread: 'Dans le fil, au travail'
      readonly reading: 'relit le code'
      readonly working: 'au travail'
      readonly sidebar: 'Dans la barre latérale'
      readonly childTitle: 'Relire le diff'
      readonly fileProject: 'Enregistré dans {{file}} : vos collègues le recevront avec le prochain git pull.'
      readonly fileUser: 'Enregistré dans vos rôles personnels ({{file}}), pour tous vos projets.'
    }
  }
  readonly rolesSettings: {
    readonly intro: 'Des agents spécialisés, appelés avec @ ou choisis par l’agent. Chacun travaille dans une conversation fille.'
    readonly new: 'Nouveau rôle'
    readonly userAside: 'tous vos projets'
    readonly builtinAside: '{{active}} sur {{total}} actifs'
    readonly group: {
      readonly project: 'Ce projet'
      readonly user: 'Personnels'
      readonly builtin: 'Fournis avec Bobine'
    }
    readonly scope: {
      readonly builtin: 'fourni'
      readonly user: 'personnel'
      readonly project: 'du projet'
    }
    readonly hides: 'Remplace un rôle {{scopes}}'
    readonly agentMissing: '{{agent}} absent'
    readonly readOnly: 'Lecture seule'
    readonly builtinDescription: {
      readonly uxUiExpert: 'Conçoit ou relit les interfaces : mise en page, hiérarchie, textes, accessibilité, cohérence avec le système de design existant.'
      readonly flutterExpert: 'Écrit ou corrige du code Flutter et Dart : widgets, gestion d’état, canaux de plateforme, tests.'
      readonly frontArchitect: 'Dessine l’architecture front : découpage des composants, état et flux de données, performances, build et dépendances.'
      readonly backArchitect: 'Dessine l’architecture back : API, modèle de données et migrations, cohérence, montée en charge, gestion des pannes.'
      readonly securityExpert: 'Audite la sécurité d’un changement ou d’un module (injection, secrets, authentification, permissions, dépendances). Ne modifie rien.'
      readonly techLead: 'Planifie et relit comme un tech lead exigeant : découpe le travail, repère les risques, vérifie robustesse et maintenabilité. Ne modifie rien.'
      readonly codeReviewer: 'Relit un changement avant fusion : justesse, tests, lisibilité, conventions du projet. Ne modifie rien.'
    }
    readonly enabled: '{{label}} : actif'
    readonly empty: {
      readonly title: 'Montez votre équipe'
      readonly text: 'Un expert sécu qui relit avant la fusion, un reviewer strict, un architecte… Créez-les une fois, appelez-les avec @ quand vous voulez. Les rôles fournis ci-dessous sont déjà prêts.'
      readonly action: 'Créer mon premier rôle'
    }
    readonly problems: { readonly title: 'Fichiers écartés' }
    readonly edit: {
      readonly missing: 'Ce rôle n’existe plus (fichier supprimé ou renommé).'
      readonly copyLabel: '{{label}} (copie)'
      readonly try: 'Essayer'
      readonly enableFirst: 'Activez d’abord ce rôle (Réglages › Rôles).'
      readonly saveFirst: 'Enregistrez d’abord vos changements.'
      readonly duplicate: 'Dupliquer'
      readonly delete: 'Supprimer'
      readonly deleteConfirm: 'Supprimer le rôle « {{label}} » ? Son fichier est effacé ; un rôle fourni du même nom reprend sa place.'
      readonly projectBanner: 'Partagé par git : vos changements seront à committer.'
      readonly builtinBanner: 'Rôle fourni : vos changements seront enregistrés en rôle personnel du même nom, qui le remplace.'
      readonly saved: 'Enregistré'
      readonly reset: 'Annuler les modifications'
      readonly saveAsUser: 'Enregistrer en rôle personnel'
    }
  }
  readonly team: {
    readonly title: 'Équipe'
    readonly new: 'Nouveau rôle…'
    readonly empty: 'Aucun rôle actif'
    readonly assign: 'Confier un travail à {{label}}'
    readonly roleTip: 'Rôle : {{label}}'
    readonly notHere: 'Une conversation fille ne confie pas de travail à un rôle : ouvrez sa conversation mère.'
  }
  readonly roles: {
    readonly none: 'aucun'
    readonly builtin: {
      readonly uxUiExpert: 'Expert UX/UI'
      readonly flutterExpert: 'Expert Flutter'
      readonly frontArchitect: 'Architecte front-end'
      readonly backArchitect: 'Architecte back-end'
      readonly securityExpert: 'Expert sécurité'
      readonly techLead: 'Tech lead'
      readonly codeReviewer: 'Code reviewer'
    }
    readonly error: {
      readonly noHeader: 'Pas d’en-tête : le fichier doit commencer par une ligne « --- ».'
      readonly syntax: 'Ligne {{line}} illisible dans l’en-tête.'
      readonly unknownField: 'Champ inconnu dans l’en-tête : {{field}}.'
      readonly duplicateField: 'Champ répété dans l’en-tête : {{field}}.'
      readonly name: 'Nom invalide : minuscules, chiffres et tirets, 40 caractères au plus.'
      readonly label: 'Libellé trop long (40 caractères au plus).'
      readonly icon: 'Icône invalide : un nom d’icône Lucide, comme « shield-check ».'
      readonly color: 'Couleur invalide : orange, blue, violet, pink, green ou graphite.'
      readonly description: 'Description manquante ou trop longue (300 caractères au plus).'
      readonly value: 'Valeur invalide pour {{field}}.'
      readonly readOnly: '« read-only » attend true ou false.'
      readonly mcp: 'Famille d’outils inconnue dans « mcp » : {{field}}.'
      readonly prompt: 'Consigne manquante ou trop longue (20 000 caractères au plus).'
      readonly tooLarge: 'Fichier trop gros (64 Ko au plus).'
      readonly duplicateName: 'Un autre rôle porte déjà ce nom à cet endroit.'
      readonly unreadable: 'Fichier illisible.'
      readonly unknownRole: 'Rôle inconnu ou désactivé : {{name}}. Rôles : {{roles}}.'
      readonly noProject: 'Cette conversation n’a pas de dossier de projet.'
      readonly builtinFile: 'Un rôle fourni ne s’écrit ni ne se supprime : désactivez-le, ou enregistrez un rôle personnel du même nom.'
      readonly notWritten: 'Rôle non enregistré : le profil est en lecture seule.'
      readonly link: 'Lien symbolique refusé : un rôle ne se lit ni ne s’écrit à travers un lien.'
      readonly tooMany: 'Plus de 100 rôles dans ce dossier : les suivants ne sont pas lus.'
    }
    readonly notice: {
      readonly writeRefused: 'Écriture refusée par Bobine : ce rôle est en lecture seule ({{tool}}).'
      readonly readOnlyRequested: 'Lecture seule seulement demandée : {{agent}} écrit sans demander d’autorisation. Bobine vérifie le dossier après chaque tour et signale tout changement.'
      readonly folderChanged: 'Le dossier a changé pendant le tour de ce rôle en lecture seule. Vérifiez les modifications (git status).'
      readonly childFolderChanged: 'Le dossier a changé pendant le tour de « {{title}} », un rôle en lecture seule qui travaille dans ce dossier. Vérifiez les modifications (git status).'
      readonly agentMissing: 'Agent du rôle « {{agent}} » indisponible ici : la fille travaille avec l’agent de cette conversation.'
      readonly modelMissing: 'Modèle du rôle « {{model}} » impossible à choisir ici : l’agent prend son propre modèle.'
      readonly modeMissing: 'L’agent n’a pas le mode « {{mode}} » du rôle : la fille travaille dans le mode courant, avec la consigne du rôle.'
      readonly projectOverrides: 'Le rôle « {{name}} » vient du projet et remplace un rôle fourni ou personnel du même nom.'
      readonly watchFailed: 'La surveillance du dossier n’a pas pu se faire pour ce tour (git en échec ou trop lent) : vérifiez vous-même qu’aucun fichier n’a changé (git status).'
    }
  }
}
