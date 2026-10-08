import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import Landing from './pages/Landing'
import { Navbar } from './components/Navbar'
import { Auth } from './pages/Auth'
import Profile from './pages/Profile'
import Roadmap from './pages/Roadmap'

function ScrollToLocation() {
  const location = useLocation()

  useEffect(() => {
    if (location.hash) {
      document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView()
      return
    }

    window.scrollTo(0, 0)
  }, [location.pathname, location.hash])

  return null
}

function PublicLayout() {
  return (  
    <>
      <Navbar />
      <Outlet />
    </>
  )
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  return localStorage.getItem('access_token')
    ? children
    : <Navigate to="/login" replace />
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToLocation />
      <Routes>
        <Route path="/" element={<PublicLayout />}>
          <Route index element={<Landing />} />
          <Route path="login" element={<Auth key="login" initialMode="login" />} />
          <Route path="register" element={<Auth key="register" initialMode="register" />} />
          <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="roadmap" element={<ProtectedRoute><Roadmap /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
