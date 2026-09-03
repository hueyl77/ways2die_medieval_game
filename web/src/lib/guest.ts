// A guest is a nickname plus a token signed by the game function, kept on this device only.
export interface Guest { token: string; id: string; name: string; exp: number }

const KEY = 'mwtd.guest';

export function getGuest(): Guest | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const g = JSON.parse(raw) as Guest;
    if (!g?.token || !g.id || !g.name || typeof g.exp !== 'number' || g.exp <= Date.now()) { localStorage.removeItem(KEY); return null; }
    return g;
  } catch { return null; }
}

export function setGuest(g: Guest): void { try { localStorage.setItem(KEY, JSON.stringify(g)); } catch { /* private mode: the guest lasts for this page only */ } }
export function clearGuest(): void { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
