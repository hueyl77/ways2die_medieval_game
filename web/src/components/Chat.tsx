import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatMsg } from '../state/useChat';
import { Eyebrow } from './ui';

export function Chat({ msgs, onSend, disabled }: { msgs: ChatMsg[]; onSend: (t: string) => void; disabled?: boolean }) {
  const [text, setText] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [msgs.length]);
  function submit(e: FormEvent) { e.preventDefault(); if (text.trim()) { onSend(text); setText(''); } }
  return (
    <div className="flex flex-col h-full min-h-0">
      <Eyebrow>Gossip</Eyebrow>
      <div ref={box} className="flex-1 min-h-0 overflow-y-auto scrollbar-thin mt-2 space-y-1 pr-1">
        {msgs.length === 0 && <p className="text-xs text-ink-2 italic">Nobody has said anything yet. Suspicious.</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`text-sm leading-snug ${m.system ? 'text-gold italic' : m.ghost ? 'text-moon italic' : ''}`}>
            {!m.system && <span className={`font-ui font-bold ${m.me ? 'text-gold' : 'text-parchment'}`}>{m.ghost ? '👻 ' : ''}{m.name}: </span>}{m.text}
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="mt-2 flex gap-1">
        <input value={text} onChange={(e) => setText(e.target.value)} disabled={disabled} placeholder="Accuse, deny, promise, lie…" className="flex-1 bg-night border border-night-3 rounded-sm px-2 py-1 text-sm focus:outline-none focus:border-gold" maxLength={300} />
        <button className="bg-night-3 px-3 rounded-sm font-ui text-xs uppercase" disabled={disabled}>Say</button>
      </form>
    </div>
  );
}
