import { useCallback, useEffect, useRef, useState } from 'react';
import { insforge } from '../lib/insforge';
import { api, errorText } from '../lib/api';
import type { PlayerView } from '../engine/types.ts';

export function useGame(gameId: string | undefined) {
  const [view, setView] = useState<PlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const offset = useRef(0);
  const ticked = useRef<number | null>(null);
  const [, force] = useState(0);

  const apply = useCallback((v: PlayerView | null) => {
    if (!v) return;
    offset.current = v.serverNow - Date.now();
    setView((prev) => (prev && prev.version > v.version ? prev : v));
  }, []);

  const refresh = useCallback(async () => {
    if (!gameId) return;
    try { const r = await api.state(gameId); apply(r.state); setError(null); } catch (e) { setError(errorText(e)); }
  }, [gameId, apply]);

  useEffect(() => { void refresh(); }, [refresh]);

  // realtime: state bumps
  useEffect(() => {
    if (!gameId) return;
    const channel = `game:${gameId}`;
    let alive = true;
    const onChange = (p: { version: number; meta: { channel: string } }) => { if (p.meta.channel === channel) void refresh(); };
    const onConnect = () => void refresh();
    (async () => {
      await insforge.realtime.connect();
      const r = await insforge.realtime.subscribe(channel);
      if (!alive) return;
      if (!r.ok) console.warn('game subscribe failed', r.error);
      insforge.realtime.on('state_changed', onChange);
      insforge.realtime.on('connect', onConnect);
    })();
    // safety net: poll every 15 s in case a message is missed
    const poll = setInterval(() => void refresh(), 15000);
    return () => { alive = false; clearInterval(poll); insforge.realtime.off('state_changed', onChange); insforge.realtime.off('connect', onConnect); insforge.realtime.unsubscribe(channel); };
  }, [gameId, refresh]);

  // clock + deadline tick
  useEffect(() => {
    const id = setInterval(() => {
      force((n) => n + 1);
      const v = view; if (!v || !gameId || v.phaseDeadline === null) return;
      const now = Date.now() + offset.current;
      if (now > v.phaseDeadline + 1500 && ticked.current !== v.phaseDeadline) { ticked.current = v.phaseDeadline; api.tick(gameId).then((r) => apply(r.state)).catch(() => {}); }
    }, 1000);
    return () => clearInterval(id);
  }, [view, gameId, apply]);

  const act = useCallback(async (fn: () => Promise<{ state: PlayerView | null }>) => {
    setBusy(true); setError(null);
    try { const r = await fn(); apply(r.state); return true; }
    catch (e) { setError(errorText(e)); await refresh(); return false; }
    finally { setBusy(false); }
  }, [apply, refresh]);

  const now = () => Date.now() + offset.current;
  const secondsLeft = view?.phaseDeadline ? Math.max(0, Math.ceil((view.phaseDeadline - now()) / 1000)) : null;
  return { view, error, busy, act, refresh, secondsLeft, now };
}
