import { FitAddon } from '@xterm/addon-fit'
import { Terminal, type ITheme } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { MessageSquarePlus, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { DEFAULT_PREFERENCES, type Preferences } from '@shared/preferences'
import type { TerminalTabInfo } from '@shared/terminal'
import { Tip } from '../common/Menus'
import { currentTokens, subscribeTheme } from '../../theme'
import { useTranslation } from 'react-i18next'
import { loadTerminalSymbols, terminalFontCss, terminalSymbolsSettled } from '../../appearance'

/** Police choisie dans les réglages (fiches 027, 136), sinon la liste par défaut. */
const fontOf = (preferences?: Preferences) => terminalFontCss(preferences?.terminalFontFamily)

/** Évènement qui ajoute un texte à la zone de saisie (extrait de terminal joint au message). */
export const INSERT_TEXT_EVENT = 'bob:insert-text'

const ANSI_NAMES = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'brightBlack',
  'brightRed',
  'brightGreen',
  'brightYellow',
  'brightBlue',
  'brightMagenta',
  'brightCyan',
  'brightWhite'
] as const

/** Couleurs du terminal : les jetons du thème affiché (palette, accent, ANSI ; fiche 134). */
function themeOf(): ITheme {
  const t = currentTokens()
  const theme: ITheme = {
    background: t.surface,
    foreground: t.text,
    cursor: t.accent,
    cursorAccent: t.surface,
    selectionBackground: `${t.accent}55`
  }
  ANSI_NAMES.forEach((name, i) => (theme[name] = t.ansi[i]))
  return theme
}

interface Instance {
  term: Terminal
  fit: FitAddon
  element: HTMLDivElement
}

/**
 * Focus clavier sur un terminal, seulement quand l'utilisateur le choisit : un onglet ouvert par
 * l'agent ne vole jamais le clavier (la zone de saisie ou une question en cours le gardent).
 */
function focusSoon(map: Map<string, Instance>, id: string): void {
  requestAnimationFrame(() => map.get(id)?.term.focus())
}

/** Seule l'instance de l'onglet actif est affichée (les autres gardent leur état). */
function showOnly(map: Map<string, Instance>, active: string): void {
  for (const [id, instance] of map) instance.element.hidden = id !== active
}

/**
 * Onglet « Terminal » (fiche 034), comme le terminal de Claude Desktop : des shells dans le dossier de
 * la conversation, que l'agent peut lire et où il peut lancer des commandes.
 */
export function TerminalTab({
  conversationId,
  focusRequested,
  onFocused,
  preferences
}: {
  conversationId: string
  /** Police et taille du texte (réglages). */
  preferences?: Preferences
  /** L'utilisateur vient d'ouvrir le terminal (bouton « >_ ») : lui donner le clavier. */
  focusRequested?: boolean
  onFocused?: () => void
}) {
  const { t } = useTranslation()
  const [tabs, setTabs] = useState<TerminalTabInfo[] | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [selection, setSelection] = useState('')
  // Police des icônes chargée avant la première instance (fiche 201) : xterm.js garde la largeur
  // mesurée de chaque caractère, une icône mesurée trop tôt resterait un carré.
  const [symbolsReady, setSymbolsReady] = useState(terminalSymbolsSettled)
  useEffect(() => {
    if (symbolsReady) return
    let alive = true
    void loadTerminalSymbols().then(() => alive && setSymbolsReady(true))
    return () => {
      alive = false
    }
  }, [symbolsReady])
  const host = useRef<HTMLDivElement>(null)
  const instances = useRef(new Map<string, Instance>())
  // Dernières préférences, lues à la création d'une instance.
  const fontRef = useRef(preferences)
  useEffect(() => {
    fontRef.current = preferences
  })
  // Police ou taille changées : toutes les instances suivent, puis se réajustent.
  const family = fontOf(preferences)
  const size = preferences?.terminalFontSize ?? DEFAULT_PREFERENCES.terminalFontSize
  useEffect(() => {
    for (const [tabId, instance] of instances.current) {
      if (instance.term.options.fontFamily === family && instance.term.options.fontSize === size) {
        continue
      }
      instance.term.options.fontFamily = family
      instance.term.options.fontSize = size
      if (!instance.element.hidden) {
        instance.fit.fit()
        void window.api.terminal.resize(
          conversationId,
          tabId,
          instance.term.cols,
          instance.term.rows
        )
      }
    }
  }, [family, size, conversationId])

  // Onglets de la conversation ; un shell s'ouvre si aucun n'existe. Un onglet qui apparaît (celui
  // que l'agent ouvre pour sa commande, fiche 126) est montré.
  useEffect(() => {
    let alive = true
    let known: Set<string> | undefined
    const apply = (list: TerminalTabInfo[]) => {
      if (!alive) return
      const added = known ? list.filter((t) => !known?.has(t.id)).at(-1) : undefined
      known = new Set(list.map((t) => t.id))
      setTabs(list)
      setActive((current) =>
        added
          ? added.id
          : current && list.some((t) => t.id === current)
            ? current
            : (list.at(-1)?.id ?? null)
      )
    }
    void window.api.terminal.list(conversationId).then(async (list) => {
      if (list.length === 0) {
        const created = await window.api.terminal.create(conversationId, 100, 30)
        apply([created])
      } else apply(list)
    })
    const off = window.api.terminal.onChanged((change) => {
      if (change.conversationId === conversationId) apply(change.tabs)
    })
    return () => {
      alive = false
      off()
    }
  }, [conversationId])

  // Une instance xterm.js par onglet, gardée tant que l'onglet du panneau est ouvert.
  useEffect(() => {
    const map = instances.current
    const offData = window.api.terminal.onData((event) => {
      if (event.conversationId !== conversationId) return
      map.get(event.tabId)?.term.write(event.data)
    })
    // Mode, palette ou accent changés : nouvelles couleurs, sans rouvrir l'onglet.
    const offTheme = subscribeTheme(() => {
      for (const { term } of map.values()) term.options.theme = themeOf()
    })
    return () => {
      offData()
      offTheme()
      for (const { term, element } of map.values()) {
        term.dispose()
        element.remove()
      }
      map.clear()
    }
  }, [conversationId])

  // Ouvre l'instance de l'onglet actif (avec son historique) et l'ajuste à la place disponible.
  useEffect(() => {
    const container = host.current
    if (!container || !active || !symbolsReady) return
    const map = instances.current
    let instance = map.get(active)
    if (!instance) {
      const element = document.createElement('div')
      element.className = 'terminal-instance'
      container.appendChild(element)
      const term = new Terminal({
        fontFamily: fontOf(fontRef.current),
        fontSize: fontRef.current?.terminalFontSize ?? DEFAULT_PREFERENCES.terminalFontSize,
        lineHeight: 1.2,
        cursorBlink: true,
        scrollback: 5000,
        theme: themeOf(),
        allowProposedApi: true
      })
      const fit = new FitAddon()
      term.loadAddon(fit)
      term.open(element)
      const tabId = active
      term.onData((data) => void window.api.terminal.write(conversationId, tabId, data))
      term.onSelectionChange(() => setSelection(term.getSelection()))
      void window.api.terminal.snapshot(conversationId, tabId).then((image) => term.write(image))
      instance = { term, fit, element }
      map.set(active, instance)
    }
    showOnly(map, active)
    const current = instance
    const tabId = active
    const resize = () => {
      if (!container.clientWidth || !container.clientHeight) return
      current.fit.fit()
      void window.api.terminal.resize(conversationId, tabId, current.term.cols, current.term.rows)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [conversationId, active, symbolsReady])

  // Ouvert par l'utilisateur : le terminal actif prend le clavier, une fois son instance créée.
  useEffect(() => {
    if (!focusRequested || !active || !symbolsReady) return
    focusSoon(instances.current, active)
    onFocused?.()
  }, [focusRequested, active, onFocused, symbolsReady])

  // Onglets fermés : leurs instances disparaissent.
  useEffect(() => {
    if (!tabs) return
    const map = instances.current
    for (const [id, instance] of map) {
      if (!tabs.some((t) => t.id === id)) {
        instance.term.dispose()
        instance.element.remove()
        map.delete(id)
      }
    }
  }, [tabs])

  const addToMessage = () => {
    const tab = tabs?.find((t) => t.id === active)
    if (!selection.trim() || !tab) return
    window.dispatchEvent(
      new CustomEvent(INSERT_TEXT_EVENT, {
        detail: `Terminal ${tab.id} (${tab.title}) :\n\`\`\`\n${selection.trimEnd()}\n\`\`\`\n`
      })
    )
    instances.current.get(tab.id)?.term.clearSelection()
  }

  return (
    <div className="terminal-tab" data-testid="terminal-tab">
      <div className="terminal-bar">
        <div className="terminal-tabs" role="tablist">
          {(tabs ?? []).map((tab) => (
            <div
              key={tab.id}
              className={`terminal-tab-chip${tab.id === active ? ' active' : ''}${tab.exitCode !== undefined ? ' exited' : ''}`}
              data-testid="terminal-tab-chip"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab.id === active}
                title={tab.cwd}
                onClick={() => {
                  setActive(tab.id)
                  focusSoon(instances.current, tab.id)
                }}
              >
                {tab.busy && <span className="terminal-busy" aria-label={t('terminal.busy')} />}
                {tab.id} · {tab.title}
              </button>
              <button
                type="button"
                className="browser-tab-close"
                aria-label={t('terminal.closeLabel', { id: tab.id })}
                onClick={() => void window.api.terminal.close(conversationId, tab.id)}
              >
                <X size={11} />
              </button>
            </div>
          ))}
          <Tip label={t('terminal.new')}>
            <button
              type="button"
              className="icon-button small"
              aria-label={t('terminal.new')}
              onClick={() =>
                void window.api.terminal.create(conversationId, 100, 30).then((tab) => {
                  setActive(tab.id)
                  focusSoon(instances.current, tab.id)
                })
              }
              data-testid="terminal-new"
            >
              <Plus size={14} />
            </button>
          </Tip>
        </div>
        <span className="grow" />
        {selection.trim() && (
          <button
            type="button"
            className="btn small"
            onMouseDown={(e) => e.preventDefault()}
            onClick={addToMessage}
            data-testid="terminal-add-to-message"
          >
            <MessageSquarePlus size={13} /> {t('terminal.addToMessage')}
          </button>
        )}
      </div>
      {tabs?.length === 0 && <div className="side-panel-empty">{t('terminal.none')}</div>}
      {/* Rempli par xterm.js (une instance par onglet) : React n'y met rien. */}
      <div className="terminal-host" ref={host} data-testid="terminal-host" />
    </div>
  )
}
