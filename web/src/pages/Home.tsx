import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { api, errorText, type GameSummary } from '../lib/api';
import { Button, Input, Panel, Eyebrow } from '../components/ui';

export default function Home() {
  const { displayName, signOut, user } = useAuth();
  const nav = useNavigate();
  const [code, setCode] = useState(''); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<GameSummary[]>([]);
  useEffect(() => { api.mine().then((r) => setMine(r.games ?? [])).catch(() => {}); }, []);

  async function create() {
    setBusy(true); setErr(null);
    try { const r = await api.create(displayName); nav(`/room/${r.state!.code}`); } catch (e) { setErr(errorText(e)); } finally { setBusy(false); }
  }
  async function join(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { const r = await api.join(code, displayName); const st = r.state!; nav(st.status === 'lobby' ? `/room/${st.code}` : `/game/${st.id}`); } catch (ex) { setErr(errorText(ex)); } finally { setBusy(false); }
  }

  return (
    <div className="min-h-full relative">
      {/* the village square in evening light: its own scene, distinct from the login, room and table art */}
      <div className="absolute inset-0 bg-cover" style={{ backgroundImage: "url('/bg/home.jpg')", backgroundPosition: 'center 40%' }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(20,22,28,.6) 0%, rgba(20,22,28,.72) 55%, rgba(20,22,28,.9) 100%)' }} />
      <div className="relative max-w-3xl mx-auto p-6">
      <header className="flex items-center justify-between mb-8">
        <div><Eyebrow className="text-parchment/75">The village square</Eyebrow><h1 className="font-display text-3xl">Welcome, {displayName}</h1>{user?.guest && <p className="text-xs text-parchment/75 font-ui mt-1">Playing as a guest. Your tables are remembered on this device only.</p>}</div>
        <div className="flex gap-2"><Button variant="ghost" onClick={() => window.open('/rules', '_blank', 'noopener')}>📜 Rules</Button><Button variant="ghost" onClick={() => void signOut()}>{user?.guest ? 'Leave' : 'Sign out'}</Button></div>
      </header>
      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Open a table">
          <p className="text-sm text-ink-2 mb-3">Create a room and share the code. Up to eight seats; the host fills empty chairs with bots.</p>
          <Button onClick={() => void create()} disabled={busy}>Create a room</Button>
        </Panel>
        <Panel title="Join a table">
          <form onSubmit={join} className="flex gap-2">
            <Input placeholder="ROOM CODE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} className="uppercase tracking-[0.3em] font-ui" />
            <Button type="submit" disabled={busy || code.length < 6}>Join</Button>
          </form>
        </Panel>
      </div>
      {err && <p className="text-blood mt-3">{err}</p>}
      {mine.length > 0 && (
        <Panel title="Your tables" className="mt-4">
          <ul className="divide-y divide-night-3">
            {mine.map((g) => (
              <li key={g.id} className="flex items-center justify-between py-2">
                <div><span className="font-ui tracking-[0.25em]">{g.code}</span> <span className="text-ink-2 text-sm ml-2">{g.status === 'lobby' ? 'waiting in the lobby' : `round ${g.round} · ${g.phase}`}</span></div>
                <Button variant="ghost" onClick={() => nav(g.status === 'lobby' ? `/room/${g.code}` : `/game/${g.id}`)}>Rejoin</Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
    </div>
  );
}
