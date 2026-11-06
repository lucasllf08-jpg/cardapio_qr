'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { AuthShell } from '@/lib/auth-shell';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    const t = setTimeout(() => setExpired(true), 4000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    if (pw.length < 6) return setMsg('A senha precisa ter ao menos 6 caracteres.');
    if (pw !== pw2) return setMsg('As senhas não são iguais.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg(error.message);
    router.replace('/painel');
  }

  if (!ready) {
    return (
      <AuthShell title={expired ? 'Link inválido ou expirado' : 'Verificando link…'}
        subtitle={expired ? 'Peça um novo link de redefinição para continuar.' : undefined}>
        {expired && <Link href="/login" className="btn-dark w-full">Voltar ao login</Link>}
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Nova senha" subtitle="Escolha uma senha que você não use em outros sites.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="pw" className="label">Nova senha</label>
          <input id="pw" className="input" type="password" required minLength={6} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <div>
          <label htmlFor="pw2" className="label">Repita a nova senha</label>
          <input id="pw2" className="input" type="password" required minLength={6} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </div>
        <button disabled={busy} className="btn-dark w-full">{busy ? 'Salvando…' : 'Salvar nova senha'}</button>
        <p role="status" aria-live="polite" className="min-h-5 text-sm font-semibold text-red-600">{msg}</p>
      </form>
    </AuthShell>
  );
}
