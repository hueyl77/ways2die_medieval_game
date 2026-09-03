import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Button, Input, Eyebrow } from '../components/ui';
import { checkNickname } from '../engine/names.ts';
import { ApiError } from '../lib/api';

type Mode = 'signin' | 'signup' | 'verify';

export default function Login() {
  const { user, loading, signIn, signUp, verifyCode, resend, oauth, playAsGuest } = useAuth();
  const loc = useLocation() as { state?: { from?: string } };
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState(''); const [otp, setOtp] = useState('');
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [info, setInfo] = useState<string | null>(null);
  const [nick, setNick] = useState(''); const [nickErr, setNickErr] = useState<string | null>(null);

  async function guest(e: FormEvent) {
    e.preventDefault(); setNickErr(null);
    const check = checkNickname(nick);
    if (!check.ok) { setNickErr(check.reason); return; }
    setBusy(true);
    try { await playAsGuest(check.name); }
    catch (ex) { setNickErr(ex instanceof ApiError && ex.code === 'bad_name' ? (ex.message || 'That name is not allowed.') : (ex as Error).message); }
    finally { setBusy(false); }
  }

  if (!loading && user) return <Navigate to={loc.state?.from ?? '/'} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      if (mode === 'signin') await signIn(email, password);
      else if (mode === 'signup') { const r = await signUp(email, password, name || email.split('@')[0]); if (r.needsCode) { setMode('verify'); setInfo('We sent a 6-digit code to your email.'); } }
      else await verifyCode(email, otp);
    } catch (ex) { setErr((ex as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="min-h-full grid place-items-center p-6 relative">
      {/* the town from the hills at evening, dimmed so the forms stay readable */}
      <div className="absolute inset-0 bg-cover" style={{ backgroundImage: "url('/bg/login.jpg')", backgroundPosition: 'center 60%' }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(20,22,28,.62) 0%, rgba(20,22,28,.6) 45%, rgba(20,22,28,.88) 100%)' }} />
      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">💀</div>
          <Eyebrow>Honest trades, unfortunate accidents</Eyebrow>
          <h1 className="font-display text-4xl text-parchment mt-2 leading-tight">A Million Ways to Die<br />in Medieval</h1>
        </div>
        <form onSubmit={submit} className="bg-night-2/90 backdrop-blur-sm border border-night-3 rounded-md p-5 space-y-3 shadow-card">
          {mode !== 'verify' && (<>
            {mode === 'signup' && <Input placeholder="Your name at the table" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />}
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            <Input type="password" placeholder="Password (6+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
          </>)}
          {mode === 'verify' && (<>
            <p className="text-sm text-ink-2">{info}</p>
            <Input placeholder="6-digit code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" required />
            <button type="button" className="text-xs text-gold underline" onClick={() => void resend(email)}>Resend the code</button>
          </>)}
          {err && <p className="text-sm text-blood">{err}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{mode === 'signin' ? 'Enter the village' : mode === 'signup' ? 'Take up a trade' : 'Verify'}</Button>
          {mode !== 'verify' && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => void oauth('github')}>GitHub</Button>
              <Button type="button" variant="ghost" onClick={() => void oauth('google')}>Google</Button>
            </div>
          )}
          <p className="text-center text-sm text-ink-2 pt-1">
            {mode === 'signin' ? <>New here? <button type="button" className="text-gold underline" onClick={() => setMode('signup')}>Create an account</button></>
              : <>Already a villager? <button type="button" className="text-gold underline" onClick={() => setMode('signin')}>Sign in</button></>}
          </p>
        </form>
        <form onSubmit={guest} className="bg-night-2/90 backdrop-blur-sm border border-night-3 rounded-md p-5 mt-4 space-y-3 shadow-card">
          <div><Eyebrow>Just visiting?</Eyebrow><p className="text-sm text-ink-2 mt-1">Play as a guest. Pick the name the village will know you by; it is kept on this device only.</p></div>
          <div className="flex gap-2">
            <Input placeholder="Nickname" value={nick} onChange={(e) => { setNick(e.target.value); setNickErr(null); }} maxLength={16} autoComplete="nickname" aria-label="Guest nickname" />
            <Button type="submit" variant="ghost" className="whitespace-nowrap" disabled={busy || nick.trim().length < 2}>Enter as a guest</Button>
          </div>
          {nickErr && <p className="text-sm text-blood">{nickErr}</p>}
        </form>
        <p className="text-center mt-4 text-xs text-parchment/80"><a className="underline" href="/rules" target="_blank" rel="noopener">Read the rules</a></p>
      </div>
    </div>
  );
}
