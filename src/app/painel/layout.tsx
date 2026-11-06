'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Ctx, type Profile } from '@/lib/panel';
import { Avatar } from '@/lib/avatar';
import type { Establishment, Role } from '@/lib/types';

const ICONS: Record<string, string> = {
  orders: 'M9 3h6a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h2V4a1 1 0 0 1 1-1z M9 12h6 M9 16h4',
  cashier: 'M3 7h18v12H3z M3 7l2-3h14l2 3 M16 13h2',
  menu: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z M8 7h7',
  tables: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h3v3h-3z M19 19h1',
  look: 'M4 7h10 M18 7h2 M4 17h2 M10 17h10 M14 5v4 M6 15v4',
};
function Icon({ name }: { name: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

const NAV: { href: string; label: string; icon: string; roles: Role[] }[] = [
  { href: '/painel', label: 'Pedidos', icon: 'orders', roles: ['owner', 'waiter', 'cashier'] },
  { href: '/painel/caixa', label: 'Caixa', icon: 'cashier', roles: ['owner', 'cashier'] },
  { href: '/painel/cardapio', label: 'Cardápio', icon: 'menu', roles: ['owner'] },
  { href: '/painel/mesas', label: 'Mesas e QR', icon: 'tables', roles: ['owner'] },
  { href: '/painel/aparencia', label: 'Aparência', icon: 'look', roles: ['owner'] },
];
const ROLE: Record<Role, string> = { owner: 'Proprietário', waiter: 'Garçom', cashier: 'Caixa' };

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [s, setS] = useState<{ est: Establishment; role: Role; userId: string; email: string; profile: Profile } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.replace('/login');
      const { data: prof } = await supabase.from('profiles').select('role, establishment_id, name, avatar_url').eq('id', session.user.id).maybeSingle();
      if (!prof) return router.replace('/login');
      const { data: est } = await supabase.from('establishments').select('*').eq('id', prof.establishment_id).single();
      setS({
        est: est as Establishment, role: prof.role as Role, userId: session.user.id,
        email: session.user.email ?? '', profile: { name: prof.name, avatar_url: prof.avatar_url },
      });
    })();
  }, [router]);

  if (!s) return <div className="pos-ui flex items-center justify-center text-muted">Carregando…</div>;

  const items = NAV.filter((n) => n.roles.includes(s.role));
  const onProfile = path === '/painel/perfil';
  const current = onProfile ? { href: '/painel/perfil', label: 'Meu perfil' } : (items.find((n) => n.href === path) ?? items[0]);
  const signOut = async () => { await supabase.auth.signOut(); router.replace('/login'); };

  return (
    <Ctx.Provider value={{ ...s, setEst: (est) => setS((p) => p && { ...p, est }), setProfile: (profile) => setS((p) => p && { ...p, profile }) }}>
      <div className="pos-ui md:flex">
        <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-side p-4 text-neutral-300 md:flex lg:w-64">
          <div className="mb-6 flex items-center gap-3 px-2 pt-2">
            {s.est.logo_url
              ? <img src={s.est.logo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
              : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent font-bold text-white">{s.est.name.slice(0, 1).toUpperCase()}</span>}
            <div className="min-w-0">
              <h1 className="truncate text-lg leading-tight text-white">{s.est.name}</h1>
              <p className="text-xs text-neutral-400">{ROLE[s.role]}</p>
            </div>
          </div>
          <nav className="flex flex-col gap-1">
            {items.map((n) => {
              const active = n.href === current.href;
              return (
                <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-base font-semibold ${active ? 'bg-accent text-white' : 'hover:bg-white/10'}`}>
                  <Icon name={n.icon} />{n.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto space-y-2 text-sm font-semibold">
            <Link href="/painel/perfil" aria-current={onProfile ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 ${onProfile ? 'bg-white/15' : 'hover:bg-white/10'}`}>
              <Avatar url={s.profile.avatar_url} name={s.profile.name || s.email} size={36} />
              <span className="min-w-0 text-left">
                <span className="block truncate text-sm text-white">{s.profile.name || s.email}</span>
                <span className="block text-xs font-normal text-neutral-400">Meu perfil</span>
              </span>
            </Link>
            <a href={`/c/${s.est.slug}`} target="_blank" className="block rounded-xl bg-white/10 px-3 py-3 text-center text-white">Abrir cardápio</a>
            <button onClick={signOut} className="w-full px-3 py-2 text-neutral-400 hover:text-white">Sair</button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="no-print sticky top-0 z-30 flex items-center justify-between bg-side px-4 py-3 text-white md:hidden">
            <h1 className="truncate text-lg">{s.est.name}</h1>
            <div className="flex items-center gap-4">
              <Link href="/painel/perfil" aria-label="Meu perfil"><Avatar url={s.profile.avatar_url} name={s.profile.name || s.email} size={32} /></Link>
              <button onClick={signOut} className="text-sm text-neutral-400">Sair</button>
            </div>
          </header>
          <main className="mx-auto max-w-6xl p-4 pb-28 md:p-8">
            <h2 className="no-print mb-6 text-3xl">{current.label}</h2>
            {children}
          </main>
        </div>

        <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex bg-side md:hidden">
          {items.map((n) => {
            const active = n.href === current.href;
            return (
              <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined}
                className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold ${active ? 'text-accent' : 'text-neutral-400'}`}>
                <Icon name={n.icon} />{n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </Ctx.Provider>
  );
}
