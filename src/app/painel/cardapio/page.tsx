'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePanel } from '@/lib/panel';
import { uploadImage } from '@/lib/upload';
import { brl, parsePrice } from '@/lib/utils';
import type { Category, Product } from '@/lib/types';

type Draft = {
  id?: string; category_id: string; name: string; description: string; price: string;
  photo_url: string | null; available: boolean; addons: { name: string; price: string }[];
};

export default function MenuAdmin() {
  const { est } = usePanel();
  const [cats, setCats] = useState<Category[]>([]);
  const [prods, setProds] = useState<Product[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newCat, setNewCat] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([
      supabase.from('categories').select('*').eq('establishment_id', est.id).order('position'),
      supabase.from('products').select('*, product_addons(*)').eq('establishment_id', est.id).order('position'),
    ]);
    setCats((c.data ?? []) as Category[]); setProds((p.data ?? []) as Product[]);
  }, [est.id]);
  useEffect(() => { load(); }, [load]);

  const fail = (e: { message: string } | null) => { if (e) alert(e.message); return !!e; };

  async function addCat(e: React.FormEvent) {
    e.preventDefault();
    if (!newCat.trim()) return;
    if (fail((await supabase.from('categories').insert({ establishment_id: est.id, name: newCat.trim(), position: cats.length })).error)) return;
    setNewCat(''); load();
  }
  async function renameCat(c: Category) {
    const name = prompt('Novo nome da categoria', c.name);
    if (!name?.trim()) return;
    fail((await supabase.from('categories').update({ name: name.trim() }).eq('id', c.id)).error); load();
  }
  async function delCat(c: Category) {
    if (!confirm(`Excluir "${c.name}" e todos os seus produtos?`)) return;
    fail((await supabase.from('categories').delete().eq('id', c.id)).error); load();
  }
  async function move(i: number, dir: -1 | 1) {
    const a = cats[i], b = cats[i + dir];
    if (!a || !b) return;
    await supabase.from('categories').update({ position: b.position }).eq('id', a.id);
    await supabase.from('categories').update({ position: a.position }).eq('id', b.id);
    load();
  }
  async function toggle(p: Product) {
    await supabase.from('products').update({ available: !p.available }).eq('id', p.id); load();
  }
  async function delProd(p: Product) {
    if (!confirm(`Excluir "${p.name}"?`)) return;
    fail((await supabase.from('products').delete().eq('id', p.id)).error); load();
  }

  function newDraft(category_id: string) {
    setDraft({ category_id, name: '', description: '', price: '', photo_url: null, available: true, addons: [] });
  }
  function editDraft(p: Product) {
    setDraft({
      id: p.id, category_id: p.category_id, name: p.name, description: p.description ?? '',
      price: String(p.price).replace('.', ','), photo_url: p.photo_url, available: p.available,
      addons: (p.product_addons ?? []).map((a) => ({ name: a.name, price: String(a.price).replace('.', ',') })),
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const price = parsePrice(draft.price);
    if (isNaN(price) || price < 0) return alert('Preço inválido.');
    setBusy(true);
    const payload = {
      establishment_id: est.id, category_id: draft.category_id, name: draft.name.trim(),
      description: draft.description.trim() || null, price, photo_url: draft.photo_url, available: draft.available,
    };
    let id = draft.id;
    if (id) {
      if (fail((await supabase.from('products').update(payload).eq('id', id)).error)) return setBusy(false);
    } else {
      const { data, error } = await supabase.from('products')
        .insert({ ...payload, position: prods.filter((p) => p.category_id === draft.category_id).length }).select('id').single();
      if (fail(error)) return setBusy(false);
      id = data!.id;
    }
    await supabase.from('product_addons').delete().eq('product_id', id);
    const rows = draft.addons.filter((a) => a.name.trim())
      .map((a) => ({ establishment_id: est.id, product_id: id, name: a.name.trim(), price: parsePrice(a.price) || 0 }));
    if (rows.length) fail((await supabase.from('product_addons').insert(rows)).error);
    setBusy(false); setDraft(null); load();
  }

  async function photo(file?: File) {
    if (!file || !draft) return;
    try { setDraft({ ...draft, photo_url: await uploadImage(est.id, file) }); }
    catch (e: any) { alert(e.message); }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addCat} className="flex gap-2">
        <input className="input" placeholder="Nova categoria (ex.: Lanches)" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
        <button className="btn-dark">Adicionar</button>
      </form>

      {cats.length === 0 && (
        <div className="card text-muted">
          <p className="font-semibold">Primeiros passos</p>
          <p>1. Crie uma categoria acima. 2. Cadastre produtos. 3. Em “Mesas e QR”, gere os QR Codes. 4. Em “Aparência”, personalize logo e cores.</p>
        </div>
      )}

      {cats.map((c, i) => (
        <section key={c.id} className="card space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="mr-auto text-xl">{c.name}</h3>
            <button className="btn-light px-3 py-2" onClick={() => move(i, -1)}>↑</button>
            <button className="btn-light px-3 py-2" onClick={() => move(i, 1)}>↓</button>
            <button className="btn-light px-3 py-2" onClick={() => renameCat(c)}>Renomear</button>
            <button className="btn-light px-3 py-2 text-red-600" onClick={() => delCat(c)}>Excluir</button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {prods.filter((p) => p.category_id === c.id).map((p) => (
              <div key={p.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                {p.photo_url
                  ? <img src={p.photo_url} alt="" className="aspect-[4/3] w-full object-cover" />
                  : <div className="flex aspect-[4/3] w-full items-center justify-center bg-raised text-sm text-muted">Sem foto</div>}
                <div className="space-y-2 p-3">
                  <p className={`truncate font-bold ${p.available ? '' : 'text-muted line-through'}`}>{p.name}</p>
                  <p className="font-bold text-accent">{brl(p.price)}</p>
                  <div className="flex gap-2">
                    <button className={`${p.available ? 'btn-green' : 'btn-light'} flex-1 px-2 py-2 text-sm`} onClick={() => toggle(p)}>{p.available ? 'Disponível' : 'Esgotado'}</button>
                    <button className="btn-light px-3 py-2 text-sm" onClick={() => editDraft(p)}>Editar</button>
                    <button className="btn-light px-3 py-2 text-sm text-red-600" onClick={() => delProd(p)} aria-label="Excluir">×</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="btn-light w-full" onClick={() => newDraft(c.id)}>+ Produto em {c.name}</button>
        </section>
      ))}

      {draft && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/50 md:items-center md:justify-center">
          <form onSubmit={save} className="max-h-[92vh] w-full space-y-3 overflow-y-auto rounded-t-3xl bg-surface p-5 md:max-w-lg md:rounded-3xl">
            <h3 className="text-lg font-bold">{draft.id ? 'Editar produto' : 'Novo produto'}</h3>
            <div><label className="label">Nome</label><input className="input" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
            <div><label className="label">Descrição (opcional)</label><textarea className="input" rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Preço (R$)</label><input className="input" required inputMode="decimal" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></div>
              <div><label className="label">Categoria</label>
                <select className="input" value={draft.category_id} onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
            </div>
            <div>
              <label className="label">Foto (opcional)</label>
              {draft.photo_url && <img src={draft.photo_url} alt="" className="mb-2 h-28 rounded-xl object-cover" />}
              <input type="file" accept="image/*" onChange={(e) => photo(e.target.files?.[0])} />
              {draft.photo_url && <button type="button" className="ml-3 text-sm text-red-600" onClick={() => setDraft({ ...draft, photo_url: null })}>Remover foto</button>}
            </div>
            <div>
              <label className="label">Adicionais (opcional)</label>
              {draft.addons.map((a, i) => (
                <div key={i} className="mb-2 flex gap-2">
                  <input className="input" placeholder="Nome (ex.: Bacon extra)" value={a.name} onChange={(e) => setDraft({ ...draft, addons: draft.addons.map((x, k) => k === i ? { ...x, name: e.target.value } : x) })} />
                  <input className="input w-28" placeholder="R$" inputMode="decimal" value={a.price} onChange={(e) => setDraft({ ...draft, addons: draft.addons.map((x, k) => k === i ? { ...x, price: e.target.value } : x) })} />
                  <button type="button" className="px-2 text-red-600" onClick={() => setDraft({ ...draft, addons: draft.addons.filter((_, k) => k !== i) })}>×</button>
                </div>
              ))}
              <button type="button" className="text-sm underline" onClick={() => setDraft({ ...draft, addons: [...draft.addons, { name: '', price: '' }] })}>+ adicional</button>
            </div>
            <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={draft.available} onChange={(e) => setDraft({ ...draft, available: e.target.checked })} /> Disponível</label>
            <div className="flex gap-2">
              <button type="button" className="btn-light flex-1" onClick={() => setDraft(null)}>Cancelar</button>
              <button disabled={busy} className="btn-dark flex-1">{busy ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
