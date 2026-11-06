'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Ctx } from '@/lib/panel';
import type { Establishment, Role } from '@/lib/types';

const NAV: { href: string; label: string; roles: Role[] }[] = [
  { href: '/painel', label: 'Pedidos', roles: ['owner', 'waiter', 'cashier'] },
  { href: '/painel/caixa', label: 'Caixa', roles: ['owner', 'cashier'] },
  { href: '/painel/cardapio', label: 'Cardápio', roles: ['owner'] },
  { href: '/painel/mesas', label: 'Mesas e QR', roles: ['owner'] },
  { href: '/painel/aparencia', label: 'Aparência', roles: ['owner'] },
];
const ROLE: Record<Role, string> = { owner: 'Proprietário', waiter: 'Garçom', cashier: 'Caixa' };

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [s, setS] = useState<{ est: Establishment; role: Role; userId: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.replace('/login');
      const { data: prof } = await supabase.from('profiles').select('role, establishment_id').eq('id', session.user.id).maybeSingle();
      if (!prof) return router.replace('/login');
      const { data: est } = await supabase.from('establishments').select('*').eq('id', prof.establishment_id).single();
      setS({ est: est as Establishment, role: prof.role as Role, userId: session.user.id });
    })();
  }, [router]);

  if (!s) return <div className="dark-ui flex items-center justify-center text-muted">Carregando…</div>;

  const items = NAV.filter((n) => n.roles.includes(s.role));
  const current = items.find((n) => n.href === path) ?? items[0];
  const signOut = async () => { await supabase.auth.signOut(); router.replace('/login'); };

  return (
    <Ctx.Provider value={{ ...s, setEst: (est) => setS({ ...s, est }) }}>
      <div className="dark-ui md:flex">
        <aside className="no-print sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-line bg-surface p-5 md:flex lg:w-64">
          <div className="mb-8">
            {s.est.logo_url && <img src={s.est.logo_url} alt="" className="mb-3 h-12 w-12 rounded-full object-cover" />}
            <h1 className="text-2xl leading-tight">{s.est.name}</h1>
            <p className="mt-1 text-sm text-muted">{ROLE[s.role]}</p>
          </div>
          <nav className="flex flex-col gap-1">
            {items.map((n) => {
              const active = n.href === current.href;
              return (
                <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined}
                  className={`rounded-lg border-l-4 px-3 py-3 text-base ${active ? 'border-brass bg-raised font-semibold text-bone' : 'border-transparent text-muted hover:text-bone'}`}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto space-y-3 text-sm">
            <a href={`/c/${s.est.slug}`} target="_blank" className="block text-muted hover:text-bone">Abrir cardápio</a>
            <button onClick={signOut} className="text-muted hover:text-bone">Sair</button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
            <h1 className="truncate text-lg">{s.est.name}</h1>
            <button onClick={signOut} className="text-sm text-muted">Sair</button>
          </header>
          <main className="mx-auto max-w-5xl p-4 pb-28 md:p-8">
            <h2 className="no-print mb-6 text-3xl">{current.label}</h2>
            {children}
          </main>
        </div>

        <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface md:hidden">
          {items.map((n) => {
            const active = n.href === current.href;
            return (
              <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined}
                className={`flex-1 border-t-2 px-1 py-3 text-center text-xs ${active ? 'border-brass font-semibold text-bone' : 'border-transparent text-muted'}`}>
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </Ctx.Provider>
  );
}
