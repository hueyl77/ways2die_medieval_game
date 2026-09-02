import { useCallback, useEffect, useRef, useState } from 'react';
import { insforge } from '../lib/insforge';

export interface ChatMsg { id: string; name: string; text: string; ghost: boolean; system?: boolean; at: number; me: boolean }

export function useChat(gameId: string | undefined, self: { name: string; userId: string | null; ghost: boolean }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const selfRef = useRef(self); selfRef.current = self;
  useEffect(() => {
    if (!gameId) return;
    const channel = `chat:${gameId}`;
    let alive = true;
    const handler = (p: { text: string; name: string; ghost: boolean; meta: { messageId: string; channel: string; senderId?: string; timestamp: string } }) => {
      if (p.meta.channel !== channel) return;
      setMsgs((m) => [...m.slice(-199), { id: p.meta.messageId, name: p.name, text: p.text, ghost: p.ghost, at: Date.parse(p.meta.timestamp), me: p.meta.senderId === selfRef.current.userId }]);
    };
    (async () => {
      await insforge.realtime.connect();
      const r = await insforge.realtime.subscribe(channel);
      if (!alive) return;
      if (!r.ok) console.warn('chat subscribe failed', r.error);
      insforge.realtime.on('message', handler);
    })();
    return () => { alive = false; insforge.realtime.off('message', handler); insforge.realtime.unsubscribe(channel); };
  }, [gameId]);
  const send = useCallback(async (text: string) => {
    if (!gameId || !text.trim()) return;
    await insforge.realtime.publish(`chat:${gameId}`, 'message', { text: text.trim().slice(0, 300), name: selfRef.current.name, ghost: selfRef.current.ghost });
  }, [gameId]);
  const system = useCallback((text: string) => setMsgs((m) => [...m.slice(-199), { id: `sys-${Date.now()}-${Math.random()}`, name: 'Crier', text, ghost: false, system: true, at: Date.now(), me: false }]), []);
  return { msgs, send, system };
}
