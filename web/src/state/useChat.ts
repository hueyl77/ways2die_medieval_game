import { useCallback, useEffect, useRef, useState } from 'react';
import { insforge } from '../lib/insforge';

export interface ChatMsg { id: string; name: string; text: string; ghost: boolean; system?: boolean; at: number; me: boolean }

export function useChat(gameId: string | undefined, self: { name: string; userId: string | null; ghost: boolean }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const selfRef = useRef(self); selfRef.current = self;
  useEffect(() => {
    if (!gameId) return;
    const channel = `chat:${gameId}`;
    let alive = true;
    const handler = (p: { text: string; name: string; ghost: boolean; meta: { messageId: string; channel: string; senderId?: string; timestamp: string } }) => {
      if (p.meta.channel !== channel) return;
      if (p.meta.senderId && p.meta.senderId === selfRef.current.userId) return; // our own messages are echoed locally on send
      setMsgs((m) => (m.some((x) => x.id === p.meta.messageId) ? m : [...m.slice(-199), { id: p.meta.messageId, name: p.name, text: p.text, ghost: p.ghost, at: Date.parse(p.meta.timestamp), me: false }]));
    };
    (async () => {
      try {
        await insforge.realtime.connect();
        const r = await insforge.realtime.subscribe(channel);
        if (!alive) return;
        if (!r.ok) { console.warn('chat subscribe failed', r.error); setStatus(`Chat unavailable: ${r.error?.message ?? 'could not subscribe'}`); }
        else setStatus(null);
        insforge.realtime.on('message', handler);
      } catch (e) { if (alive) setStatus(`Chat unavailable: ${(e as Error).message}`); }
    })();
    return () => { alive = false; insforge.realtime.off('message', handler); insforge.realtime.unsubscribe(channel); };
  }, [gameId]);
  const send = useCallback(async (text: string) => {
    if (!gameId || !text.trim()) return;
    const clean = text.trim().slice(0, 300);
    // show it at once; the server does not necessarily echo a message back to its sender
    setMsgs((m) => [...m.slice(-199), { id: `local-${Date.now()}-${Math.random()}`, name: selfRef.current.name, text: clean, ghost: selfRef.current.ghost, at: Date.now(), me: true }]);
    try {
      await insforge.realtime.publish(`chat:${gameId}`, 'message', { text: clean, name: selfRef.current.name, ghost: selfRef.current.ghost });
    } catch (e) { setStatus(`Message not delivered: ${(e as Error).message}`); }
  }, [gameId]);
  const system = useCallback((text: string) => setMsgs((m) => [...m.slice(-199), { id: `sys-${Date.now()}-${Math.random()}`, name: 'Crier', text, ghost: false, system: true, at: Date.now(), me: false }]), []);
  return { msgs, send, system, status };
}
