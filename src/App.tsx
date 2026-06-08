import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy, useState, useEffect } from 'react';
import { apiFetch } from './utils/api';

const LandingPage = lazy(() => import('./components/LandingPage'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const PublicShare = lazy(() => import('./components/PublicShare'));

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<'loading' | 'valid' | 'invalid'>('loading');

  useEffect(() => {
    apiFetch('/api/user/profile')
      .then(r => {
        if (r.ok) {
          setAuthState('valid');
        } else {
          // Token ditolak atau server bermasalah → jangan loloskan.
          if (r.status === 401 || r.status === 403) {
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('user');
          }
          setAuthState('invalid');
        }
      })
      .catch(() => {
        // Network error / timeout → jangan loloskan (token tidak terverifikasi).
        setAuthState('invalid');
      });
  }, []);

  if (authState === 'loading') {
    return <LoadingScreen />;
  }

  if (authState === 'invalid') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/share/:token" element={<PublicShare />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
