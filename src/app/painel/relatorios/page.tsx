'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePanel } from '@/lib/panel';
import { brl, dayLabel, fmtDate, fmtTime } from '@/lib/utils';

type Day = { day: string; total_amount: number; tabs_count: number };
type Top = { item_name: string; qty: number; revenue: number };
type TableRow = { id: string; number: number; active: boolean };
type TodayTab = { table_id: string; status: 'open' | 'closed'; total: number | null; closed_at: string | null };
type OrderLine = { name: string; quantity: number; unit_price: number; addons: { name: string }[] };
type TabRow = {
  id: string; status: 'open' | 'closed'; opened_at: string; closed_at: string | null; total: number | null;
  orders: { status: string; created_at: string; order_items: OrderLine[] }[];
};

const SELECT = 'id,status,opened_at,closed_at,total,orders(status,created_at,order_items(name,quantity,unit_price,addons))';
const PAGE = 20;

const startOfDay = (back = 0) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - back); return d; };
const tabTotal = (t: TabRow) =>
  t.status === 'closed' && t.total != null
    ? Number(t.total)
    : t.orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.order_items.reduce((x, i) => x + Number(i.unit_price) * i.quantity, 0), 0);

export default function ReportsPage() {
  const { est } = usePanel();
  const [period, setPeriod] = useState<7 | 30>(7);
  const [days, setDays] = useState<Day[]>([]);
  const [top, setTop] = useState<Top[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [today, setToday] = useState<TodayTab[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [openTable, setOpenTable] = useState<TableRow | null>(null);

  const t0 = startOfDay().toISOString();

  const load = useCallback(async () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
    const from = startOfDay(period - 1).toISOString();
    const dayStart = startOfDay().toISOString();
    const [d, p, tb, td] = await Promise.all([
      supabase.rpc('report_sales_by_day', { p_days: period, p_tz: tz }),
      supabase.rpc('report_top_products', { p_from: from, p_limit: 8 }),
      supabase.from('tables').select('id,number,active').eq('establishment_id', est.id).order('number'),
      supabase.from('tabs').select('table_id,status,total,closed_at')
        .eq('establishment_id', est.id).or(`opened_at.gte.${dayStart},closed_at.gte.${dayStart}`),
    ]);
    const err = d.error || p.error;
    setError(err ? (err.message.includes('function') ? 'Os relatórios ainda não foram ativados no banco. Execute o arquivo 0003_reports.sql no Supabase.' : err.message) : '');
    setDays(((d.data ?? []) as Day[]).map((x) => ({ ...x, total_amount: Number(x.total_amount), tabs_count: Number(x.tabs_count) })));
    setTop(((p.data ?? []) as Top[]).map((x) => ({ ...x, qty: Number(x.qty), revenue: Number(x.revenue) })));
    setTables((tb.data ?? []) as TableRow[]);
    setToday((td.data ?? []) as TodayTab[]);
    setLoading(false);
  }, [est.id, period]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const total = days.reduce((s, d) => s + d.total_amount, 0);
  const tabs = days.reduce((s, d) => s + d.tabs_count, 0);
  const todayTotal = days.length ? days[days.length - 1].total_amount : 0;
  const maxQty = Math.max(...top.map((t) => t.qty), 1);

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button className={period === 7 ? 'btn-dark' : 'btn-light'} onClick={() => setPeriod(7)}>Últimos 7 dias</button>
        <button className={period === 30 ? 'btn-dark' : 'btn-light'} onClick={() => setPeriod(30)}>Últimos 30 dias</button>
      </div>

      {error && <p className="card font-semibold text-red-600">{error}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Vendas hoje" value={brl(todayTotal)} highlight />
        <Stat label={`Vendas em ${period} dias`} value={brl(total)} />
        <Stat label="Comandas fechadas" value={String(tabs)} />
        <Stat label="Ticket médio" value={tabs ? brl(total / tabs) : '—'} />
      </div>

      <section className="card space-y-4">
        <div>
          <h3 className="text-xl">Vendas por dia</h3>
          <p className="text-sm text-muted">Soma das comandas fechadas no caixa em cada dia.</p>
        </div>
        {loading ? <p className="text-muted">Carregando…</p> : <Chart days={days} />}
      </section>

      <section className="card space-y-4">
        <div>
          <h3 className="text-xl">Produtos mais vendidos</h3>
          <p className="text-sm text-muted">Por quantidade, nos últimos {period} dias. Pedidos cancelados não entram.</p>
        </div>
        {!loading && top.length === 0 && !error && <p className="text-muted">Ainda não há vendas neste período.</p>}
        <ol className="space-y-3">
          {top.map((t, i) => (
            <li key={t.item_name}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate font-bold">{i + 1}. {t.item_name}</p>
                <p className="shrink-0 text-sm text-muted"><span className="font-bold text-bone">{t.qty}</span> un. · {brl(t.revenue)}</p>
              </div>
              <div className="mt-1 h-2 rounded-full bg-raised">
                <div className={`h-2 rounded-full ${i === 0 ? 'bg-accent' : 'bg-side/80'}`} style={{ width: `${(t.qty / maxQty) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-xl">Histórico das mesas</h3>
          <p className="text-sm text-muted">Toque em uma mesa para ver as comandas de hoje e o histórico completo.</p>
        </div>
        {tables.length === 0 && <p className="text-muted">Nenhuma mesa cadastrada.</p>}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {tables.map((t) => {
            const rows = today.filter((x) => x.table_id === t.id);
            const closed = rows.filter((x) => x.status === 'closed');
            const sum = closed.reduce((s, x) => s + Number(x.total ?? 0), 0);
            const isOpen = rows.some((x) => x.status === 'open');
            return (
              <button key={t.id} onClick={() => setOpenTable(t)}
                className={`card text-left transition hover:border-accent ${t.active ? '' : 'opacity-60'}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-display text-3xl font-extrabold leading-none">{String(t.number).padStart(2, '0')}</p>
                  {isOpen && <span className="rounded-full bg-accent px-2 py-1 text-xs font-bold text-white">Aberta</span>}
                </div>
                <p className="mt-3 text-sm text-muted">Mesa {t.number}</p>
                <p className="font-bold">{brl(sum)} <span className="text-sm font-normal text-muted">hoje</span></p>
                <p className="text-sm text-muted">{closed.length} {closed.length === 1 ? 'comanda fechada' : 'comandas fechadas'}</p>
              </button>
            );
          })}
        </div>
      </section>

      {openTable && <TableModal table={openTable} t0={t0} onClose={() => { setOpenTable(null); load(); }} />}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`card ${highlight ? '!border-accent' : ''}`}>
      <p className="text-sm text-muted">{label}</p>
      <p className={`font-display text-2xl font-extrabold md:text-3xl ${highlight ? 'text-accent' : ''}`}>{value}</p>
    </div>
  );
}

function Chart({ days }: { days: Day[] }) {
  const max = Math.max(...days.map((d) => d.total_amount), 1);
  const dense = days.length > 10;
  return (
    <div className="flex h-60 items-stretch gap-1 sm:gap-2" role="img" aria-label="Gráfico de vendas por dia">
      {days.map((d, i) => {
        const h = d.total_amount > 0 ? Math.max((d.total_amount / max) * 100, 3) : 1;
        const isToday = i === days.length - 1;
        return (
          <div key={d.day} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${dayLabel(d.day)}: ${brl(d.total_amount)}`}>
            <span className="h-4 truncate text-[11px] font-bold sm:text-xs">{!dense && d.total_amount > 0 ? brl(d.total_amount).replace('R$ ', '').replace(/\u00a0/g, '') : ''}</span>
            <div className="flex w-full flex-1 items-end">
              <div className={`w-full rounded-t-lg ${isToday ? 'bg-accent' : 'bg-side/80'}`} style={{ height: `${h}%` }} />
            </div>
            <span className={`text-[11px] ${isToday ? 'font-bold text-accent' : 'text-muted'}`}>{dense ? dayLabel(d.day, true) : dayLabel(d.day)}</span>
          </div>
        );
      })}
    </div>
  );
}

function TableModal({ table, t0, onClose }: { table: TableRow; t0: string; onClose: () => void }) {
  const [mode, setMode] = useState<'today' | 'all'>('today');
  const [rows, setRows] = useState<TabRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async (m: 'today' | 'all', offset: number) => {
    setLoading(true); setErr('');
    const base = supabase.from('tabs').select(SELECT).eq('table_id', table.id);
    const res = m === 'today'
      ? await base.or(`opened_at.gte.${t0},closed_at.gte.${t0}`).order('opened_at', { ascending: false })
      : await base.order('opened_at', { ascending: false }).range(offset, offset + PAGE - 1);
    setLoading(false);
    if (res.error) return setErr(res.error.message);
    const list = (res.data ?? []) as unknown as TabRow[];
    setRows((prev) => (offset === 0 ? list : [...prev, ...list]));
    setMore(m === 'all' && list.length === PAGE);
  }, [table.id, t0]);

  useEffect(() => { setRows([]); load(mode, 0); }, [mode, load]);

  const closed = rows.filter((r) => r.status === 'closed');
  const received = closed.reduce((s, r) => s + Number(r.total ?? 0), 0);

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/50 md:items-center md:justify-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-5 md:max-w-lg md:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl">Mesa {table.number}</h3>
            <p className="text-sm text-muted">{mode === 'today' ? 'Comandas de hoje' : 'Histórico total'}</p>
          </div>
          <button onClick={onClose} className="px-2 text-3xl leading-none text-muted" aria-label="Fechar">×</button>
        </div>

        {mode === 'today' && !loading && (
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-raised p-3"><p className="text-sm text-muted">Recebido hoje</p><p className="text-xl font-extrabold">{brl(received)}</p></div>
            <div className="rounded-xl bg-raised p-3"><p className="text-sm text-muted">Comandas</p><p className="text-xl font-extrabold">{rows.length}</p></div>
          </div>
        )}

        <div className="space-y-2">
          {rows.map((r) => <TabCard key={r.id} tab={r} showDate={mode === 'all'} />)}
          {loading && <p className="py-4 text-center text-muted">Carregando…</p>}
          {!loading && rows.length === 0 && !err && (
            <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
              {mode === 'today' ? 'Nenhuma comanda nesta mesa hoje.' : 'Esta mesa ainda não tem histórico.'}
            </p>
          )}
          {err && <p className="text-sm font-semibold text-red-600">{err}</p>}
          {more && !loading && <button className="btn-light w-full" onClick={() => load('all', rows.length)}>Carregar mais</button>}
        </div>

        <button className="btn-dark mt-4 w-full" onClick={() => setMode(mode === 'today' ? 'all' : 'today')}>
          {mode === 'today' ? 'Histórico total' : 'Voltar para hoje'}
        </button>
      </div>
    </div>
  );
}

function TabCard({ tab, showDate }: { tab: TabRow; showDate: boolean }) {
  const [open, setOpen] = useState(false);
  const total = tabTotal(tab);
  const items = tab.orders.flatMap((o) => o.order_items.map((i) => ({ ...i, cancelled: o.status === 'cancelled' })));
  return (
    <div className="rounded-xl border border-line">
      <button className="flex w-full items-center justify-between gap-3 p-3 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="min-w-0">
          <p className="font-bold">
            {showDate && `${fmtDate(tab.opened_at)} · `}{fmtTime(tab.opened_at)}{tab.closed_at ? ` – ${fmtTime(tab.closed_at)}` : ''}
          </p>
          <p className="text-sm text-muted">{tab.status === 'open' ? 'Em aberto (ainda não paga)' : 'Fechada no caixa'}</p>
        </div>
        <p className={`shrink-0 text-lg font-extrabold ${tab.status === 'open' ? 'text-accent' : ''}`}>{brl(total)}</p>
      </button>
      {open && (
        <ul className="space-y-1 border-t border-line p-3 text-sm">
          {items.length === 0 && <li className="text-muted">Sem itens.</li>}
          {items.map((i, k) => (
            <li key={k} className={`flex justify-between gap-3 ${i.cancelled ? 'text-muted line-through' : ''}`}>
              <span>{i.quantity}x {i.name}{i.addons?.length > 0 && ` (+ ${i.addons.map((a) => a.name).join(', ')})`}{i.cancelled && ' · cancelado'}</span>
              <span>{brl(Number(i.unit_price) * i.quantity)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
