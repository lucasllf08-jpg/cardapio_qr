'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePanel } from '@/lib/panel';
import { brl, fmtTime } from '@/lib/utils';

type Line = { name: string; quantity: number; unit_price: number; note: string | null; addons: { name: string }[] };
type Tab = { id: string; opened_at: string; tables: { number: number }; orders: { status: string; order_items: Line[] }[] };

const totalOf = (t: Tab) =>
  t.orders.filter((o) => o.status !== 'cancelled')
    .reduce((s, o) => s + o.order_items.reduce((x, i) => x + Number(i.unit_price) * i.quantity, 0), 0);

export default function CashierPage() {
  const { est } = usePanel();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [bills, setBills] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [t, b] = await Promise.all([
      supabase.from('tabs')
        .select('id,opened_at,tables(number),orders(status,order_items(name,quantity,unit_price,note,addons))')
        .eq('establishment_id', est.id).eq('status', 'open').order('opened_at'),
      supabase.from('service_calls').select('tables(number)')
        .eq('establishment_id', est.id).eq('type', 'bill').eq('status', 'pending'),
    ]);
    setTabs((t.data ?? []) as unknown as Tab[]);
    setBills(((b.data ?? []) as any[]).map((x) => x.tables.number));
  }, [est.id]);

  useEffect(() => {
    load();
    const ch = supabase.channel('cashier-' + est.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `establishment_id=eq.${est.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_calls', filter: `establishment_id=eq.${est.id}` }, load)
      .subscribe();
    const t = setInterval(load, 15000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [est.id, load]);

  async function close(t: Tab) {
    if (!confirm(`Fechar a comanda da Mesa ${t.tables.number} (${brl(totalOf(t))})?`)) return;
    const { error } = await supabase.rpc('close_tab', { p_tab_id: t.id });
    if (error) alert(error.message);
    setOpen(null); load();
  }

  const list = tabs.filter((t) => !search || String(t.tables.number) === search.trim())
    .sort((a, b) => Number(bills.includes(b.tables.number)) - Number(bills.includes(a.tables.number)));

  return (
    <div className="space-y-4">
      <input className="input" inputMode="numeric" placeholder="Buscar mesa pelo número" value={search} onChange={(e) => setSearch(e.target.value)} />
      {list.length === 0 && <p className="text-muted">Nenhuma comanda aberta.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((t) => {
          const wantsBill = bills.includes(t.tables.number);
          return (
            <div key={t.id} className={`card ${wantsBill ? "!border-brass" : ""}`}>
              <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen(open === t.id ? null : t.id)}>
                <div>
                  <p className="font-display text-3xl font-semibold leading-none">Mesa {t.tables.number}</p>
                  <p className="text-sm text-muted">Aberta às {fmtTime(t.opened_at)}{wantsBill && ' · 🧾 pediu a conta'}</p>
                </div>
                <p className="font-display text-3xl font-semibold text-brass">{brl(totalOf(t))}</p>
              </button>
              {open === t.id && (
                <div className="mt-3 space-y-2 border-t pt-3">
                  {t.orders.filter((o) => o.status !== 'cancelled').flatMap((o) => o.order_items).map((i, k) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span>{i.quantity}x {i.name}{i.addons?.length > 0 && ` (+ ${i.addons.map((a) => a.name).join(', ')})`}</span>
                      <span>{brl(Number(i.unit_price) * i.quantity)}</span>
                    </div>
                  ))}
                  <button className="btn-green w-full" onClick={() => close(t)}>Receber e fechar comanda</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
