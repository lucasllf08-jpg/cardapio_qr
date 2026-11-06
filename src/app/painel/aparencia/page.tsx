'use client';
import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { usePanel } from '@/lib/panel';
import { uploadImage } from '@/lib/upload';
import { FONTS } from '@/lib/utils';
import type { Establishment } from '@/lib/types';

export default function AppearancePage() {
  const { est, setEst } = usePanel();
  const [f, setF] = useState({
    cover_url: est.cover_url, primary_color: est.primary_color, secondary_color: est.secondary_color,
    font: est.font, card_style: est.card_style,
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  async function cover(file?: File) {
    if (!file) return;
    try { setF({ ...f, cover_url: await uploadImage(est.id, file) }); } catch (e: any) { alert(e.message); }
  }

  async function save() {
    setBusy(true); setSaved(false);
    const { data, error } = await supabase.from('establishments').update(f).eq('id', est.id).select('*').single();
    setBusy(false);
    if (error) return alert(error.message);
    setEst(data as Establishment); setPreviewKey((k) => k + 1); setSaved(true);
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="card space-y-4">
        <p className="text-sm text-muted">Nome, logo e descrição do restaurante ficam em <Link href="/painel/perfil" className="font-bold text-accent underline">Meu perfil</Link>.</p>
        <div>
          <label className="label">Capa (opcional)</label>
          {f.cover_url && <img src={f.cover_url} alt="" className="mb-2 h-24 w-full rounded-xl object-cover" />}
          <input type="file" accept="image/*" onChange={(e) => cover(e.target.files?.[0])} />
          {f.cover_url && <button className="ml-3 text-sm text-red-600" onClick={() => setF({ ...f, cover_url: null })}>Remover</button>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Cor principal</label><input type="color" className="h-12 w-full rounded-xl" value={f.primary_color} onChange={(e) => setF({ ...f, primary_color: e.target.value })} /></div>
          <div><label className="label">Cor de destaque</label><input type="color" className="h-12 w-full rounded-xl" value={f.secondary_color} onChange={(e) => setF({ ...f, secondary_color: e.target.value })} /></div>
        </div>
        <div><label className="label">Fonte</label>
          <select className="input" value={f.font} onChange={(e) => setF({ ...f, font: e.target.value as Establishment['font'] })}>
            {Object.entries(FONTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <div><label className="label">Estilo dos produtos</label>
          <div className="flex gap-2">
            <button type="button" className={f.card_style === 'list' ? 'btn-dark flex-1' : 'btn-light flex-1'} onClick={() => setF({ ...f, card_style: 'list' })}>Lista</button>
            <button type="button" className={f.card_style === 'grid' ? 'btn-dark flex-1' : 'btn-light flex-1'} onClick={() => setF({ ...f, card_style: 'grid' })}>Grade</button>
          </div></div>
        <button className="btn-dark w-full" disabled={busy} onClick={save}>{busy ? 'Salvando…' : 'Salvar aparência'}</button>
        {saved && <p className="text-sm font-semibold text-emerald-600">Aparência salva.</p>}
      </div>
      <div>
        <p className="label">Pré-visualização (celular)</p>
        <iframe key={previewKey} src={`/c/${est.slug}`} className="h-[640px] w-full max-w-[380px] rounded-3xl border-4 border-side bg-white" />
      </div>
    </div>
  );
}
