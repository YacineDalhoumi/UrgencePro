import * as React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useStore } from '@/store/store'
import { useApplyTheme } from '@/lib/theme'
import { BackOffice, DemoBar } from '@/layouts/Shell'
import { DashboardPage } from '@/pages/Dashboard'
import { RequestsPage } from '@/pages/Requests'
import { RequestDetailPage } from '@/pages/RequestDetail'
import { CallsPage } from '@/pages/Calls'
import { PlanningPage } from '@/pages/Planning'
import { LiveMapPage } from '@/pages/LiveMap'
import { ClientsPage, ClientDetailPage } from '@/pages/Clients'
import { QuotesPage } from '@/pages/Quotes'
import { QuoteEditorPage } from '@/pages/QuoteEditor'
import { InvoicesPage } from '@/pages/Invoices'
import { TechniciansPage } from '@/pages/Technicians'
import { CatalogPage } from '@/pages/Catalog'
import { StatsPage } from '@/pages/Stats'
import { ReviewsPage } from '@/pages/Reviews'
import { SettingsPage } from '@/pages/Settings'
import { IntegrationsPage } from '@/pages/Integrations'
import { OnboardingPage } from '@/pages/Onboarding'
import { TechApp } from '@/pages/tech/TechApp'
import { ClientHub, ClientPortal } from '@/pages/client/ClientPortal'

export function App() {
  useApplyTheme()
  const tick = useStore((s) => s.tick)
  const theme = useStore((s) => s.theme)

  // Simulation temps réel : déplacement des techniciens en route (position partagée par la PWA).
  React.useEffect(() => {
    const t = setInterval(tick, 3000)
    return () => clearInterval(t)
  }, [tick])

  return (
    <>
      <DemoBar />
      <Routes>
        <Route element={<BackOffice />}>
          <Route path="/tableau-de-bord" element={<DashboardPage />} />
          <Route path="/demandes" element={<RequestsPage />} />
          <Route path="/demandes/:id" element={<RequestDetailPage />} />
          <Route path="/appels" element={<CallsPage />} />
          <Route path="/planning" element={<PlanningPage />} />
          <Route path="/carte" element={<LiveMapPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/:id" element={<ClientDetailPage />} />
          <Route path="/devis" element={<QuotesPage />} />
          <Route path="/devis/:id" element={<QuoteEditorPage />} />
          <Route path="/factures" element={<InvoicesPage />} />
          <Route path="/techniciens" element={<TechniciansPage />} />
          <Route path="/catalogue" element={<CatalogPage />} />
          <Route path="/statistiques" element={<StatsPage />} />
          <Route path="/avis" element={<ReviewsPage />} />
          <Route path="/parametres" element={<SettingsPage />} />
          <Route path="/parametres/integrations" element={<IntegrationsPage />} />
        </Route>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/tech" element={<TechApp />} />
        <Route path="/client" element={<ClientHub />} />
        <Route path="/client/:requestId/:page" element={<ClientPortal />} />
        <Route path="*" element={<Navigate to="/tableau-de-bord" replace />} />
      </Routes>
      <Toaster position="top-center" offset={60} richColors closeButton theme={theme === 'system' ? 'system' : theme} toastOptions={{ style: { fontFamily: 'inherit' } }} />
    </>
  )
}
