import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { io } from 'socket.io-client';
import { MainLayout } from './layouts/MainLayout';
import { ProjectsPage } from './pages/ProjectsPage';
import { AuditsPage } from './pages/AuditsPage';
import { AuditDetailPage } from './pages/AuditDetailPage';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function App() {
  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.on('connect', () => {
      console.log('Connected to real-time update server');
    });

    socket.on('audit_update', (data) => {
      console.log('Real-time audit update received:', data);
      // We could use a global state (Zustand/Redux) or an event emitter here
      // For now, we'll let individual pages handle refreshing if needed, 
      // or we can implement a refresh trigger.
      window.dispatchEvent(new CustomEvent('audit_status_change', { detail: data }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <Router>
...
        <Route element={<MainLayout />}>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/audits" element={<AuditsPage />} />
          <Route path="/audits/:id" element={<AuditDetailPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
