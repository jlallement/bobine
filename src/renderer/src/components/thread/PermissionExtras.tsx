import { Circle, CircleCheck, CircleDot, Plug } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { visibleText } from '@shared/command-view'
import type { TodoItem } from '@shared/todos'
import type { ToolArg } from '@shared/tool-args'

const ICONS = { completed: CircleCheck, in_progress: CircleDot, pending: Circle } as const
const CLASSES = { completed: 'done', in_progress: 'doing', pending: 'todo' } as const
const LABELS = {
  completed: 'toolCall.todos.done',
  in_progress: 'toolCall.todos.inProgress',
  pending: 'toolCall.todos.pending'
} as const

/**
 * Tâches d'une mise à jour de la liste de tâches (fiche 214, maquette validée), lues dans
 * `rawInput.todos` sans regarder le titre ni le genre : fait (cercle coché), en cours (cercle
 * pointé, texte appuyé), à faire (cercle vide), avec un compte. L'état est aussi dit au lecteur
 * d'écran (texte caché) : rien n'est dit par l'icône seule. Texte des tâches : celui de l'agent.
 */
export function TodosView({ todos }: { todos: readonly TodoItem[] }) {
  const { t } = useTranslation()
  const count = (state: TodoItem['state']) => todos.filter((todo) => todo.state === state).length
  return (
    <>
      <ul className="pc-todos" data-testid="permission-todos">
        {todos.map((todo, i) => {
          const Icon = ICONS[todo.state]
          return (
            <li key={i} className={CLASSES[todo.state]} data-state={todo.state}>
              <Icon size={15} aria-hidden />
              <span>
                <span className="sr-only">{t(LABELS[todo.state])} </span>
                {visibleText(todo.text)}
              </span>
            </li>
          )
        })}
      </ul>
      <div className="pc-todos-count" data-testid="permission-todos-count">
        {[
          t('toolCall.todos.doneCount', { count: count('completed') }),
          t('toolCall.todos.doingCount', { count: count('in_progress') }),
          t('toolCall.todos.todoCount', { count: count('pending') })
        ].join(' · ')}
      </div>
    </>
  )
}

/**
 * Arguments envoyés à un outil que l'app ne sait pas lire autrement (outil MCP, skill, mode de
 * Bob ; fiche 214) : tels que reçus, clés et valeurs, pour savoir ce qu'on autorise.
 */
export function ToolArgsView({ args }: { args: readonly ToolArg[] }) {
  const { t } = useTranslation()
  return (
    <div className="pc-args" data-testid="permission-args">
      <div className="pc-args-bar">
        <Plug size={13} aria-hidden /> {t('toolCall.permission.args')}
      </div>
      <dl>
        {args.map((arg) => (
          <div key={arg.name} className="pc-arg">
            <dt>{visibleText(arg.name)}</dt>
            <dd>{visibleText(arg.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
