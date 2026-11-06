'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { slugify } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [step, setStep] = useState<'auth' | 'setup'>('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function afterAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: prof } = await supabase.from('profiles').select('id').eq('id', session.user.id).maybeSingle();
    if (prof) router.replace('/painel'); else setStep('setup');
  }
  useEffect(() => { afterAuth(); /* eslint-disable-next-line */ }, []);

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('');
    const fn = mode === 'login'
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password });
    const { data, error } = await fn;
    setBusy(false);
    if (error) return setMsg(error.message);
    if (!data.session) return setMsg('Conta criada! Confirme seu e-mail e depois entre.');
    afterAuth();
  }

  async function submitSetup(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('');
    const { error } = await supabase.rpc('create_establishment', { p_name: name.trim(), p_slug: slug || slugify(name) });
    setBusy(false);
    if (error) return setMsg(error.message.includes('duplicate') ? 'Esse endereço já está em uso. Escolha outro.' : error.message);
    router.replace('/painel');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-center text-2xl font-bold">{step === 'auth' ? (mode === 'login' ? 'Entrar' : 'Criar conta') : 'Seu estabelecimento'}</h1>
      {step === 'auth' ? (
        <form onSubmit={submitAuth} className="space-y-3">
          <input className="input" type="email" required placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" type="password" required minLength={6} placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button disabled={busy} className="btn-dark w-full">{busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
          <button type="button" className="w-full text-sm text-gray-600 underline" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? 'Ainda não tenho conta' : 'Já tenho conta'}
          </button>
        </form>
      ) : (
        <form onSubmit={submitSetup} className="space-y-3">
          <div>
            <label className="label">Nome do estabelecimento</label>
            <input className="input" required value={name} onChange={(e) => { setName(e.target.value); setSlug(slugify(e.target.value)); }} />
          </div>
          <div>
            <label className="label">Endereço do cardápio</label>
            <input className="input" required value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
            <p className="mt-1 text-xs text-gray-500">Ficará em /c/{slug || 'seu-endereco'}</p>
          </div>
          <button disabled={busy} className="btn-dark w-full">{busy ? 'Criando…' : 'Criar e continuar'}</button>
        </form>
      )}
      {msg && <p className="text-center text-sm text-red-600">{msg}</p>}
    </main>
  );
}
