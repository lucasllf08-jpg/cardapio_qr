'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePanel } from '@/lib/panel';
import { uploadImage } from '@/lib/upload';
import { FONTS } from '@/lib/utils';
import type { Establishment } from '@/lib/types';

export default function AppearancePage() {
  const { est, setEst } = usePanel();
  const [f, setF] = useState<Establishment>(est);
  const [busy, setBusy] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const set = <K extends keyof Establishment>(k: K, v: Establishment[K]) => setF({ ...f, [k]: v });
  const text = (k: 'description' | 'opening_hours' | 'address' | 'instagram' | 'whatsapp', label: string) => (
    <div><label className="label">{label} (opcional)</label>
      <input className="input" value={f[k] ?? ''} onChange={(e) => set(k, e.target.value)} /></div>
  );

  async function img(k: 'logo_url' | 'cover_url', file?: File) {
    if (!file) return;
    try { set(k, await uploadImage(est.id, file)); } catch (e: any) { alert(e.message); }
  }

  async function save() {
    setBusy(true);
    const clean = (v: string | null) => (v && v.trim() ? v.trim() : null);
    const patch = {
      name: f.name.trim() || est.name, logo_url: f.logo_url, cover_url: f.cover_url,
      primary_color: f.primary_color, secondary_color: f.secondary_color, font: f.font, card_style: f.card_style,
      description: clean(f.description), opening_hours: clean(f.opening_hours), address: clean(f.address),
      instagram: clean(f.instagram), whatsapp: clean(f.whatsapp),
    };
    const { data, error } = await supabase.from('establishments').update(patch).eq('id', est.id).select('*').single();
    setBusy(false);
    if (error) return alert(error.message);
    setEst(data as Establishment); setPreviewKey((k) => k + 1);
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-3">
        <div><label className="label">Nome</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div>
          <label className="label">Logo</label>
          {f.logo_url && <img src={f.logo_url} alt="" className="mb-2 h-16 w-16 rounded-full object-cover" />}
          <input type="file" accept="image/*" onChange={(e) => img('logo_url', e.target.files?.[0])} />
          {f.logo_url && <button className="ml-3 text-sm text-red-600" onClick={() => set('logo_url', null)}>Remover</button>}
        </div>
        <div>
          <label className="label">Capa</label>
          {f.cover_url && <img src={f.cover_url} alt="" className="mb-2 h-20 w-full rounded-xl object-cover" />}
          <input type="file" accept="image/*" onChange={(e) => img('cover_url', e.target.files?.[0])} />
          {f.cover_url && <button className="ml-3 text-sm text-red-600" onClick={() => set('cover_url', null)}>Remover</button>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Cor principal</label><input type="color" className="h-12 w-full rounded-xl" value={f.primary_color} onChange={(e) => set('primary_color', e.target.value)} /></div>
          <div><label className="label">Cor de destaque</label><input type="color" className="h-12 w-full rounded-xl" value={f.secondary_color} onChange={(e) => set('secondary_color', e.target.value)} /></div>
        </div>
        <div><label className="label">Fonte</label>
          <select className="input" value={f.font} onChange={(e) => set('font', e.target.value as Establishment['font'])}>
            {Object.entries(FONTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <div><label className="label">Estilo dos produtos</label>
          <div className="flex gap-2">
            <button type="button" className={f.card_style === 'list' ? 'btn-dark flex-1' : 'btn-light flex-1'} onClick={() => set('card_style', 'list')}>Lista</button>
            <button type="button" className={f.card_style === 'grid' ? 'btn-dark flex-1' : 'btn-light flex-1'} onClick={() => set('card_style', 'grid')}>Grade</button>
          </div></div>
        {text('description', 'Descrição')}
        {text('opening_hours', 'Horário de funcionamento')}
        {text('address', 'Endereço')}
        {text('instagram', 'Instagram')}
        {text('whatsapp', 'WhatsApp')}
        <button className="btn-dark w-full" disabled={busy} onClick={save}>{busy ? 'Salvando…' : 'Salvar alterações'}</button>
      </div>
      <div>
        <p className="label">Pré-visualização (celular)</p>
        <iframe key={previewKey} src={`/c/${est.slug}`} className="h-[640px] w-full max-w-[380px] rounded-3xl border-4 border-gray-900 bg-white" />
      </div>
    </div>
  );
}
