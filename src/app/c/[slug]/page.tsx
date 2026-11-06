'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { brl, onColor, fontStack } from '@/lib/utils';
import type { Establishment, Category, Product, Addon } from '@/lib/types';

type CartItem = { key: string; product: Product; qty: number; note: string; addons: Addon[] };
const unit = (i: { product: Product; addons: Addon[] }) =>
  Number(i.product.price) + i.addons.reduce((s, a) => s + Number(a.price), 0);

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
  const [orderNote, setOrderNote] = useState('');
  const [sending, setSending] = useState(false);
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

  const total = useMemo(() => cart.reduce((s, i) => s + unit(i) * i.qty, 0), [cart]);
  const count = cart.reduce((s, i) => s + i.qty, 0);

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
      setCart([]); setOrderNote(''); setCartOpen(false);
      show('Pedido enviado! Já estamos preparando.');
    } catch {
      show('Não foi possível enviar. Seu pedido NÃO foi enviado, tente novamente.', true);
    }
    setSending(false);
  }

  async function call(type: 'waiter' | 'bill') {
    if (!token) return;
    const { error } = await supabase.rpc('call_service', { p_token: token, p_type: type });
    if (error) show('Não foi possível enviar o chamado. Tente novamente.', true);
    else show(type === 'waiter' ? 'Garçom chamado!' : 'Conta solicitada! Pague no caixa informando sua mesa.');
  }

  if (loading) return <p className="p-8 text-center text-gray-500">Carregando…</p>;
  if (notFound || !est) return <p className="p-8 text-center text-gray-500">Estabelecimento não encontrado.</p>;

  const theme = {
    '--primary': est.primary_color, '--secondary': est.secondary_color,
    '--on-primary': onColor(est.primary_color), '--on-secondary': onColor(est.secondary_color),
    fontFamily: fontStack(est.font),
  } as React.CSSProperties;
  const visibleCats = cats.filter((c) => prods.some((p) => p.category_id === c.id));
  const grid = est.card_style === 'grid';

  return (
    <div style={theme} className="min-h-screen bg-white pb-28">
      {est.cover_url && <img src={est.cover_url} alt="" className="h-40 w-full object-cover" />}
      <header className="px-4 pb-3 pt-4" style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}>
        <div className="flex items-center gap-3">
          {est.logo_url && <img src={est.logo_url} alt="" className="h-14 w-14 rounded-full bg-white object-cover" />}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">{est.name}</h1>
            {tableNum && <p className="text-sm opacity-90">Mesa {tableNum}</p>}
          </div>
        </div>
        {est.description && <p className="mt-2 text-sm opacity-90">{est.description}</p>}
        <div className="mt-2 space-y-0.5 text-xs opacity-80">
          {est.opening_hours && <p>🕒 {est.opening_hours}</p>}
          {est.address && <p>📍 {est.address}</p>}
          {est.instagram && <p>Instagram: {est.instagram}</p>}
          {est.whatsapp && <p>WhatsApp: {est.whatsapp}</p>}
        </div>
        {token && (
          <div className="mt-3 flex gap-2">
            <button onClick={() => call('waiter')} className="flex-1 rounded-lg bg-white/20 px-3 py-2 text-sm font-semibold">🙋 Chamar garçom</button>
            <button onClick={() => call('bill')} className="flex-1 rounded-lg bg-white/20 px-3 py-2 text-sm font-semibold">🧾 Pedir a conta</button>
          </div>
        )}
      </header>

      {!token && (
        <p className="bg-gray-100 px-4 py-2 text-center text-sm text-gray-600">
          Para fazer pedidos, escaneie o QR Code da sua mesa.
        </p>
      )}

      {visibleCats.length > 0 && (
        <nav className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b bg-white px-4 py-2">
          {visibleCats.map((c) => (
            <a key={c.id} href={`#cat-${c.id}`} className="whitespace-nowrap rounded-full bg-gray-100 px-4 py-2 text-sm font-medium">{c.name}</a>
          ))}
        </nav>
      )}

      <main className="space-y-6 px-4 py-4">
        {visibleCats.length === 0 && <p className="py-10 text-center text-gray-500">Cardápio em breve.</p>}
        {visibleCats.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-16">
            <h2 className="mb-3 text-lg font-bold">{c.name}</h2>
            <div className={grid ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
              {prods.filter((p) => p.category_id === c.id).map((p) => (
                <button key={p.id} onClick={() => token && setSelected(p)}
                  className={`w-full overflow-hidden rounded-2xl border border-gray-200 text-left ${grid ? 'flex flex-col' : 'flex gap-3 p-3'}`}>
                  {p.photo_url ? (
                    <img src={p.photo_url} alt="" className={grid ? 'h-32 w-full object-cover' : 'h-24 w-24 shrink-0 rounded-xl object-cover'} />
                  ) : (
                    <div className={`flex items-center justify-center bg-gray-100 text-2xl text-gray-300 ${grid ? 'h-32 w-full' : 'h-24 w-24 shrink-0 rounded-xl'}`}>🍽</div>
                  )}
                  <div className={`min-w-0 flex-1 ${grid ? 'p-3' : ''}`}>
                    <p className="font-semibold">{p.name}</p>
                    {p.description && <p className="line-clamp-2 text-sm text-gray-500">{p.description}</p>}
                    <p className="mt-1 font-bold" style={{ color: 'var(--primary)' }}>{brl(p.price)}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </main>

      {token && count > 0 && !cartOpen && (
        <button onClick={() => setCartOpen(true)} className="fixed inset-x-4 bottom-4 z-20 flex items-center justify-between rounded-2xl px-5 py-4 text-base font-bold shadow-lg"
          style={{ background: 'var(--secondary)', color: 'var(--on-secondary)' }}>
          <span>Ver pedido ({count})</span><span>{brl(total)}</span>
        </button>
      )}

      {selected && (
        <ProductSheet product={selected} onClose={() => setSelected(null)}
          onAdd={(item) => { setCart((c) => [...c, item]); setSelected(null); }} />
      )}

      {cartOpen && (
        <Sheet onClose={() => setCartOpen(false)} title="Seu pedido">
          <div className="space-y-3">
            {cart.map((i) => (
              <div key={i.key} className="flex items-start justify-between gap-3 border-b pb-3">
                <div className="min-w-0">
                  <p className="font-medium">{i.qty}x {i.product.name}</p>
                  {i.addons.length > 0 && <p className="text-xs text-gray-500">+ {i.addons.map((a) => a.name).join(', ')}</p>}
                  {i.note && <p className="text-xs italic text-gray-500">“{i.note}”</p>}
                  <button className="mt-1 text-sm text-red-600" onClick={() => setCart((c) => c.filter((x) => x.key !== i.key))}>Remover</button>
                </div>
                <p className="font-semibold">{brl(unit(i) * i.qty)}</p>
              </div>
            ))}
            {cart.length === 0 && <p className="text-gray-500">Seu pedido está vazio.</p>}
            <textarea className="input" rows={2} maxLength={300} placeholder="Observação para o pedido (opcional)"
              value={orderNote} onChange={(e) => setOrderNote(e.target.value)} />
            <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{brl(total)}</span></div>
            <p className="text-xs text-gray-500">O pagamento é feito no caixa, informando o número da mesa.</p>
            <button disabled={sending || !cart.length} onClick={send} className="btn w-full"
              style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}>
              {sending ? 'Enviando…' : 'Enviar pedido'}
            </button>
          </div>
        </Sheet>
      )}

      {toast && (
        <div className={`fixed inset-x-4 top-4 z-50 rounded-xl p-4 text-center text-sm font-semibold text-white shadow-lg ${toast.error ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/50" onClick={onClose}>
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="px-2 text-2xl text-gray-400">×</button>
        </div>
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
    <Sheet title={product.name} onClose={onClose}>
      {product.photo_url && <img src={product.photo_url} alt="" className="mb-3 h-44 w-full rounded-2xl object-cover" />}
      {product.description && <p className="mb-3 text-gray-600">{product.description}</p>}
      {addons.length > 0 && (
        <div className="mb-3">
          <p className="label">Adicionais</p>
          {addons.map((a) => (
            <label key={a.id} className="flex items-center justify-between border-b py-3">
              <span className="flex items-center gap-3">
                <input type="checkbox" className="h-5 w-5" checked={chosen.includes(a.id)}
                  onChange={() => setChosen((c) => c.includes(a.id) ? c.filter((x) => x !== a.id) : [...c, a.id])} />
                {a.name}
              </span>
              <span className="text-gray-600">+ {brl(a.price)}</span>
            </label>
          ))}
        </div>
      )}
      <textarea className="input mb-3" rows={2} maxLength={200} placeholder="Observações (ex.: sem cebola)"
        value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 rounded-xl bg-gray-100 px-2">
          <button className="h-11 w-11 text-2xl" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
          <span className="w-6 text-center font-bold">{qty}</span>
          <button className="h-11 w-11 text-2xl" onClick={() => setQty((q) => Math.min(99, q + 1))}>+</button>
        </div>
        <button className="btn flex-1" style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
          onClick={() => onAdd({ key: crypto.randomUUID(), product, qty, note: note.trim(), addons: picked })}>
          Adicionar · {brl(price)}
        </button>
      </div>
    </Sheet>
  );
}
