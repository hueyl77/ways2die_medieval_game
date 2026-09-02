import type { ReactNode } from 'react';
import { CardArt, CardFace } from '../components/Card';
import { TRADES, TRADE_INFO, roleArt, signatureKeys, def } from '../engine/cards.ts';
import { calendarPreview } from './Room';

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-14 scroll-mt-6">
      <div className="font-ui text-[11px] tracking-[0.22em] uppercase text-gold">{eyebrow}</div>
      <h2 className="font-display text-3xl mt-1 mb-4 text-parchment">{title}</h2>
      {children}
    </section>
  );
}
function Callout({ title, children }: { title: string; children: ReactNode }) {
  return <div className="bg-night-2 border-l-4 border-gold rounded-r-md px-4 py-3 my-4 max-w-2xl"><div className="font-display text-gold">{title}</div><div className="text-parchment/90">{children}</div></div>;
}
function Step({ n, title, children, art }: { n: number; title: string; children: ReactNode; art?: ReactNode }) {
  return (
    <div className="bg-night-2 border border-night-3 rounded-md p-4 flex gap-4 items-start">
      {art && <div className="shrink-0">{art}</div>}
      <div><div className="font-ui text-[11px] tracking-[0.2em] uppercase text-ink-2">Step {n}</div><div className="font-display text-xl text-gold">{title}</div><div className="text-sm mt-1">{children}</div></div>
    </div>
  );
}
const Portrait = ({ trade, width = 150 }: { trade: (typeof TRADES)[number]; width?: number }) => (
  <div className="card-face relative rounded-md overflow-hidden shadow-card bg-night-3" style={{ width }}>
    <img src={`/cards/${roleArt(trade)}.jpg`} alt={TRADE_INFO[trade].name} className="absolute inset-0 w-full h-full object-cover" />
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 pt-6 pb-1.5"><div className="font-display text-parchment">{TRADE_INFO[trade].emoji} {TRADE_INFO[trade].name}</div><div className="font-ui text-[10px] uppercase tracking-wider text-gold">{TRADE_INFO[trade].verb}</div></div>
  </div>
);

export default function Rules() {
  const nav = [['idea', 'The idea'], ['envelope', 'Your envelope'], ['round', 'A round'], ['resolve', 'How a pile resolves'], ['wounds', 'Wounds & gold'], ['trades', 'The twelve trades'], ['death', 'Death & ghosts'], ['winning', 'Winning'], ['manners', 'Table manners'], ['seats', 'Seats & rounds']];
  return (
    <div className="min-h-full">
      <header className="bg-gradient-to-b from-night-2 to-night px-6 pt-10 pb-8 border-b border-night-3">
        <div className="max-w-5xl mx-auto flex flex-wrap items-end gap-8">
          <div className="flex-1 min-w-[260px]">
            <div className="text-4xl mb-1">💀</div>
            <div className="font-ui text-[11px] tracking-[0.22em] uppercase text-ink-2">Honest trades, unfortunate accidents</div>
            <h1 className="font-display text-5xl leading-none mt-1 text-parchment">A Million Ways to Die in Medieval</h1>
            <p className="mt-4 text-lg max-w-xl text-parchment/90">Every villager runs a secret trade. Every coin you earn is a clue about who you are. And the neighbors keep having accidents — bees, geese, falling roof tiles, the occasional trebuchet — that nobody ever saw anyone arrange.</p>
            <p className="mt-3 text-sm text-ink-2">The illustrated rules below cover everything you need to play. <a className="text-gold underline" href="/rules.html" target="_blank" rel="noopener">The full rulebook</a> has every card's exact wording and the rulings.</p>
          </div>
          <div className="flex gap-2 -rotate-2">
            <CardFace cardKey="mishap:the-goose" width={120} preview={false} />
            <CardFace cardKey="calamity:cathedral-scaffold" width={120} preview={false} className="translate-y-3" />
            <CardFace cardKey="sig:silver-dagger" width={120} preview={false} className="translate-y-6" />
          </div>
        </div>
        <nav className="max-w-5xl mx-auto mt-6 flex flex-wrap gap-x-4 gap-y-1 font-ui text-xs uppercase tracking-wider">
          {nav.map(([id, label]) => <a key={id} href={`#${id}`} className="text-ink-2 hover:text-gold">{label}</a>)}
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-20">
        <Section id="idea" eyebrow="The idea" title="Get rich. Stay alive. Stay unknown.">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-night-2 border border-night-3 rounded-md p-4 flex gap-3"><Portrait trade="thief" width={90} /><div><div className="font-display text-gold text-lg">A secret trade</div><p className="text-sm">At the start you open an envelope and become one of twelve trades. Nobody else knows which. Keep it that way.</p></div></div>
            <div className="bg-night-2 border border-night-3 rounded-md p-4 flex gap-3"><CardFace cardKey="job:jeweler" width={90} preview={false} /><div><div className="font-display text-gold text-lg">Gold for your trade</div><p className="text-sm">Gold is earned by <em>trades</em>, not players, on a public board. Selling wares fills your track — and tells the table something about who you are.</p></div></div>
            <div className="bg-night-2 border border-night-3 rounded-md p-4 flex gap-3"><CardFace cardKey="mishap:bee-swarm" width={90} preview={false} /><div><div className="font-display text-gold text-lg">Accidents happen</div><p className="text-sm">Every card you play is placed face-down and shuffled before it's revealed. Nobody can prove who arranged the goose.</p></div></div>
          </div>
          <Callout title="The object">Be alive at the end of the year with the richest trade at the table. Bots and strangers compete on equal terms.</Callout>
        </Section>

        <Section id="envelope" eyebrow="Your envelope" title="What you hold">
          <p className="max-w-2xl mb-4">Every seat holds the same shape of hand: enough cards to place one in front of every seat every round. Hover any card to read it large.</p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="text-center"><CardFace cardKey="job:carpenter" width={104} /><div className="text-xs mt-1 font-ui">Wares · most of your hand</div></div>
            <div className="text-center"><CardFace cardKey="heal" width={104} /><div className="text-xs mt-1 font-ui">Heal × 2</div></div>
            <div className="text-center"><CardFace cardKey="protect" width={104} /><div className="text-xs mt-1 font-ui">Protect × 1</div></div>
            <div className="text-center"><CardFace cardKey="alms:carpenter" width={104} /><div className="text-xs mt-1 font-ui">Alms × 1 · for your trade</div></div>
            <div className="text-center"><CardFace cardKey="mishap:hidden-rake" width={104} /><div className="text-xs mt-1 font-ui">Mishap × 4 · 1 wound</div></div>
            <div className="text-center"><CardFace cardKey="calamity:trebuchet-practice" width={104} /><div className="text-xs mt-1 font-ui">Calamity × 1 · 2 wounds</div></div>
            <div className="text-center"><CardFace cardKey="sig:hearty-stew" width={104} /><div className="text-xs mt-1 font-ui">Signature × 3 · your trade's</div></div>
          </div>
          <ul className="mt-5 space-y-1.5 max-w-2xl text-sm">
            <li><b className="text-gold">Wares</b> bank 1 gold to your trade's track no matter which pile they land in — placing them in front of an enemy is perfectly safe.</li>
            <li><b className="text-gold">Attacks</b> (Mishaps and Calamities) wound whoever's pile they're in. Which accidents you drew is your secret; the table only knows everyone holds four small ones and one big one.</li>
            <li><b className="text-gold">Heal</b> removes a wound from the pile's owner; <b className="text-gold">Protect</b> voids every attack in its pile that round.</li>
            <li><b className="text-gold">Alms</b> is the catch-up card, printed for your own trade. It is judged first, before the round's wares are counted: if your trade is clearly last or second-to-last among the trades still in play (ties — like everyone at 0 — do nothing), it gains 5 gold. Playing it also tells the table your trade is in the game.</li>
            <li><b className="text-gold">Signature cards</b> are unique to your trade — powerful, and a confession: revealing one proves your trade is at the table (though never which chair).</li>
          </ul>
        </Section>

        <Section id="round" eyebrow="A round" title="Place, lock in, reveal">
          <div className="grid md:grid-cols-3 gap-4">
            <Step n={1} title="Place one card per seat" art={<CardFace cardKey="job:farmer" width={72} preview={false} />}>Drag a card from your hand onto every seat, including your own. Talk while you do it — accuse, deny, promise, lie. Nothing said is binding.</Step>
            <Step n={2} title="Lock in" art={<CardArt cardKey="protect" width={72} />}>When every seat has a card, lock in. The round ends when everyone has, or when the timer runs out (a late player's cards are placed at random).</Step>
            <Step n={3} title="Shuffle and reveal" art={<img src="/cards/basic-card-back.jpg" alt="card back" className="rounded-md shadow-card" style={{ width: 72 }} />}>Each pile is shuffled before it flips, so no card can ever be traced to who placed it. The reveal plays one scene at a time — each pile, then wounds, deaths, the ledger — and moves on when everyone clicks Next.</Step>
          </div>
          <Callout title="The one card that's yours to know">You know exactly one card in exactly one pile: the one you placed in front of yourself. Subtract it, and what's left is the table's true intent toward you.</Callout>
        </Section>

        <Section id="resolve" eyebrow="How a pile resolves" title="In this order, every pile">
          <ol className="grid md:grid-cols-2 gap-2 list-none max-w-3xl">
            {[
              ['Voids', 'Protects and other cards that cancel attacks or heals act first. Silver Dagger and Sneak Attack ignore Protects.'],
              ['Wounds', 'Each surviving attack stays in front of its victim as a wound (a second wound rides on a token).'],
              ['Heals', 'Each Heal removes one wound. Attacks and Heals in the same pile net out — a Heal can save you from a killing blow.'],
              ['Deaths', 'Reach your death number and you die at the end of the pile — funeral after the round.'],
              ['Gold', 'Alms is judged first on the board as it stood; then wares bank 1 each; then signature gold effects.'],
              ['Words', 'Truth cards (Inquest, Appraisal, Tracks in the Snow) are answered by the game itself — no lying possible.'],
            ].map(([t, d], i) => <li key={t} className="bg-night-2 border border-night-3 rounded-md p-3 flex gap-3"><span className="font-display text-2xl text-gold w-6">{i + 1}</span><div><div className="font-display text-parchment">{t}</div><div className="text-sm text-parchment/85">{d}</div></div></li>)}
          </ol>
        </Section>

        <Section id="wounds" eyebrow="Wounds & gold" title="Every wound is a coin">
          <div className="grid md:grid-cols-2 gap-6 items-start">
            <div>
              <p className="text-sm">Wounds are the attack cards themselves, left face-up in front of you, so everyone can see how close to death everyone else is. Hit your death number — <b className="text-gold">3 wounds at a table of 4–5, 4 wounds at 6 or more</b> — and you die.</p>
              <p className="text-sm mt-3">At the final count <b className="text-gold">every wound you still carry costs your trade 1 gold</b>. So an attack that doesn't kill still pays, and a heal is worth a coin to whoever receives it.</p>
              <p className="text-sm mt-3">A dead player's trade is revealed and its track locks — it can no longer gain, lose, or win.</p>
            </div>
            <div className="flex gap-3 items-end">
              <div className="text-center"><CardFace cardKey="mishap:falling-roof-tile" width={96} /><div className="text-xs mt-1 font-ui">1 wound, −1 gold at the end</div></div>
              <div className="text-center"><CardFace cardKey="calamity:through-the-ice" width={96} /><div className="text-xs mt-1 font-ui">2 wounds, −2 gold</div></div>
              <div className="text-center"><CardFace cardKey="heal" width={96} /><div className="text-xs mt-1 font-ui">takes one back</div></div>
            </div>
          </div>
        </Section>

        <Section id="trades" eyebrow="The twelve trades" title="Every trade has a verb — and three signature cards">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TRADES.map((t) => (
              <div key={t} className="bg-night-2 border border-night-3 rounded-md p-3 flex gap-3">
                <Portrait trade={t} width={110} />
                <ul className="text-xs space-y-1.5 min-w-0">
                  {signatureKeys(t).map((k) => <li key={k}><span className="font-display text-gold">{def(k).name}</span> — {def(k).text}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <Section id="death" eyebrow="Death & ghosts" title="The village keeps its ghosts">
          <div className="grid md:grid-cols-3 gap-4">
            <Step n={1} title="The funeral">Your envelope opens: your trade is announced and its track locks. Your remaining hand becomes your <b>grave pool</b>, and your seat stays at the table as a grave that the living must still place a card on every round.</Step>
            <Step n={2} title="Seal your will">Secretly choose a living player as your heir. If they win the year, you rise to share it. They will never know — and each player can be someone's heir only once.</Step>
            <Step n={3} title="Haunt">You're a ghost now: keep talking, and each round you may slip one card from your grave pool into any living pile. The table sees which pile the grave visited — never what it sent.</Step>
          </div>
        </Section>

        <Section id="winning" eyebrow="Winning" title="The final reveal">
          <p className="max-w-2xl text-sm">After the last round every envelope opens at once. Apply scoring cards, then subtract a coin per wound. <b className="text-gold">The living seat — player or bot — with the richest trade wins.</b> Ties go to the fewest wounds; if still tied, the winners share it. Then the wills are opened: a ghost whose heir won rises with them. If everyone dies, the village stands empty and nobody wins.</p>
        </Section>

        <Section id="manners" eyebrow="Table manners" title="The laws of the village">
          <ul className="max-w-2xl text-sm space-y-1.5">
            <li><b className="text-gold">Never show cards</b> — not your hand, not your role. The only reveals are funerals, the final reveal, and a Strong Ale.</li>
            <li><b className="text-gold">Say anything.</b> Promises are not binding. Truth cards are answered by the game, so those can't be dodged.</li>
            <li><b className="text-gold">Leaving.</b> If you leave a running game your seat plays on as a bot; the last human at a table can cancel the game.</li>
          </ul>
        </Section>

        <Section id="seats" eyebrow="Seats & rounds" title="How long is a year?">
          <p className="max-w-2xl text-sm mb-3">The host sets the table size (4–12). Seats without a player are filled by bots, who play random cards and can win if they out-earn you.</p>
          <div className="overflow-x-auto"><table className="text-sm font-ui border-collapse">
            <thead><tr className="text-[11px] uppercase tracking-wider text-ink-2"><th className="text-left pr-6 pb-1">Seats</th><th className="text-left pr-6 pb-1">Rounds</th><th className="text-left pr-6 pb-1">Wares kept</th><th className="text-left pr-6 pb-1">You die at</th></tr></thead>
            <tbody>{[4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => { const c = calendarPreview(n); return <tr key={n} className="border-t border-night-3"><td className="pr-6 py-1">{n}</td><td className="pr-6">{c.rounds}</td><td className="pr-6">{c.jobs}</td><td className="pr-6">{c.deathAt} wounds</td></tr>; })}</tbody>
          </table></div>
        </Section>
      </main>
    </div>
  );
}
