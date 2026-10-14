import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import './App.css';
import Landing from './pages/Landing';
import { Navbar } from './components/Navbar';
import { Auth } from './pages/Auth';
import Profile from './pages/Profile';
import Requests from './pages/Requests';
import Roadmap from './pages/Roadmap';
import { SessionProvider } from './lib/session';

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

function hasActiveJWT(): boolean {
  const token = localStorage.getItem('access_token');
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    return typeof payload.exp === 'number' && payload.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  return hasActiveJWT()
    ? children
    : <Navigate to="/login" replace />;
}

function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <ScrollToLocation />
        <Routes>
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<Landing />} />
            <Route path="login" element={<Auth key="login" initialMode="login" />} />
            <Route path="register" element={<Auth key="register" initialMode="register" />} />
            <Route path="requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
            <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="roadmap" element={<ProtectedRoute><Roadmap /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}

export default App;