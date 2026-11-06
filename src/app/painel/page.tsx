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
  const [orders, setOrders] = useState<Order[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [live, setLive] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

  const load = useCallback(async () => {
    const [o, c] = await Promise.all([
      supabase.from('orders')
        .select('id,status,note,created_at,tabs(tables(number)),order_items(id,name,quantity,note,addons)')
        .eq('establishment_id', est.id).in('status', ['new', 'preparing']).order('created_at', { ascending: true }),
      supabase.from('service_calls').select('id,type,created_at,tables(number)')
        .eq('establishment_id', est.id).eq('status', 'pending').order('created_at'),
    ]);
    setOrders((o.data ?? []) as unknown as Order[]);
    setCalls((c.data ?? []) as unknown as Call[]);
  }, [est.id]);

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
    if (status === 'cancelled' && role === 'waiter') return alert('Apenas caixa ou dono podem cancelar.');
    if (status === 'cancelled' && !confirm('Cancelar este pedido?')) return;
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`flex items-center gap-2 text-sm font-semibold ${live ? 'text-emerald-600' : 'text-red-600'}`}>
          <span className="h-2 w-2 rounded-full bg-current" />{live ? 'Ao vivo' : 'Reconectando…'}
        </span>
        {!soundOn && <button className="btn-amber ml-auto" onClick={() => { enableSound(); setSoundOn(true); }}>Ativar som dos alertas</button>}
      </div>

      {calls.length > 0 && (
        <div className="space-y-2">
          {calls.map((c) => (
            <div key={c.id} className={`flex items-center justify-between gap-3 rounded-2xl p-4 ${c.type === 'bill' ? 'border-2 border-accent bg-surface' : 'bg-accent text-white'}`}>
              <p className="text-lg font-semibold">
                Mesa {c.tables.number} {c.type === 'bill' ? 'pediu a conta' : 'está chamando'}
                <span className="ml-2 text-sm font-normal opacity-70">{fmtTime(c.created_at)}</span>
              </p>
              <button className={c.type === 'bill' ? 'btn-dark' : 'btn-light'} onClick={() => doneCall(c.id)}>Atendido</button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {(['new', 'preparing'] as const).map((st) => (
          <section key={st} className="space-y-3">
            <h3 className="text-xl">{LABEL[st]} <span className="text-muted">({col(st).length})</span></h3>
            {col(st).map((o) => <OrderCard key={o.id} o={o} now={now} onStatus={setStatus} />)}
            {col(st).length === 0 && (
              <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
                {st === 'new' ? 'Nenhum pedido novo. Os próximos aparecem aqui com um aviso sonoro.' : 'Nada em preparo agora.'}
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function OrderCard({ o, now, onStatus }: { o: Order; now: number; onStatus: (id: string, s: string) => void }) {
  const mins = Math.max(0, Math.floor((now - Date.parse(o.created_at)) / 60000));
  const late = o.status === 'new' && mins >= 10;
  const num = String(o.tabs?.tables?.number ?? '?').padStart(2, '0');
  return (
    <article className={`card p-0 ${o.status === 'new' ? '!border-accent' : ''}`}>
      <header className="flex items-end justify-between gap-3 p-4 pb-3">
        <div>
          <p className="text-sm text-muted">Mesa</p>
          <p className="font-display text-5xl font-extrabold leading-none">{num}</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold">{LABEL[o.status]}</p>
          <p className={late ? 'font-semibold text-red-600' : 'text-muted'}>
            {fmtTime(o.created_at)} · {mins < 1 ? 'agora' : `há ${mins} min`}
          </p>
        </div>
      </header>
      <div className="mx-4 border-t border-dashed" />
      <ul className="space-y-2 p-4">
        {o.order_items.map((i) => (
          <li key={i.id} className="text-lg leading-snug">
            <span className="mr-2 font-bold text-accent">{i.quantity}x</span>{i.name}
            {i.addons?.length > 0 && <span className="block pl-8 text-sm text-muted">+ {i.addons.map((a) => a.name).join(', ')}</span>}
            {i.note && <span className="block pl-8 text-sm italic text-muted">“{i.note}”</span>}
          </li>
        ))}
      </ul>
      {o.note && <p className="mx-4 mb-4 rounded-lg bg-amber-50 p-3 text-sm">Observação: {o.note}</p>}
      <footer className="flex gap-2 p-4 pt-0">
        {o.status === 'new' && <button className="btn-amber flex-1" onClick={() => onStatus(o.id, 'preparing')}>Iniciar preparo</button>}
        {o.status === 'preparing' && <button className="btn-green flex-1" onClick={() => onStatus(o.id, 'delivered')}>Marcar como entregue</button>}
        <button className="btn-light" onClick={() => onStatus(o.id, 'cancelled')}>Cancelar</button>
      </footer>
    </article>
  );
}
