import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { api, errorText } from '../lib/api';
import { useGame } from '../state/useGame';
import { Button, Panel, Eyebrow, Crest } from '../components/ui';
import { CREST_COLORS } from '../lib/cards';
import type { PlayerView } from '../engine/types.ts';

export default function Room() {
  const { code } = useParams();
  const { displayName, user } = useAuth();
  const nav = useNavigate();
  const [gameId, setGameId] = useState<string | undefined>();
  const [joinErr, setJoinErr] = useState<string | null>(null);
  useEffect(() => {
    if (!code) return;
    api.join(code, displayName).then((r) => { if (r.state?.status !== 'lobby') nav(`/game/${r.state!.id}`); else setGameId(r.state.id); }).catch((e) => setJoinErr(errorText(e)));
  }, [code, displayName, nav]);
  const { view, error, act, busy } = useGame(gameId);
  useEffect(() => { if (view && view.status !== 'lobby') nav(`/game/${view.id}`); }, [view, nav]);

  if (joinErr) return <div className="p-6 text-blood">{joinErr} <Button variant="ghost" onClick={() => nav('/')}>Back</Button></div>;
  if (!view) return <div className="grid h-full place-items-center text-ink-2">Finding the table…</div>;
  const isHost = view.hostUserId === user?.id;
  const me = view.seats.find((s) => s.isMe);
  const humans = view.seats.filter((s) => !s.isTownsfolk).length;
  const bots = view.seats.filter((s) => s.isTownsfolk).length;
  const seatsTotal = humans + bots;
  const cal = calendarPreview(seatsTotal);

  return (
    <div className="min-h-full max-w-3xl mx-auto p-6">
      <header className="flex items-center justify-between mb-6">
        <div><Eyebrow>Room code</Eyebrow><h1 className="font-display text-4xl tracking-[0.3em]">{view.code}</h1></div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/room/${view.code}`)}>Copy invite link</Button>
          <Button variant="ghost" onClick={() => void act(() => api.leave(view.id)).then(() => nav('/'))}>Leave</Button>
        </div>
      </header>
      <div className="grid md:grid-cols-[1fr_280px] gap-4">
        <Panel title={`At the table (${humans + bots})`}>
          <ul className="space-y-2">
            {view.seats.map((s) => (
              <li key={s.index} className={`flex items-center gap-3 ${s.isTownsfolk ? 'opacity-70' : ''}`}>
                <Crest color={s.crest} size={22} />
                <span className={`font-ui ${s.isMe ? 'text-gold' : ''} ${s.isTownsfolk ? 'italic' : ''}`}>{s.name}{s.userId === view.hostUserId ? ' (host)' : ''}{s.isTownsfolk ? ' (bot)' : ''}</span>
                {s.isTownsfolk
                  ? (isHost && <button className="ml-auto text-xs font-ui uppercase tracking-wider text-blood" disabled={busy} onClick={() => void act(() => api.bot(view.id, 'remove'))}>remove</button>)
                  : <span className={`ml-auto text-xs font-ui uppercase tracking-wider ${s.ready ? 'text-heal' : 'text-ink-2'}`}>{s.ready ? 'ready' : 'not ready'}</span>}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <Button variant={me?.ready ? 'ghost' : 'primary'} disabled={busy} onClick={() => void act(() => api.lobbyReady(view.id, !me?.ready))}>{me?.ready ? 'Not ready' : "I'm ready"}</Button>
            {isHost && <Button variant="ghost" disabled={busy || seatsTotal >= 12} onClick={() => void act(() => api.bot(view.id, 'add'))}>Add a bot</Button>}
            {isHost && <Button disabled={busy} onClick={() => void act(() => api.start(view.id))}>Start the year</Button>}
          </div>
          <p className="text-xs text-ink-2 mt-2">The host sets the table size (4–12). Seats without a player are filled by bots, who play random cards and cannot win.</p>
          <div className="mt-4"><Eyebrow>Your crest</Eyebrow>
            <div className="flex flex-wrap gap-2 mt-2">
              {CREST_COLORS.map((c) => { const taken = view.seats.some((s) => s.crest === c && !s.isMe); return (
                <button key={c} disabled={taken || busy} onClick={() => void act(() => api.crest(view.id, c))} className={`rounded-full p-0.5 ${me?.crest === c ? 'ring-2 ring-gold' : ''} ${taken ? 'opacity-25' : ''}`} title={c}><Crest color={c} size={24} /></button>
              ); })}
            </div>
          </div>
          {error && <p className="text-blood text-sm mt-3">{error}</p>}
        </Panel>
        <div className="space-y-4">
          <Panel title="This year">
            <p className="text-sm"><span className="text-gold">{seatsTotal} seats</span> · {cal.rounds} rounds{view.settings.seasonRules ? ` · ${cal.seasons}` : ''}</p>
            <p className="text-xs text-ink-2 mt-1">Death at {cal.deathAt} wounds · {cal.jobs} wares cards each</p>
          </Panel>
          <Panel title="Settings">
            <SettingRow label="Table size" value={seatsTotal} unit=" seats" host={isHost} onChange={(v) => act(() => api.settings(view.id, { tableSize: v }))} step={1} />
            <SettingRow label="Placement" value={view.settings.placementSeconds} unit="s" host={isHost} onChange={(v) => act(() => api.settings(view.id, { placementSeconds: v }))} step={30} />
            <SettingRow label="Reveal, per scene" value={view.settings.revealStepSeconds ?? 20} unit="s" host={isHost} onChange={(v) => act(() => api.settings(view.id, { revealStepSeconds: v }))} step={5} />
            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-ink-2" title="Market Fair (+1 per wares in Harvest), the Reeve's Tax, and the Hungry Winter">Season rules (variant)</span>
              {isHost ? <button className={`px-2 rounded-sm font-ui text-xs uppercase ${view.settings.seasonRules ? 'bg-gold text-night' : 'bg-night-3'}`} onClick={() => act(() => api.settings(view.id, { seasonRules: !view.settings.seasonRules }))}>{view.settings.seasonRules ? 'On' : 'Off'}</button> : <span className="font-ui">{view.settings.seasonRules ? 'On' : 'Off'}</span>}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, value, unit, host, onChange, step }: { label: string; value: number; unit: string; host: boolean; onChange: (v: number) => void; step: number }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-ink-2">{label}</span>
      <div className="flex items-center gap-2">
        {host && <button className="px-2 bg-night-3 rounded-sm" onClick={() => onChange(value - step)}>−</button>}
        <span className="font-ui tabular-nums w-12 text-center">{value}{unit}</span>
        {host && <button className="px-2 bg-night-3 rounded-sm" onClick={() => onChange(value + step)}>+</button>}
      </div>
    </div>
  );
}

export function calendarPreview(seats: number) {
  if (seats <= 5) return { rounds: 6, seasons: 'Spring · Harvest · Winter (2 rounds each)', deathAt: 3, jobs: seats * 6 - 11 };
  if (seats <= 8) return { rounds: 4, seasons: 'Harvest · Winter (2 rounds each)', deathAt: 4, jobs: seats * 4 - 11 };
  return { rounds: 3, seasons: 'Spring · Harvest · Winter (1 round each)', deathAt: 4, jobs: seats * 3 - 11 };
}
export type { PlayerView };
