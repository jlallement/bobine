import { Bot, Cpu, Folder, GitBranch } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ControlValue, SessionControl } from '@shared/agent'
import { ModeChip, Tip } from '../common/Menus'
import { ModelChip } from '../common/ModelMenu'

export interface SessionEnvironmentProps {
  agentLabel: string
  modelControl: SessionControl | undefined
  modeControl: SessionControl | undefined
  /** Réglages modifiables (agent prêt), comme dans la barre de la zone de saisie. */
  canSet: boolean
  onSetControl: (id: string, value: ControlValue) => void
  workspace?: string | undefined
  onRevealWorkspace: () => void
  /** Branche du worktree de la conversation (fiche 036), sinon branche git du dossier. */
  worktreeBranch?: string | undefined
  gitBranch?: string | undefined
  onOpenGit: () => void
  /** Le Finder (macOS) ou le gestionnaire de fichiers (fiche 145). */
  finder: boolean
  /** Ligne « Autres dossiers » (fiche 179), sous le dossier de travail. */
  folders?: ReactNode
}

const baseName = (path: string) => path.split('/').filter(Boolean).at(-1) ?? path

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="session-row">
      <span className="session-row-label">{label}</span>
      <span className="session-row-value">{children}</span>
    </div>
  )
}

/**
 * Environnement de la session (fiche 166) : en lecture, avec des liens — modèle et mode ouvrent
 * les menus de la zone de saisie (mêmes composants), le dossier s'affiche dans le Finder, la
 * branche ouvre l'état git.
 */
export function SessionEnvironment(props: SessionEnvironmentProps) {
  const { t } = useTranslation()
  const branch = props.worktreeBranch ?? props.gitBranch
  const revealLabel = t(props.finder ? 'workspaceMenu.revealFinder' : 'workspaceMenu.revealFiles')
  return (
    <section className="session-section" data-testid="session-environment">
      <h3 className="session-title">{t('sessionTab.environment')}</h3>
      <Row label={t('sessionTab.agent')}>
        <span className="session-value" data-testid="session-agent">
          <Bot size={16} />
          <span className="session-link-text">{props.agentLabel}</span>
        </span>
      </Row>
      {props.modelControl && (
        <Row label={t('sessionTab.model')}>
          <ModelChip
            control={props.modelControl}
            disabled={!props.canSet}
            onSetControl={props.onSetControl}
            className="session-chip"
            icon={<Cpu size={16} />}
          />
        </Row>
      )}
      {props.modeControl && (
        <Row label={t('sessionTab.mode')}>
          <ModeChip
            control={props.modeControl}
            disabled={!props.canSet}
            onSetControl={props.onSetControl}
            className="session-chip"
          />
        </Row>
      )}
      {props.workspace && (
        <Row label={t('sessionTab.folder')}>
          <Tip label={`${revealLabel} — ${props.workspace}`}>
            <button
              type="button"
              className="session-link"
              onClick={props.onRevealWorkspace}
              data-testid="session-folder"
            >
              <Folder size={16} />
              <span className="session-link-text">{baseName(props.workspace)}</span>
            </button>
          </Tip>
        </Row>
      )}
      {props.folders}
      {branch && (
        <Row label={props.worktreeBranch ? t('sessionTab.worktree') : t('sessionTab.branch')}>
          <Tip label={t('sessionTab.branchTip')}>
            <button
              type="button"
              className="session-link"
              onClick={props.onOpenGit}
              data-testid="session-branch"
            >
              <GitBranch size={16} />
              <span className="session-link-text">{branch}</span>
            </button>
          </Tip>
        </Row>
      )}
    </section>
  )
}
