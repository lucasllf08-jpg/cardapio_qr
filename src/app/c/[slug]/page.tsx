'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { brl, onColor, fontStack } from '@/lib/utils';
import type { Establishment, Category, Product, Addon } from '@/lib/types';

type CartItem = { key: string; product: Product; qty: number; note: string; addons: Addon[] };
const unit = (i: { product: Product; addons: Addon[] }) =>
  Number(i.product.price) + i.addons.reduce((s, a) => s + Number(a.price), 0);

const PATH: Record<string, string> = {
  clock: 'M12 7v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  bell: 'M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7 M10 20a2 2 0 0 0 4 0',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12l5 5 9-10',
  bag: 'M6 8h12l1 12H5z M9 8a3 3 0 0 1 6 0',
  qr: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h3v3h-3z M19 19h1',
};
function Ic({ n, size = 20, sw = 2 }: { n: string; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATH[n]} />
    </svg>
  );
}

const accentBtn: React.CSSProperties = { background: 'var(--secondary)', color: 'var(--on-secondary)' };
const mainBtn: React.CSSProperties = { background: 'var(--primary)', color: 'var(--on-primary)' };

export default function MenuPage() {
  const { slug } = useParams<{ slug: string }>();
  const [est, setEst] = useState<Establishment | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [tableNum, setTableNum] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [orderNote, setOrderNote] = useState('');
  const [sending, setSending] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);

  const show = (text: string, error = false) => {
    setToast({ text, error });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    (async () => {
      const { data: e } = await supabase.from('establishments').select('*').eq('slug', slug).maybeSingle();
      if (!e) { setNotFound(true); setLoading(false); return; }
      setEst(e as Establishment);
      const [c, p] = await Promise.all([
        supabase.from('categories').select('*').eq('establishment_id', e.id).order('position'),
        supabase.from('products').select('*, product_addons(*)').eq('establishment_id', e.id).order('position'),
      ]);
      setCats((c.data ?? []) as Category[]);
      setProds((p.data ?? []) as Product[]);
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    const key = `token:${slug}`;
    const t = new URLSearchParams(window.location.search).get('t') || sessionStorage.getItem(key);
    if (!t) return;
    supabase.rpc('get_table_by_token', { p_token: t }).then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (row && row.slug === slug) {
        sessionStorage.setItem(key, t);
        setToken(t); setTableNum(row.number);
      } else sessionStorage.removeItem(key);
    });
  }, [slug]);

  const visibleCats = useMemo(() => cats.filter((c) => prods.some((p) => p.category_id === c.id)), [cats, prods]);

  // destaca no menu de categorias a seção que está na tela
  useEffect(() => {
    if (!visibleCats.length) return;
    setActive((a) => a ?? visibleCats[0].id);
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id.replace('cat-', '')); }),
      { rootMargin: '-25% 0px -65% 0px' },
    );
    visibleCats.forEach((c) => { const el = document.getElementById('cat-' + c.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [visibleCats]);

  const total = useMemo(() => cart.reduce((s, i) => s + unit(i) * i.qty, 0), [cart]);
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const setQty = (key: string, q: number) =>
    setCart((c) => (q <= 0 ? c.filter((x) => x.key !== key) : c.map((x) => (x.key === key ? { ...x, qty: Math.min(q, 99) } : x))));

  async function send() {
    if (!token || !cart.length) return;
    setSending(true);
    const items = cart.map((i) => ({
      product_id: i.product.id, quantity: i.qty, note: i.note || null, addon_ids: i.addons.map((a) => a.id),
    }));
    try {
      if (!navigator.onLine) throw new Error('offline');
      const { error } = await supabase.rpc('place_order', { p_token: token, p_items: items, p_note: orderNote || null });
      if (error) throw error;
      setCart([]); setOrderNote(''); setCartOpen(false); setSent(true);
    } catch {
      show('Não foi possível enviar. Seu pedido NÃO foi enviado, tente novamente.', true);
    }
    setSending(false);
  }

  async function call(type: 'waiter' | 'bill') {
    if (!token) return;
    const { error } = await supabase.rpc('call_service', { p_token: token, p_type: type });
    if (error) show('Não foi possível enviar o chamado. Tente novamente.', true);
    else show(type === 'waiter' ? 'Garçom chamado! Já vamos até você.' : 'Conta solicitada! Pague no caixa informando sua mesa.');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f5f7]">
        <div className="h-40 animate-pulse bg-gray-200" />
        <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-200" />)}</div>
      </div>
    );
  }
  if (notFound || !est) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f4f5f7] p-8 text-center text-gray-600">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#101010] text-white"><Ic n="qr" size={28} /></span>
        <p className="font-bold">Cardápio não encontrado</p>
        <p className="text-sm">Confira o QR Code ou o endereço e tente de novo.</p>
      </div>
    );
  }

  const theme = {
    '--primary': est.primary_color, '--secondary': est.secondary_color,
    '--on-primary': onColor(est.primary_color), '--on-secondary': onColor(est.secondary_color),
    fontFamily: fontStack(est.font),
  } as React.CSSProperties;
  const grid = est.card_style === 'grid';
  const canOrder = !!token;
  const chips = [
    est.opening_hours && { icon: 'clock', text: est.opening_hours },
    est.address && { icon: 'pin', text: est.address },
    est.instagram && { icon: '', text: `Instagram ${est.instagram}` },
    est.whatsapp && { icon: '', text: `WhatsApp ${est.whatsapp}` },
  ].filter(Boolean) as { icon: string; text: string }[];

  return (
    <div style={theme} className="min-h-screen bg-[#f4f5f7] pb-32 text-[#16181d]">
      <header>
        <div className="relative h-44 w-full overflow-hidden" style={{ background: 'var(--primary)' }}>
          {est.cover_url && <img src={est.cover_url} alt="" className="h-full w-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          {tableNum && (
            <span className="absolute right-4 top-4 rounded-full px-4 py-2 text-sm font-extrabold shadow" style={accentBtn}>
              Mesa {String(tableNum).padStart(2, '0')}
            </span>
          )}
        </div>
        <div className="relative -mt-10 px-4">
          <div className="flex items-end gap-3">
            {est.logo_url
              ? <img src={est.logo_url} alt="" className="h-20 w-20 shrink-0 rounded-2xl border-4 border-[#f4f5f7] bg-white object-cover shadow" />
              : <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-[#f4f5f7] text-3xl font-extrabold shadow" style={mainBtn}>{est.name.slice(0, 1).toUpperCase()}</span>}
            <h1 className="pb-1 text-2xl font-extrabold leading-tight">{est.name}</h1>
          </div>
          {est.description && <p className="mt-3 text-gray-600">{est.description}</p>}
          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((c) => (
                <span key={c.text} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700">
                  {c.icon && <Ic n={c.icon} size={15} />}{c.text}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      {canOrder ? (
        <div className="mt-4 grid grid-cols-2 gap-3 px-4">
          {([['waiter', 'bell', 'Chamar garçom'], ['bill', 'receipt', 'Pedir a conta']] as const).map(([type, icon, label]) => (
            <button key={type} onClick={() => call(type)} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left font-bold shadow-sm active:scale-[0.98]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={mainBtn}><Ic n={icon} size={20} /></span>
              <span className="text-sm leading-tight">{label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mx-4 mt-4 flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={mainBtn}><Ic n="qr" size={18} /></span>
          <p className="pt-1">Este cardápio é só para consulta. Para fazer pedidos, escaneie o QR Code da sua mesa.</p>
        </div>
      )}

      {visibleCats.length > 0 && (
        <nav className="sticky top-0 z-20 mt-2 flex gap-2 overflow-x-auto bg-[#f4f5f7]/95 px-4 py-3 backdrop-blur" aria-label="Categorias">
          {visibleCats.map((c) => (
            <button key={c.id} aria-current={active === c.id}
              onClick={() => { setActive(c.id); document.getElementById('cat-' + c.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              className={`min-h-10 whitespace-nowrap rounded-full border px-4 text-sm font-bold ${active === c.id ? 'border-transparent' : 'border-gray-200 bg-white text-gray-700'}`}
              style={active === c.id ? mainBtn : undefined}>
              {c.name}
            </button>
          ))}
        </nav>
      )}

      <main className="space-y-7 px-4 pt-2">
        {visibleCats.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
            <p className="font-bold">Cardápio em breve</p>
            <p className="text-sm">Os produtos aparecem aqui assim que forem cadastrados.</p>
          </div>
        )}
        {visibleCats.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-20">
            <h2 className="mb-3 text-xl font-extrabold">{c.name}</h2>
            <div className={grid ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
              {prods.filter((p) => p.category_id === c.id).map((p) => (
                <ProductCard key={p.id} p={p} grid={grid} canOrder={canOrder} onOpen={() => setSelected(p)} />
              ))}
            </div>
          </section>
        ))}
      </main>

      {canOrder && count > 0 && !cartOpen && (
        <button onClick={() => setCartOpen(true)} style={{ ...accentBtn, bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          className="fixed inset-x-4 z-30 flex items-center justify-between rounded-2xl px-5 py-4 text-base font-extrabold shadow-xl active:scale-[0.99]">
          <span className="flex items-center gap-3">
            <span className="relative"><Ic n="bag" size={24} />
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] text-[#16181d]">{count}</span>
            </span>
            Ver pedido
          </span>
          <span>{brl(total)}</span>
        </button>
      )}

      {selected && (
        <ProductSheet product={selected} onClose={() => setSelected(null)}
          onAdd={(item) => { setCart((c) => [...c, item]); setSelected(null); show('Adicionado ao pedido'); }} />
      )}

      {cartOpen && (
        <Sheet onClose={() => setCartOpen(false)} title="Seu pedido">
          <div className="space-y-3">
            {cart.map((i) => (
              <div key={i.key} className="flex items-start gap-3 border-b border-gray-100 pb-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{i.product.name}</p>
                  {i.addons.length > 0 && <p className="text-sm text-gray-500">+ {i.addons.map((a) => a.name).join(', ')}</p>}
                  {i.note && <p className="text-sm italic text-gray-500">“{i.note}”</p>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className="font-bold">{brl(unit(i) * i.qty)}</p>
                  <Stepper value={i.qty} min={0} onChange={(q) => setQty(i.key, q)} />
                </div>
              </div>
            ))}
            {cart.length === 0 && <p className="py-6 text-center text-gray-500">Seu pedido está vazio.</p>}
            <textarea className="w-full rounded-xl border border-gray-300 bg-white p-3" rows={2} maxLength={300}
              placeholder="Observação para o pedido (opcional)" value={orderNote} onChange={(e) => setOrderNote(e.target.value)} />
            <div className="flex items-center justify-between text-lg font-extrabold"><span>Total</span><span>{brl(total)}</span></div>
            <p className="text-sm text-gray-500">O pagamento é feito no caixa, informando o número da mesa.</p>
            <button disabled={sending || !cart.length} onClick={send} style={mainBtn}
              className="w-full rounded-2xl px-4 py-4 text-base font-extrabold disabled:opacity-50">
              {sending ? 'Enviando…' : `Enviar pedido · ${brl(total)}`}
            </button>
          </div>
        </Sheet>
      )}

      {sent && (
        <Sheet onClose={() => setSent(false)} title="">
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><Ic n="check" size={34} sw={3} /></span>
            <h3 className="text-2xl font-extrabold">Pedido enviado!</h3>
            <p className="text-gray-600">
              {tableNum ? `Mesa ${String(tableNum).padStart(2, '0')}. ` : ''}Já avisamos o estabelecimento. Você pode pedir mais itens quando quiser, e o pagamento é feito no caixa.
            </p>
            <button onClick={() => setSent(false)} style={mainBtn} className="mt-2 w-full rounded-2xl px-4 py-4 text-base font-extrabold">Continuar no cardápio</button>
          </div>
        </Sheet>
      )}

      {toast && (
        <div role="status" className={`fixed inset-x-4 top-4 z-50 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-xl ${toast.error ? 'bg-red-600' : 'bg-[#101010]'}`}>
          <Ic n={toast.error ? 'bell' : 'check'} size={18} sw={2.5} />{toast.text}
        </div>
      )}
    </div>
  );
}

function ProductCard({ p, grid, canOrder, onOpen }: { p: Product; grid: boolean; canOrder: boolean; onOpen: () => void }) {
  const photo = p.photo_url
    ? <img src={p.photo_url} alt="" className={grid ? 'aspect-[4/3] w-full object-cover' : 'h-24 w-24 shrink-0 rounded-xl object-cover'} />
    : <div className={`flex items-center justify-center bg-gray-100 text-gray-300 ${grid ? 'aspect-[4/3] w-full' : 'h-24 w-24 shrink-0 rounded-xl'}`}><Ic n="bag" size={28} /></div>;
  const plus = canOrder && (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={accentBtn}><Ic n="plus" size={22} sw={2.5} /></span>
  );
  return (
    <button type="button" disabled={!canOrder} onClick={onOpen}
      className={`w-full overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-sm enabled:active:scale-[0.99] disabled:cursor-default ${grid ? 'flex flex-col' : 'flex gap-3 p-3'}`}>
      {photo}
      <div className={`flex min-w-0 flex-1 flex-col ${grid ? 'p-3' : ''}`}>
        <p className="font-bold leading-snug">{p.name}</p>
        {p.description && <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">{p.description}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <p className="text-lg font-extrabold">{brl(p.price)}</p>
          {plus}
        </div>
      </div>
    </button>
  );
}

function Stepper({ value, min, onChange }: { value: number; min: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center rounded-full bg-gray-100">
      <button type="button" aria-label="Diminuir" className="flex h-10 w-10 items-center justify-center rounded-full" onClick={() => onChange(Math.max(min, value - 1))}><Ic n="minus" size={18} sw={2.5} /></button>
      <span className="w-7 text-center font-extrabold">{value}</span>
      <button type="button" aria-label="Aumentar" className="flex h-10 w-10 items-center justify-center rounded-full" onClick={() => onChange(Math.min(99, value + 1))}><Ic n="plus" size={18} sw={2.5} /></button>
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/50" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-300" />
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-extrabold">{title}</h3>
            <button onClick={onClose} aria-label="Fechar" className="px-2 text-3xl leading-none text-gray-400">×</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function ProductSheet({ product, onClose, onAdd }: { product: Product; onClose: () => void; onAdd: (i: CartItem) => void }) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const addons = (product.product_addons ?? []).filter((a) => a.available);
  const picked = addons.filter((a) => chosen.includes(a.id));
  const price = (Number(product.price) + picked.reduce((s, a) => s + Number(a.price), 0)) * qty;

  return (
    <Sheet title="" onClose={onClose}>
      {product.photo_url && <img src={product.photo_url} alt="" className="mb-4 aspect-[16/10] w-full rounded-2xl object-cover" />}
      <div className="mb-4">
        <h3 className="text-2xl font-extrabold leading-tight">{product.name}</h3>
        {product.description && <p className="mt-1 text-gray-600">{product.description}</p>}
        <p className="mt-2 text-xl font-extrabold">{brl(product.price)}</p>
      </div>
      {addons.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 font-bold">Adicionais</p>
          <div className="space-y-2">
            {addons.map((a) => {
              const on = chosen.includes(a.id);
              return (
                <button key={a.id} type="button" role="checkbox" aria-checked={on}
                  onClick={() => setChosen((c) => (c.includes(a.id) ? c.filter((x) => x !== a.id) : [...c, a.id]))}
                  className={`flex w-full items-center justify-between rounded-xl border-2 px-3 py-3 text-left ${on ? 'border-[var(--secondary)] bg-gray-50' : 'border-gray-200'}`}>
                  <span className="flex items-center gap-3">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-md border-2 ${on ? 'border-transparent' : 'border-gray-300'}`} style={on ? accentBtn : undefined}>
                      {on && <Ic n="check" size={14} sw={3.5} />}
                    </span>
                    {a.name}
                  </span>
                  <span className="text-gray-600">+ {brl(a.price)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <textarea className="mb-4 w-full rounded-xl border border-gray-300 bg-white p-3" rows={2} maxLength={200}
        placeholder="Observações (ex.: sem cebola)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex items-center gap-3">
        <Stepper value={qty} min={1} onChange={setQty} />
        <button style={mainBtn} className="flex-1 rounded-2xl px-4 py-4 text-base font-extrabold"
          onClick={() => onAdd({ key: crypto.randomUUID(), product, qty, note: note.trim(), addons: picked })}>
          Adicionar · {brl(price)}
        </button>
      </div>
    </Sheet>
  );
}
