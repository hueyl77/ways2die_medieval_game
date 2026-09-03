// Nicknames: shape rules plus a profanity filter, shared by the client (instant feedback) and the game function (enforcement).

const MIN = 2, MAX = 16;

// Leetspeak and look-alike characters folded before matching
const FOLD: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '6': 'g', '7': 't', '8': 'b', '9': 'g', '@': 'a', '$': 's', '!': 'i', '|': 'i', '+': 't', '€': 'e', '£': 'l' };

// Matched anywhere inside a token (unambiguous even when glued to other letters)
const ANYWHERE = ['fuck', 'fuk', 'phuck', 'cunt', 'nigg', 'faggot', 'fagot', 'motherfuck', 'cocksuck', 'blowjob', 'handjob', 'jerkoff', 'jackoff', 'kike', 'wetback', 'retard', 'whore', 'slut', 'bitch', 'asshole', 'arsehole', 'dildo', 'jizz', 'tranny', 'shit', 'pussy', 'twat', 'wanker', 'hitler', 'porn', 'vagina', 'fellat', 'cumshot', 'bukkake', 'rimjob', 'buttfuck', 'dickhead', 'douchebag', 'goddamn', 'bullshit', 'pedophil', 'paedophil', 'molest', 'rapist', 'raping', 'genocid', 'negro', 'darkie', 'raghead', 'towelhead', 'beaner', 'honky', 'zipperhead'];
// Matched only as a whole token (these live inside plenty of innocent words)
const WHOLE = ['ass', 'arse', 'cum', 'cock', 'dick', 'tits', 'tit', 'coon', 'spic', 'chink', 'gook', 'pedo', 'rape', 'nazi', 'anal', 'anus', 'clit', 'boob', 'boobs', 'piss', 'prick', 'dyke', 'paki', 'kys', 'homo', 'fag', 'fags', 'bastard', 'shag', 'bollocks', 'bugger', 'wog', 'wank', 'poon', 'penis', 'scrotum', 'testicle', 'sex', 'sexy', 'dong', 'schlong', 'knob', 'nonce', 'skank', 'hoe', 'thot', 'incel', 'kkk', 'isis', 'jihad', 'terrorist', 'suicide', 'murder', 'killer', 'cracker', 'gringo'];
// Tokens that contain an ANYWHERE term but are ordinary words or places
const ALLOW = new Set(['scunthorpe', 'penistone', 'assassin', 'assassins', 'shiitake', 'shitake', 'pussycat', 'therapist', 'cummings', 'analyst']);

const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split('').map((c) => FOLD[c] ?? c).join('');
const letters = (s: string) => fold(s).replace(/[^a-z]/g, '');
const variants = (t: string) => new Set([t, t.replace(/(.)\1{2,}/g, '$1$1'), t.replace(/(.)\1+/g, '$1')]);   // 'fuuuck' → 'fuuck' / 'fuck'

/** True when the text contains profanity, a slur, or a thin disguise of one (leetspeak, dots, spaces, stretched letters). */
export function isProfane(raw: string): boolean {
  const tokens = raw.toLowerCase().split(/[^\p{L}\p{N}@$!|+€£]+/u).map(letters).filter(Boolean);
  const kept = tokens.filter((t) => !ALLOW.has(t));
  const candidates = new Set<string>();
  for (const t of kept) for (const v of variants(t)) candidates.add(v);
  for (const v of variants(kept.join(''))) candidates.add(v);   // 'f u c k', 'f.u.c.k', 'fu-ck'
  for (const c of candidates) {
    if (!c || ALLOW.has(c)) continue;
    if (WHOLE.includes(c)) return true;
    if (ANYWHERE.some((w) => c.includes(w))) return true;
  }
  return false;
}

export type NicknameCheck = { ok: true; name: string } | { ok: false; reason: string };

/** Trims and tidies a nickname and says whether it may be used at the table. */
export function checkNickname(raw: string): NicknameCheck {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (name.length < MIN) return { ok: false, reason: `Use at least ${MIN} characters.` };
  if (name.length > MAX) return { ok: false, reason: `Keep it to ${MAX} characters.` };
  if (!/^[\p{L}\p{N} _'.-]+$/u.test(name)) return { ok: false, reason: "Letters, numbers, spaces, and _ ' . - only." };
  if (!/\p{L}/u.test(name)) return { ok: false, reason: 'Include at least one letter.' };
  if (isProfane(name)) return { ok: false, reason: 'That name would get you thrown out of the tavern. Pick another.' };
  return { ok: true, name };
}

/** A name safe to show at the table: the cleaned input, or the fallback when it is missing or foul. */
export function safeName(raw: unknown, fallback: string): string {
  const c = checkNickname(String(raw ?? ''));
  return c.ok ? c.name : fallback;
}
