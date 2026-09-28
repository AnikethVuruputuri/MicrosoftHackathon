import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout';
import { Dashboard } from './pages/Dashboard';
import { Deployments } from './pages/Deployments';
import { Incidents } from './pages/Incidents';
import { IncidentDetail } from './pages/IncidentDetail';
import { MemoryExplorer } from './pages/MemoryExplorer';
import { FailurePatterns } from './pages/FailurePatterns';
import { SimulateDeployment } from './pages/SimulateDeployment';
import { Integrations } from './pages/Integrations';
import { AuditLogs } from './pages/AuditLogs';
import { RepositoriesPage } from './pages/Repositories';
import { PipelinesPage } from './pages/Pipelines';
import { SettingsPage } from './pages/Settings';

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<Dashboard />} />
        <Route path="/repositories" element={<RepositoriesPage />} />
        <Route path="/pipelines" element={<PipelinesPage />} />
        <Route path="/deployments" element={<Deployments />} />
        <Route path="/deployments/simulate" element={<SimulateDeployment />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/incidents/:id" element={<IncidentDetail />} />
        <Route path="/memory" element={<MemoryExplorer />} />
        <Route path="/memory/patterns" element={<FailurePatterns />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/audit" element={<AuditLogs />} />
      </Route>
    </Routes>
  );
}

export default App;
