/** Outil `ask_user` (fiche 028) : premier outil de l'app, la question passe par l'hôte d'agent. */
import { ASK_USER_DEFINITION, parseAskUserArgs, type AskUserArgs } from '@shared/ask-user'
import { textResult, type AppTool, type AppToolModule } from './tools'

type Ask = (args: AskUserArgs) => Promise<{ text: string; isError?: boolean }>

/**
 * Module « questions » : toujours proposé, jamais soumis à l'accord (c'est une question), et jamais
 * coupé (c'est par lui que l'agent pose ses questions, et il pèse peu, fiche 109).
 */
export function askUserModule(ask: Ask): AppToolModule {
  return {
    id: 'ask-user',
    required: true,
    about: {
      title: 'appToolFamilies.ask-user.title',
      summary: 'appToolFamilies.ask-user.summary',
      condition: 'appToolFamilies.always'
    },
    tools: () => [askUserTool(ask)]
  }
}

export function askUserTool(ask: Ask): AppTool {
  return {
    definition: ASK_USER_DEFINITION,
    // Ne fait que poser une question à l'utilisateur.
    autoAllow: true,
    call: async (args) => {
      const { text, isError } = await ask(parseAskUserArgs(args))
      return textResult(text, isError)
    }
  }
}
