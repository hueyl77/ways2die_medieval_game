import { calendarFor } from '../engine/engine.ts';
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
  const hunted = view.settings.huntSeat !== null && view.settings.huntSeat !== undefined;
  const drawing = view.settings.drawMode ?? true;   // standard play; lobbies made before the setting existed follow the default
  const me = view.seats.find((s) => s.isMe);
  const humans = view.seats.filter((s) => !s.isTownsfolk).length;
  const bots = view.seats.filter((s) => s.isTownsfolk).length;
  const seatsTotal = humans + bots;
  const cal = calendarPreview(seatsTotal);

  return (
    <div className="min-h-full relative">
      {/* the square at evening: a different view from the login page and the table */}
      <div className="absolute inset-0 bg-cover" style={{ backgroundImage: "url('/bg/lobby.jpg')", backgroundPosition: 'center 35%' }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(20,22,28,.6) 0%, rgba(20,22,28,.72) 55%, rgba(20,22,28,.9) 100%)' }} />
      <div className="relative max-w-3xl mx-auto p-6">
      <header className="flex items-center justify-between mb-6">
        <div><Eyebrow className="text-parchment/75">Room code</Eyebrow><h1 className="font-display text-4xl tracking-[0.3em]">{view.code}</h1></div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => window.open('/rules', '_blank', 'noopener')} title="Open the rules in a new window">📜 Rules</Button>
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
            {isHost && <Button variant="ghost" disabled={busy || seatsTotal >= 8} onClick={() => void act(() => api.bot(view.id, 'add'))}>Add a bot</Button>}
            {isHost && <Button disabled={busy} onClick={() => void act(() => api.start(view.id))}>Start the year</Button>}
          </div>
          <p className="text-xs text-ink-2 mt-2">The host sets the table size (4 to 8). Seats without a player are filled by bots, who play random cards, and can win if they out-earn you.</p>
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
            <p className="text-xs text-ink-2 mt-1">{drawing ? `Each round you shuffle your deck of ${seatsTotal * cal.rounds} and draw ${seatsTotal} cards, one for every seat. You place them all.` : `You hold your whole envelope, ${seatsTotal * cal.rounds} cards, and choose what to play each round.`}</p>
          </Panel>
          <Panel title="Settings">
            <SettingRow label="Table size" value={seatsTotal} unit=" seats" host={isHost} onChange={(v) => act(() => api.settings(view.id, { tableSize: v }))} step={1} />
            <SettingRow label="Placement" value={view.settings.placementSeconds} unit="s" host={isHost} onChange={(v) => act(() => api.settings(view.id, { placementSeconds: v }))} step={30} />
            <SettingRow label="Reveal, per scene" value={view.settings.revealStepSeconds ?? 20} unit="s" host={isHost} onChange={(v) => act(() => api.settings(view.id, { revealStepSeconds: v }))} step={5} />
            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-ink-2" title="Market Fair (+1 per wares in Harvest), the Reeve's Tax, and the Hungry Winter">Season rules (variant)</span>
              {isHost ? <button className={`px-2 rounded-sm font-ui text-xs uppercase ${view.settings.seasonRules ? 'bg-gold text-night' : 'bg-night-3'}`} onClick={() => act(() => api.settings(view.id, { seasonRules: !view.settings.seasonRules }))}>{view.settings.seasonRules ? 'On' : 'Off'}</button> : <span className="font-ui">{view.settings.seasonRules ? 'On' : 'Off'}</span>}
            </div>
            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-ink-2" title="On (standard): your envelope is a face-down deck. Each round you shuffle it, draw one card per seat and place them all. Off: the Open Envelope variant, where you hold every card from the start and choose what to play.">Draw from your deck</span>
              {isHost ? <button className={`px-2 rounded-sm font-ui text-xs uppercase ${drawing ? 'bg-gold text-night' : 'bg-night-3'}`} onClick={() => act(() => api.settings(view.id, { drawMode: !drawing }))}>{drawing ? 'On' : 'Off'}</button> : <span className="font-ui">{drawing ? 'On' : 'Off'}</span>}
            </div>
            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-ink-2" title="Every bot puts its heaviest attack in front of you each round, so you can see what dying is like">Test: bots attack me</span>
              {isHost ? <button className={`px-2 rounded-sm font-ui text-xs uppercase ${hunted ? 'bg-blood text-parchment' : 'bg-night-3'}`} onClick={() => act(() => api.settings(view.id, { huntSeat: hunted ? null : (view.me.seat ?? 0) }))}>{hunted ? 'On' : 'Off'}</button> : <span className="font-ui">{hunted ? 'On' : 'Off'}</span>}
            </div>
          </Panel>
        </div>
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
  const c = calendarFor(seats);   // every year is five rounds; the seat count sets the death threshold and the wares kept
  return { rounds: c.rounds, seasons: 'Spring · Harvest · Harvest · Winter · Winter', deathAt: c.deathAt, jobs: c.jobsKept };
}
export type { PlayerView };
