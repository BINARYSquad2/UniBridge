import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import Landing from './pages/Landing'
import { Navbar } from './components/Navbar'
import { Auth } from './pages/Auth'
import { Profile } from './pages/Profile'
import Requests from './pages/Requests'
import { SessionProvider } from './lib/session'
import { useSession } from './lib/session.context'
import Roadmap from './pages/Roadmap'
import Mentorslist from './pages/Mentorslist'
import Analytics from './pages/Analytics'
import KanbanBoard from './pages/Kanban'
import './styles/App.css'

function ScrollToLocation() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
      return;
    }

    window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  return null;
}

function PublicLayout() {
  return (  
    <>
      <Navbar />
      <Outlet />
    </>
  );
}

function ProtectedRoute({ children, role }: { children: ReactNode; role?: 'student' | 'mentor' }) {
  const { user, token, loading, error, refreshSession } = useSession()
  if (loading) return <p className="route-status" role="status">Загрузка аккаунта…</p>
  if (!user) return error && token
    ? <div className="route-status route-status--error" role="alert">{error}<button className="route-retry" onClick={() => void refreshSession()}>Повторить</button></div>
    : <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to={user.role === 'mentor' ? '/requests' : '/mentorslist'} replace />
  return children
}

function App() {
  return (
    <SessionProvider><BrowserRouter>
      <ScrollToLocation />
      <Routes>
        <Route path="/" element={<PublicLayout />}>
          <Route index element={<Landing />} />
          <Route path="login" element={<Auth key="login" initialMode="login" />} />
          <Route path="register" element={<Auth key="register" initialMode="register" />} />
          <Route path="requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
          <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="roadmap" element={<ProtectedRoute role="student"><Roadmap /></ProtectedRoute>} />
          <Route path="mentorslist" element={<ProtectedRoute role="student"><Mentorslist /></ProtectedRoute>} />
          <Route path="kanban" element={<ProtectedRoute><KanbanBoard /></ProtectedRoute>} />
          <Route path="analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter></SessionProvider>
  )
}

export default App;