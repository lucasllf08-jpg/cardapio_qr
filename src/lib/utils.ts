export const brl = (n: number) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function onColor(hex: string) {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(f.slice(0, 2), 16), g = parseInt(f.slice(2, 4), 16), b = parseInt(f.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111827' : '#ffffff';
}

export const FONTS: Record<string, string> = {
  urbanist: 'Urbanist', inter: 'Inter', poppins: 'Poppins', merriweather: 'Merriweather', nunito: 'Nunito',
};
export const fontStack = (f: string) => `var(--font-${f}), system-ui, sans-serif`;

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const parsePrice = (s: string) => parseFloat(s.replace(',', '.'));

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
export const dayLabel = (day: string, short = false) =>
  new Date(day + 'T12:00:00').toLocaleDateString('pt-BR', short ? { day: '2-digit' } : { weekday: 'short', day: '2-digit' }).replace('.', '');
