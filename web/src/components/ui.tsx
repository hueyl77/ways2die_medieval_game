import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function Button({ variant = 'primary', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const base = 'font-ui font-bold tracking-wide uppercase text-sm px-4 py-2 rounded-sm transition disabled:opacity-40 disabled:cursor-not-allowed';
  const v = variant === 'primary' ? 'bg-gold text-night hover:bg-gold/90' : variant === 'danger' ? 'bg-blood text-parchment hover:bg-blood/90' : 'bg-night-3 text-parchment hover:bg-night-3/70 border border-night-3';
  return <button className={`${base} ${v} ${className}`} {...rest} />;
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full bg-night-2 border border-night-3 rounded-sm px-3 py-2 text-parchment placeholder:text-ink-2 focus:outline-none focus:border-gold ${props.className ?? ''}`} />;
}
export function Panel({ title, children, className = '' }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-night-2 border border-night-3 rounded-md p-4 ${className}`}>
      {title && <h2 className="font-display text-gold text-lg mb-3">{title}</h2>}
      {children}
    </section>
  );
}
export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="font-ui text-[11px] tracking-[0.2em] uppercase text-ink-2">{children}</div>;
}
export const CREST_HEX: Record<string, string> = {
  crimson: '#B23A48', azure: '#3B6EA8', emerald: '#2F8F5B', gold: '#D8A84F', violet: '#7B4FA6', umber: '#8A5A2B',
  ivory: '#E6E1D3', teal: '#2A8C8C', rose: '#D77A9C', slate: '#6B7A8F', amber: '#E0862B', moss: '#6E8B3D', stranger: '#555',
};
export function Crest({ color, size = 18 }: { color: string; size?: number }) {
  return <span className="inline-block rounded-full border border-black/40 shadow-inner align-middle" style={{ width: size, height: size, background: CREST_HEX[color] ?? '#888' }} />;
}
