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

  if (!s) return <p className="p-8 text-center text-gray-500">Carregando…</p>;

  return (
    <Ctx.Provider value={{ ...s, setEst: (est) => setS({ ...s, est }) }}>
      <div className="min-h-screen">
        <header className="no-print sticky top-0 z-30 bg-gray-900 text-white">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="truncate font-bold">{s.est.name}</p>
            <div className="flex items-center gap-3 text-sm">
              <a href={`/c/${s.est.slug}`} target="_blank" className="underline">Ver cardápio</a>
              <button onClick={async () => { await supabase.auth.signOut(); router.replace('/login'); }}>Sair</button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-2 pb-2">
            {NAV.filter((n) => n.roles.includes(s.role)).map((n) => (
              <Link key={n.href} href={n.href}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold ${path === n.href ? 'bg-white text-gray-900' : 'text-gray-300'}`}>
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <div className="mx-auto max-w-5xl p-4">{children}</div>
      </div>
    </Ctx.Provider>
  );
}
