import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuditProvider } from './context/AuditContext';
import { MainLayout } from './layouts/MainLayout';
import { ProjectsPage } from './pages/ProjectsPage';
import { AuditsPage } from './pages/AuditsPage';
import { AuditDetailPage } from './pages/AuditDetailPage';
import { StatsPage } from './pages/StatsPage';
import { SettingsPage } from './pages/SettingsPage';
import { WebhookEventsPage } from './pages/WebhookEventsPage';
import { AuditComparePage } from './pages/AuditComparePage';

function App() {
  return (
    <AuditProvider>
      <Router>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<ProjectsPage />} />
            <Route path="/audits" element={<AuditsPage />} />
            <Route path="/audits/:id" element={<AuditDetailPage />} />
            <Route path="/audits/compare" element={<AuditComparePage />} />
            <Route path="/webhook-events" element={<WebhookEventsPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </Router>
    </AuditProvider>
  );
}

export default App;
