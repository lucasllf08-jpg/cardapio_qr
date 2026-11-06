'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePanel } from '@/lib/panel';
import { beep, enableSound } from '@/lib/sound';
import { fmtTime } from '@/lib/utils';

type Item = { id: string; name: string; quantity: number; note: string | null; addons: { name: string }[] };
type Order = { id: string; status: string; note: string | null; created_at: string; tabs: { tables: { number: number } }; order_items: Item[] };
type Call = { id: string; type: 'waiter' | 'bill'; created_at: string; tables: { number: number } };

const LABEL: Record<string, string> = { new: 'Novo', preparing: 'Em preparo', delivered: 'Entregue', cancelled: 'Cancelado' };

export default function OrdersPage() {
  const { est, role } = usePanel();
  const [view, setView] = useState<'active' | 'history'>('active');
  const [orders, setOrders] = useState<Order[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [live, setLive] = useState(false);
  const [soundOn, setSoundOn] = useState(false);

  const load = useCallback(async () => {
    const base = supabase.from('orders')
      .select('id,status,note,created_at,tabs(tables(number)),order_items(id,name,quantity,note,addons)')
      .eq('establishment_id', est.id);
    const q = view === 'active'
      ? base.in('status', ['new', 'preparing']).order('created_at', { ascending: true })
      : base.in('status', ['delivered', 'cancelled']).order('created_at', { ascending: false }).limit(100);
    const [o, c] = await Promise.all([
      q,
      supabase.from('service_calls').select('id,type,created_at,tables(number)')
        .eq('establishment_id', est.id).eq('status', 'pending').order('created_at'),
    ]);
    setOrders((o.data ?? []) as unknown as Order[]);
    setCalls((c.data ?? []) as unknown as Call[]);
  }, [est.id, view]);

  useEffect(() => {
    load();
    const filter = `establishment_id=eq.${est.id}`;
    const ch = supabase.channel('panel-' + est.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter }, (p) => { if (p.eventType === 'INSERT') beep(); load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_calls', filter }, (p) => { if (p.eventType === 'INSERT') beep(); load(); })
      .subscribe((s) => setLive(s === 'SUBSCRIBED'));
    const t = setInterval(load, 20000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [est.id, load]);

  async function setStatus(id: string, status: string) {
    if (status === 'cancelled' && !confirm('Cancelar este pedido?')) return;
    if (role === 'waiter' && status === 'cancelled') return alert('Apenas caixa ou dono podem cancelar.');
    const { error } = await supabase.from('orders').update({ status }).eq('id', id);
    if (error) alert(error.message);
    load();
  }
  async function doneCall(id: string) {
    await supabase.from('service_calls').update({ status: 'done' }).eq('id', id);
    load();
  }

  const col = (status: string) => orders.filter((o) => o.status === status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className={view === 'active' ? 'btn-dark' : 'btn-light'} onClick={() => setView('active')}>Ativos</button>
        <button className={view === 'history' ? 'btn-dark' : 'btn-light'} onClick={() => setView('history')}>Histórico</button>
        <span className={`ml-auto text-sm ${live ? 'text-emerald-600' : 'text-red-600'}`}>● {live ? 'Ao vivo' : 'Reconectando…'}</span>
        {!soundOn && <button className="btn-amber" onClick={() => { enableSound(); setSoundOn(true); }}>🔔 Ativar som</button>}
      </div>

      {calls.length > 0 && (
        <div className="space-y-2">
          {calls.map((c) => (
            <div key={c.id} className={`flex items-center justify-between rounded-2xl p-4 text-white ${c.type === 'bill' ? 'bg-purple-600' : 'bg-red-600'}`}>
              <p className="text-lg font-bold">Mesa {c.tables.number} {c.type === 'bill' ? 'pediu a conta' : 'está chamando'} · {fmtTime(c.created_at)}</p>
              <button className="btn bg-white/25 text-white" onClick={() => doneCall(c.id)}>Atendido</button>
            </div>
          ))}
        </div>
      )}

      {view === 'active' ? (
        <div className="grid gap-4 md:grid-cols-2">
          {(['new', 'preparing'] as const).map((st) => (
            <div key={st} className="space-y-3">
              <h2 className="text-lg font-bold">{LABEL[st]} ({col(st).length})</h2>
              {col(st).map((o) => <OrderCard key={o.id} o={o} onStatus={setStatus} />)}
              {col(st).length === 0 && <p className="text-sm text-gray-400">Nenhum pedido.</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {orders.map((o) => <OrderCard key={o.id} o={o} onStatus={setStatus} />)}
          {orders.length === 0 && <p className="text-sm text-gray-400">Sem histórico ainda.</p>}
        </div>
      )}
    </div>
  );
}

function OrderCard({ o, onStatus }: { o: Order; onStatus: (id: string, s: string) => void }) {
  return (
    <div className={`card ${o.status === 'new' ? 'border-2 border-amber-400' : ''}`}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xl font-bold">Mesa {o.tabs?.tables?.number}</p>
        <p className="text-sm text-gray-500">{fmtTime(o.created_at)} · {LABEL[o.status]}</p>
      </div>
      <ul className="space-y-1">
        {o.order_items.map((i) => (
          <li key={i.id}>
            <span className="font-semibold">{i.quantity}x</span> {i.name}
            {i.addons?.length > 0 && <span className="text-sm text-gray-500"> (+ {i.addons.map((a) => a.name).join(', ')})</span>}
            {i.note && <p className="text-sm italic text-gray-500">“{i.note}”</p>}
          </li>
        ))}
      </ul>
      {o.note && <p className="mt-2 rounded-lg bg-yellow-50 p-2 text-sm">Obs: {o.note}</p>}
      {(o.status === 'new' || o.status === 'preparing') && (
        <div className="mt-3 flex gap-2">
          {o.status === 'new' && <button className="btn-amber flex-1" onClick={() => onStatus(o.id, 'preparing')}>Iniciar preparo</button>}
          {o.status === 'preparing' && <button className="btn-green flex-1" onClick={() => onStatus(o.id, 'delivered')}>Entregue</button>}
          <button className="btn-light" onClick={() => onStatus(o.id, 'cancelled')}>Cancelar</button>
        </div>
      )}
    </div>
  );
}
