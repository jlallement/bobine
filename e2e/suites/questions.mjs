import { L, check, withApp } from '../lib.mjs'

/** Questions à choix et plan à valider, comme dans Claude Code (fiche 016). */
export async function questionsSuite(scheme) {
  console.log(`\n— Questions et plan (${scheme})`)
  await withApp(scheme, async (ui) => {
    await ui.ready()
    // Maj+Tab : mode suivant (Code → Question)
    const mode = () => ui.ev(`${ui.$('mode-chip')}?.innerText.trim()`)
    const before = await mode()
    await ui.ev(`${ui.$('composer-input')}.focus()`)
    await ui.press('Tab', 8)
    await ui.waitFor(`${ui.$('mode-chip')}?.innerText.trim() !== ${JSON.stringify(before)}`)
    check(true, `Maj+Tab : mode suivant (${before} → ${await mode()})`)

    // Questions : clavier puis souris
    await ui.send('/scenario questions')
    await ui.waitFor(`!!${ui.$('questions')}`)
    check(
      !(await ui.ev(
        `[...document.querySelectorAll('[data-testid=tool]')].some((t) => t.innerText.includes('AskUserQuestion'))`
      )),
      'la carte de questions remplace l’appel d’outil qui la pose'
    )
    check(
      (await ui.ev(`document.querySelectorAll('[data-testid=choice]').length`)) === 2,
      'options numérotées avec description'
    )
    await ui.shot('10-questions')
    await ui.press('2') // « Coloré » → question suivante
    await ui.waitFor(`${ui.$('question-text')}.innerText.includes('pages')`)
    check(true, 'touche 2 : option choisie, passage à la question suivante')
    const choice = (label) =>
      `[...document.querySelectorAll('[data-testid=choice]')].find((c) => c.innerText.includes('${label}'))`
    await ui.click(choice('Accueil'))
    await ui.click(choice('Tarifs'))
    await ui.click(ui.$('choice-other'))
    await ui.type('Blog')
    await ui.shot('11-questions-multiple')
    await ui.click(ui.$('questions-next'))
    await ui.waitFor(`!!${ui.$('elicitation-answer')}`)
    await ui.ready()
    check(
      (await ui.lastAgentText()).includes('style : Coloré ; pages : Accueil, Tarifs, Blog'),
      'réponses envoyées à l’agent (choix unique, multiple, « Autre »)'
    )
    check(
      (await ui.ev(`${ui.$('elicitation-answer')}.innerText`)).includes(
        `Accueil, Tarifs, ${L('question.customAnswer', { text: 'Blog' })}`
      ),
      'résumé « question → réponse » dans le fil'
    )

    // OpenCode 2 (fiche 078) : son outil question passe par un formulaire, montré en questionnaire.
    await ui.send('/scenario question-opencode2')
    await ui.waitFor(
      `!!${ui.$('questions')} && ${ui.$('question-text')}?.innerText.includes('langage')`
    )
    await ui.shot('12-question-opencode2')
    await ui.click(choice('Rust'))
    // Choix unique : le clic envoie déjà la réponse et démonte le questionnaire.
    await ui.waitFor(`!${ui.$('questions')}`)
    await ui.ready()
    check(
      (await ui.lastAgentText()).includes('Langage choisi : Rust.'),
      'OpenCode 2 : question de son outil « question » en questionnaire, réponse renvoyée'
    )

    // Plan : continuer à planifier, puis approuver
    await ui.send('/scenario plan-a-valider')
    await ui.waitFor(`!!${ui.$('plan-approval')}`)
    check(
      (await ui.ev(`${ui.$('plan-doc')}.innerText`)).includes('page de contact'),
      'plan affiché en clair avant validation'
    )
    await ui.shot('12-plan')
    await ui.press('3')
    await ui.ready()
    check(
      (await ui.lastAgentText()).includes('je continue à planifier'),
      'touche 3 : « No, keep planning » transmis'
    )
    await ui.send('/scenario plan-a-valider')
    await ui.waitFor(`!!${ui.$('plan-approval')}`)
    await ui.click(`document.querySelector('[data-testid=plan-choice]')`)
    await ui.ready()
    check(
      (await ui.lastAgentText()).includes('je passe à l’action') && (await mode()) === 'Code',
      'plan approuvé → l’agent repasse en mode Code'
    )
    await ui.shot('13-plan-valide')

    // Question obligatoire au format générique, puis plan dans rawInput (fiche 140)
    await ui.send('/scenario question-plan')
    await ui.waitFor(`!!${ui.$('questions')}`)
    check(
      (await ui.ev(`${ui.$('question-text')}.innerText`)) === 'Which shell should hello.sh use?' &&
        (await ui.ev(`${ui.$('questions-next')}.disabled`)),
      'question reconnue ; réponse obligatoire : « Envoyer » attend un choix'
    )
    await ui.press('1')
    await ui.waitFor(`!!${ui.$('plan-approval')}`)
    check(
      (await ui.ev(`${ui.$('plan-doc')}.innerText`)).includes('hello.sh'),
      'plan (rawInput.plan) affiché'
    )
    await ui.press('1')
    await ui.ready()
    check((await ui.lastAgentText()).includes('Je mets le plan en œuvre'), 'plan approuvé')

    // Question posée par l'agent avec l'outil ask_user fourni par l'app (serveur MCP, fiche 028)
    await ui.send('/scenario question-bob')
    await ui.waitFor(`!!${ui.$('questions')}`)
    check(
      !(await ui.ev(`!!${ui.$('permission')}`)) &&
        (await ui.ev(`${ui.$('question-text')}.innerText`)).includes('Quel shell'),
      'ask_user (MCP) : carte de questions, sans demande d’autorisation'
    )
    await ui.shot('21-question-bob')
    await ui.press('2')
    await ui.ready()
    check(
      (await ui.lastAgentText()).includes('The user chose: zsh.'),
      'ask_user (MCP) : la réponse revient à l’agent comme résultat de l’outil'
    )
  })
}
