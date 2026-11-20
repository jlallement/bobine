/**
 * Lecture de l'écran de Bobine, dans la page : un objet JSON brut (pas de mise en forme ici, voir
 * `etat.mjs`). Une seule évaluation par lecture, sans rien modifier dans la page.
 *
 * Repères lus, du plus stable au moins stable :
 * - `data-testid` posés pour les essais e2e (`working`, `permission`, `turn-summary`, `side-panel`,
 *   `history-item`, `blocker-*`, `app-alert-*`, `stalled-notice`, `silence-banner`, `turn-retry`…) ;
 * - attributs d'état (`data-status`, `data-kind`, `data-activity`, `data-tab`, `aria-current`) ;
 * - quelques classes structurelles des cartes (`permission-card`, `pc-title`, `pc-actions`,
 *   `msg-user`, `msg-agent`, `notice-error`, `status-dot`).
 * Aucun texte de l'interface n'est cherché ici : la page est lue telle qu'elle s'affiche, dans sa
 * langue.
 */

/* global document, getComputedStyle, Node, location */
import { MAIN_MARKER } from './cdp.mjs'

/**
 * Fonction exécutée dans la page (sérialisée par `toString`) : elle ne doit rien capturer.
 * `main` : la page est bien la fenêtre principale de Bobine (`MAIN_MARKER`, évalué dans la page).
 */
function readScreen(main) {
  const $ = (sel, root = document) => root.querySelector(sel)
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
  const clean = (s) => (s ?? '').replace(/[ \s]+/g, ' ').trim()
  const visible = (e) => {
    if (!e) return false
    const b = e.getBoundingClientRect()
    return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden'
  }
  const text = (e) => clean(e?.innerText)
  const label = (e) => clean(e.getAttribute('aria-label') || e.innerText || e.title)
  const buttons = (root) =>
    $$('button, [role=button]', root)
      .filter((b) => visible(b) && !b.disabled && label(b))
      .map(label)
  const after = (a, b) => !b || !!(b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING)

  // Les suites d'un travail (« Répondre à … ») sont dans sa carte, pas des messages du fil (263).
  const users = $$('.msg-user').filter((e) => !e.closest('.work-follow-up'))
  const lastUser = users.at(-1)
  const sinceUser = (list) => list.filter((e) => after(e, lastUser))

  const dot = $('.agent-avatar .status-dot')
  const shot = {
    at: Date.now(),
    main,
    url: location.href,
    lang: document.documentElement.lang || 'fr',
    agent: {
      name: text($('.sidebar-footer .name')),
      status: text($('[data-testid=agent-status]')),
      dot: dot ? [...dot.classList].filter((c) => c !== 'status-dot').join(' ') : ''
    },
    temporary: !!$('[data-testid=temporary-profile]'),
    title: text($('[data-testid=title-menu]')),
    welcome: visible($('[data-testid=welcome]'))
  }

  const onboarding = $('[data-testid=onboarding]')
  if (visible(onboarding)) {
    const center = $('.onboarding-center', onboarding)
    const title = text($('.onboarding-title', onboarding))
    const actions = new Set(buttons(center))
    shot.onboarding = {
      step: text($('.onboarding-stepper [aria-current=step] .label', onboarding)),
      title,
      // Le texte de l'étape sans son titre ni ses boutons (dits à part).
      text: clean(
        (center?.innerText ?? '')
          .split('\n')
          .filter((line) => clean(line) && clean(line) !== title && !actions.has(clean(line)))
          .join(' · ')
      ),
      error: text($('.onboarding-text.error', onboarding)),
      waiting: visible($('[data-testid=onboarding-waiting]', onboarding)),
      // Choix (agents) : le nom, et celui qui est coché.
      choices: $$('input[type=radio]', center).map((r) => ({
        label: clean((r.closest('label')?.innerText ?? r.value).split('\n')[0]),
        checked: r.checked
      })),
      buttons: buttons(center)
    }
  }

  const bar = $('[data-testid=composer-bar]')
  if (bar) {
    shot.chips = {
      mode: text($('[data-testid=mode-chip]', bar)),
      model: text($('[data-testid=model-chip]', bar)),
      agent: text($('[data-testid=agent-menu]', bar))
    }
  }
  const input = $('[data-testid=composer-input]')
  shot.composer = input
    ? { present: true, draft: clean(input.value).length, disabled: !!input.disabled }
    : { present: false }
  shot.queued = $$('[data-testid=queued-item]').length

  const working = $('[data-testid=working]')
  if (visible(working)) {
    shot.working = {
      label: text($('.working-label', working)),
      time: text($('.working-time', working)),
      activity: working.dataset.activity ?? ''
    }
  }
  // Travail après le tour (fiche 261) : dit par le pied de la réponse, plus par l'indicateur du bas.
  const stillWorking = $$('[data-testid=turn-working]').at(-1)
  if (stillWorking) shot.turnWorking = text(stillWorking)
  const summary = $$('[data-testid=turn-summary]').at(-1)
  if (summary && after(summary, lastUser)) shot.turnSummary = text(summary)
  // Tour arrêté par la limite d'étapes de l'agent (fiche 209) : le titre de sa carte.
  const limit = $$('[data-testid=turn-limit-card]').at(-1)
  if (limit && after(limit, lastUser)) shot.turnLimit = text($('strong', limit))
  const duration = $$('[data-testid=turn-duration]').at(-1)
  if (duration && after(duration, lastUser)) shot.turnDuration = text(duration)
  shot.messages = users.length
  // Cartes-réponses des travaux confiés à des rôles (fiche 263) : rôle, état, début de la réponse.
  // Sans les cartes dépliées dans une carte de groupe : elles sont ses lignes (fiche 264).
  const works = $$('[data-testid=work-card]:not(.in-group)').map((card) => ({
    role: card.dataset.role ?? '',
    state: card.dataset.state ?? '',
    answer: clean($$('[data-testid=work-body]', card).at(-1)?.innerText).slice(0, 300)
  }))
  if (works.length) shot.works = works
  // Cartes de groupe (fiche 264) : titre, étape, comptes, une ligne par travail (proposé ou lancé,
  // dans l'ordre), et la fusion (progression, résultat) quand elle est dans la carte.
  const workGroups = $$('[data-testid=work-group]').map((g) => ({
    title: text($('[data-testid=work-group-title]', g)),
    stage: g.dataset.stage ?? '',
    counts: text($('[data-testid=work-group-counts]', g)).replace(/^·\s*/, ''),
    rows: $$('[data-testid=work-row], [data-testid=proposal-row]', g).map((r) =>
      r.dataset.testid === 'work-row'
        ? {
            name: text($('[data-testid=work-row-name]', r)),
            state: r.dataset.state ?? '',
            merge: text($('[data-testid=subtask-merge-state]', r))
          }
        : { name: r.dataset.title ?? '', state: `proposé:${r.dataset.outcome ?? ''}`, merge: '' }
    ),
    merge: text($('[data-testid=subtasks-merge-progress], [data-testid=subtasks-merge-result]', g)),
    buttons: buttons($('.work-group-foot, .work-group-merge', g) ?? document.createElement('i'))
  }))
  if (workGroups.length) shot.groups = workGroups
  // Une fusion avance (carte de groupe ou de travail, « Sous-tâches ») : `attendre` attend.
  shot.merging = !!$(
    '[data-testid=subtasks-merge][data-status=running], [data-testid=subtasks-merge][data-status=stopping], [data-testid=work-merge][data-status=running]'
  )
  if (lastUser) shot.lastUser = text(lastUser).slice(0, 120)

  const agentMessages = sinceUser($$('.msg-agent'))
  const lastAgent = agentMessages.at(-1) ?? (lastUser ? undefined : $$('.msg-agent').at(-1))
  if (lastAgent) shot.lastAgent = clean(lastAgent.innerText)

  // Outils du tour en cours (depuis le dernier message de l'utilisateur).
  const tools = sinceUser($$('[data-testid=tool]')).filter((t) => !t.closest('.tool-group-items'))
  const groups = sinceUser($$('[data-testid=tool-group]'))
  shot.tools = {
    items: tools.map((t) => ({
      kind: t.dataset.kind ?? '',
      status: t.dataset.status ?? '',
      // Infobulle du libellé : chemin complet, puis le libellé lisible (dernière ligne).
      label: clean(
        ($('[data-testid=tool-label]', t)?.title ?? '').split('\n').at(-1) ||
          ($('[data-testid=tool-label]', t) ?? t).innerText
      ).slice(0, 100)
    })),
    grouped: groups.reduce((n, g) => n + Number(g.dataset.count || 0), 0),
    groupSummary: text(
      $('[data-testid=tool-group-summary]', groups.at(-1) ?? document.createElement('i'))
    )
  }

  // Cartes qui attendent une réponse : autorisation, question, plan, propositions.
  // « Tâches proposées » (fiche 124) : ses boutons sont sur les lignes, pas dans son pied (qui ne
  // porte que l'aide clavier, et seulement tant qu'une ligne attend) ; elle garde ses lignes
  // décidées (« Lancer » d'une ligne refusée) : elle n'attend que si une ligne est encore en
  // attente (`data-pending`), et ses boutons sont ceux de ces lignes (fiche 248).
  // Carte de groupe (fiche 264) : ses lignes en attente, puis « Tout lancer » de son pied.
  const actions = (c) =>
    c.dataset.testid === 'work-group'
      ? Number(c.dataset.pending || 0) > 0
        ? [
            ...new Set([
              ...$$('[data-outcome=pending] .proposal-actions', c).flatMap((row) => buttons(row)),
              ...buttons($('.work-group-foot', c) ?? document.createElement('i'))
            ])
          ]
        : []
      : buttons($('.pc-actions', c) ?? c)
  shot.cards = $$('.permission-card, [data-testid=work-group]')
    .filter((c) => !c.matches('[data-testid=work-group][data-pending="0"]'))
    .filter((c) => visible(c) && actions(c).length)
    .map((c) => {
      const type =
        c.dataset.testid === 'permission'
          ? 'autorisation'
          : c.classList.contains('question-card')
            ? 'question'
            : c.classList.contains('plan-card')
              ? 'plan'
              : c.dataset.testid === 'work-group'
                ? 'propositions'
                : 'carte'
      const diff = $('[data-testid=diff-path]', c)
      const card = {
        type,
        title: text($('.pc-title, [data-testid=work-group-title]', c)),
        sub: text($('.pc-sub', c)),
        command: text($('[data-testid=command-text]', c)),
        cwd: clean(
          $('[data-testid=command-cwd]', c)?.getAttribute('title') ||
            text($('[data-testid=command-cwd-text]', c))
        ),
        warnings: $$('.cmd-warn', c).map(text).filter(Boolean),
        file: clean(diff?.getAttribute('title')),
        stats: text($('.diff-stats', c)),
        question: text($('[data-testid=question-text]', c)),
        choices: $$('[data-testid=choice]', c).map(text).filter(Boolean),
        note: text($('.pc-note', c)),
        buttons: actions(c)
      }
      if (!card.command && !card.file && !card.question) {
        card.body = text($('.pc-body', c)).slice(0, 300)
      }
      return card
    })
  // Proposition de souvenir (fiche 182) : « Retenir ce souvenir ? » / « Oublier ce souvenir ? ».
  // Décidée, elle devient une ligne (`memory-decided`) : seule la carte attend (fiche 248).
  for (const c of $$('[data-testid=memory-card]').filter(visible)) {
    shot.cards.push({
      type: 'souvenir',
      title: text($('.memory-card-title strong', c)),
      sub: text($('.memory-card-who', c)),
      body: [text($('.memory-card-description', c)), text($('.memory-body', c))]
        .filter(Boolean)
        .join(' — '),
      warnings: $$('[data-testid=memory-banner]', c).map(text).filter(Boolean),
      buttons: buttons($('.memory-card-actions', c) ?? c)
    })
  }
  shot.questions = visible($('[data-testid=elicitation]')) && !shot.cards.length
  shot.blockers = $$('[data-testid^=blocker-]')
    .filter(visible)
    .map((b) => ({ id: b.dataset.testid, text: text(b).slice(0, 400), buttons: buttons(b) }))

  // Bandeaux, avis et erreurs : ce qu'un humain remarquerait.
  const alerts = []
  const push = (kind, e) => visible(e) && alerts.push({ kind, text: text(e).slice(0, 300) })
  $$('[data-testid^=app-alert-]')
    .filter((e) => e.classList.contains('app-alert'))
    .forEach((e) => push('bandeau', e))
  push('silence', $('[data-testid=silence-banner]'))
  push('relance', $('[data-testid=turn-retry]'))
  push('bloque', $('[data-testid=stalled-notice]'))
  push('plafond', $('[data-testid=cost-cap-card]'))
  // Limite d'étapes (fiche 209) : seulement la carte qui attend une réponse (avec ses boutons).
  push(
    'limite',
    $$('[data-testid=turn-limit-card]').findLast((c) => $('button', c))
  )
  push('plantage', $('[data-testid=crash-screen]'))
  $$('[data-testid=pane-error]').forEach((e) => push('panneau', e))
  sinceUser($$('.notice-error')).forEach((e) => push('erreur', e))
  sinceUser($$('.notice-warning')).forEach((e) => push('avis', e))
  shot.alerts = alerts

  const panel = $('[data-testid=side-panel]')
  if (visible(panel)) {
    const running = $('[data-testid=session-running]', panel)
    shot.panel = {
      tabs: $$('.side-panel-tab', panel).map((t) => ({
        id: t.dataset.tab ?? '',
        label: label($('.side-panel-tab-main', t) ?? t),
        count: text($('.side-panel-tab-count', t)),
        active: t.classList.contains('active')
      })),
      running: running
        ? clean(
            [...running.children]
              .slice(1)
              .map((e) => e.innerText)
              .join(' ')
          )
        : '',
      changes: text($('[data-testid=changes-summary]', panel))
    }
  }

  shot.sidebar = $$('[data-testid=history-item]').map((item) => {
    const state = $('.row-meta .child-state', item)
    return {
      title: text($('.label', item)),
      active: item.classList.contains('active'),
      unread: item.classList.contains('unread'),
      state: state ? clean(state.getAttribute('aria-label') || state.dataset.state) : '',
      code: state?.dataset.state ?? ''
    }
  })

  const settings = $('[data-testid=settings]')
  if (visible(settings)) {
    shot.settings =
      text($('[data-testid=settings-heading]', settings)) ||
      text($('.settings-nav-item.active', settings))
  }
  shot.dialogs = $$('[role=dialog], [role=alertdialog]')
    .filter((d) => visible(d) && d !== settings && !settings?.contains(d))
    .map((d) => ({
      title: clean(
        d.getAttribute('aria-label') ||
          text($('h1, h2, h3, [class*=title]', d)) ||
          d.innerText.split('\n')[0]
      ).slice(0, 120),
      buttons: buttons(d).slice(0, 8)
    }))
  shot.menu = $$('[role=menu]')
    .filter(visible)
    .flatMap((m) => $$('[role^=menuitem]', m).map(text))
    .slice(0, 15)
  return shot
}

/** Expression à évaluer dans la page. */
export const READ_SCREEN = `(${readScreen.toString()})(${MAIN_MARKER})`
