import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import Login from './pages/Login';
import Home from './pages/Home';
import Room from './pages/Room';
import Game from './pages/Game';
import Rules from './pages/Rules';
import Dev from './pages/Dev';

function Guard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="grid h-full place-items-center text-ink-2 font-ui">Lighting the candles…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/rules" element={<Rules />} />
      {import.meta.env.DEV && <Route path="/dev" element={<Dev />} />}
      <Route path="/" element={<Guard><Home /></Guard>} />
      <Route path="/room/:code" element={<Guard><Room /></Guard>} />
      <Route path="/game/:id" element={<Guard><Game /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
