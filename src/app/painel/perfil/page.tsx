'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePanel } from '@/lib/panel';
import { uploadImage } from '@/lib/upload';
import { Avatar } from '@/lib/avatar';
import type { Establishment } from '@/lib/types';

const ROLE = { owner: 'Proprietário', waiter: 'Garçom', cashier: 'Caixa' } as const;
type Msg = { t: string; ok: boolean };

export default function ProfilePage() {
  const { est, setEst, role, email, profile, setProfile } = usePanel();

  // conta
  const [name, setName] = useState(profile.name ?? '');
  const [avatar, setAvatar] = useState<string | null>(profile.avatar_url);
  // restaurante
  const [f, setF] = useState<Establishment>(est);
  // senha
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');

  const [busy, setBusy] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Record<string, Msg>>({});
  const flash = (k: string, t: string, ok = true) => setMsgs((m) => ({ ...m, [k]: { t, ok } }));
  const Note = ({ k }: { k: string }) =>
    msgs[k] ? <p className={`text-sm font-semibold ${msgs[k].ok ? 'text-emerald-600' : 'text-red-600'}`}>{msgs[k].t}</p> : null;

  async function pickAvatar(file?: File) {
    if (!file) return;
    setBusy('avatar');
    try { setAvatar(await uploadImage(est.id, file)); flash('account', 'Foto carregada. Clique em Salvar perfil para confirmar.'); }
    catch (e: any) { flash('account', e.message, false); }
    setBusy(null);
  }
  async function pickLogo(file?: File) {
    if (!file) return;
    setBusy('logo');
    try { setF({ ...f, logo_url: await uploadImage(est.id, file) }); flash('rest', 'Logo carregado. Clique em Salvar restaurante para confirmar.'); }
    catch (e: any) { flash('rest', e.message, false); }
    setBusy(null);
  }

  async function saveAccount() {
    setBusy('account');
    const { error } = await supabase.rpc('update_my_profile', { p_name: name, p_avatar_url: avatar });
    setBusy(null);
    if (error) return flash('account', error.message, false);
    setProfile({ name: name.trim() || null, avatar_url: avatar });
    flash('account', 'Perfil salvo.');
  }

  async function saveRestaurant() {
    if (!f.name.trim()) return flash('rest', 'Informe o nome do restaurante.', false);
    setBusy('rest');
    const clean = (v: string | null) => (v && v.trim() ? v.trim() : null);
    const { data, error } = await supabase.from('establishments').update({
      name: f.name.trim(), logo_url: f.logo_url, description: clean(f.description),
      opening_hours: clean(f.opening_hours), address: clean(f.address),
      instagram: clean(f.instagram), whatsapp: clean(f.whatsapp),
    }).eq('id', est.id).select('*').single();
    setBusy(null);
    if (error) return flash('rest', error.message, false);
    setEst(data as Establishment);
    flash('rest', 'Dados do restaurante salvos. O cardápio já mostra as mudanças.');
  }

  async function savePassword() {
    if (pw.length < 6) return flash('pw', 'A senha precisa ter ao menos 6 caracteres.', false);
    if (pw !== pw2) return flash('pw', 'As senhas não são iguais.', false);
    setBusy('pw');
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(null);
    if (error) return flash('pw', error.message, false);
    setPw(''); setPw2('');
    flash('pw', 'Senha alterada.');
  }

  const field = (k: 'description' | 'opening_hours' | 'address' | 'instagram' | 'whatsapp', label: string, ph = '') => (
    <div>
      <label className="label">{label}</label>
      {k === 'description'
        ? <textarea className="input" rows={3} maxLength={300} placeholder={ph} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        : <input className="input" placeholder={ph} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card space-y-4">
        <h3 className="text-xl">Minha conta</h3>
        <div className="flex items-center gap-4">
          <Avatar url={avatar} name={name || email} size={80} />
          <div className="space-y-2">
            <label className="btn-light inline-flex cursor-pointer px-4 py-2 text-sm">
              {busy === 'avatar' ? 'Enviando…' : 'Trocar foto'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => pickAvatar(e.target.files?.[0])} />
            </label>
            {avatar && <button className="block text-sm text-red-600" onClick={() => setAvatar(null)}>Remover foto</button>}
          </div>
        </div>
        <div><label className="label">Seu nome</label>
          <input className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label">E-mail de acesso</label>
          <input className="input opacity-60" disabled value={email} /></div>
        <p className="text-sm text-muted">Função: {ROLE[role]}</p>
        <button className="btn-dark w-full" disabled={busy === 'account'} onClick={saveAccount}>{busy === 'account' ? 'Salvando…' : 'Salvar perfil'}</button>
        <Note k="account" />
      </section>

      {role === 'owner' && (
        <section className="card space-y-4">
          <h3 className="text-xl">Restaurante</h3>
          <div className="flex items-center gap-4">
            {f.logo_url
              ? <img src={f.logo_url} alt="" className="h-20 w-20 rounded-2xl object-cover" />
              : <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-raised text-xs text-muted">Sem logo</div>}
            <div className="space-y-2">
              <label className="btn-light inline-flex cursor-pointer px-4 py-2 text-sm">
                {busy === 'logo' ? 'Enviando…' : 'Trocar logo'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => pickLogo(e.target.files?.[0])} />
              </label>
              {f.logo_url && <button className="block text-sm text-red-600" onClick={() => setF({ ...f, logo_url: null })}>Remover logo</button>}
            </div>
          </div>
          <div><label className="label">Nome do restaurante</label>
            <input className="input" maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          {field('description', 'Descrição (opcional)', 'Conte em poucas palavras o que torna seu lugar especial')}
          {field('opening_hours', 'Horário de funcionamento (opcional)', 'Ex.: Ter a dom, 18h às 23h')}
          {field('address', 'Endereço (opcional)')}
          <div className="grid gap-3 sm:grid-cols-2">
            {field('instagram', 'Instagram (opcional)', '@seurestaurante')}
            {field('whatsapp', 'WhatsApp (opcional)', '(69) 99999-9999')}
          </div>
          <button className="btn-dark w-full" disabled={busy === 'rest'} onClick={saveRestaurant}>{busy === 'rest' ? 'Salvando…' : 'Salvar restaurante'}</button>
          <Note k="rest" />
          <p className="text-sm text-muted">Cores, fonte e capa ficam em Aparência.</p>
        </section>
      )}

      <section className="card space-y-4 lg:col-span-1">
        <h3 className="text-xl">Alterar senha</h3>
        <div><label className="label">Nova senha</label>
          <input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <div><label className="label">Repita a nova senha</label>
          <input className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
        <button className="btn-light w-full" disabled={busy === 'pw'} onClick={savePassword}>{busy === 'pw' ? 'Salvando…' : 'Alterar senha'}</button>
        <Note k="pw" />
      </section>
    </div>
  );
}
