import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ErrorBoundary, reportGlobalErrors } from './components/common/ErrorBoundary'
import { QuickEntry } from './components/composer/QuickEntry'
import { AboutWindow } from './components/about/AboutWindow'
import { AppAlertsBar } from './components/common/AppAlertsBar'
import { setHomeFolder } from '@shared/path-display'
import { initI18n, setLanguage } from './i18n'
import { startPresentation } from './presentation'
import { installTitleTooltips } from './title-tooltips'
import './themes.generated.css'
import './styles.css'
import './motion.css'
import './profile.css'
import './onboarding.css'

// Fenêtre d'aide (fiche 186) : son code, son style et le guide restent hors du morceau principal.
const HelpWindow = lazy(() =>
  import('./components/help/HelpWindow').then((m) => ({ default: m.HelpWindow }))
)

const root = document.getElementById('root')
if (!root) throw new Error('#root introuvable')

reportGlobalErrors()
// Infobulles des `title` qui se ferment quand l'élément défile ou disparaît (fiche 126).
installTitleTooltips()
initI18n(window.api.app.language)
// Dossier personnel : les cartes disent `~` (fiche 214).
setHomeFolder(window.api.app.home)
window.api.app.onLanguage(setLanguage)
startPresentation()

// Fenêtre rapide (fiche 062), À propos (fiche 116) et aide (fiche 186) : même page, autre vue.
const view = { '#quick': 'quick', '#about': 'about', '#help': 'help' }[window.location.hash]
if (view) document.documentElement.classList.add(`${view}-page`)

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      {view === 'quick' ? (
        <QuickEntry />
      ) : view === 'about' ? (
        <AboutWindow />
      ) : view === 'help' ? (
        <Suspense fallback={null}>
          <HelpWindow />
        </Suspense>
      ) : (
        <>
          <App />
          {/* Avis de l'app (fiche 194) : hors de l'interface principale, qui peut tomber. */}
          <AppAlertsBar />
        </>
      )}
    </ErrorBoundary>
  </StrictMode>
)
