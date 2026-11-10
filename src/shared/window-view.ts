/**
 * Vue d'une fenêtre du renderer, posée par le main sur sa ligne de commande et lue par le preload
 * (pas par la page) : la fenêtre d'aide (fiche 186) n'expose qu'une API réduite.
 */
export const VIEW_ARG = '--bobine-view='

export const viewArgument = (view: 'help'): string => `${VIEW_ARG}${view}`

export const viewFromArgv = (argv: readonly string[]): string | undefined =>
  argv.find((arg) => arg.startsWith(VIEW_ARG))?.slice(VIEW_ARG.length)
