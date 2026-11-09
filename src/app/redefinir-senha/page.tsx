'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { AuthShell } from '@/lib/auth-shell';

function friendly(m: string) {
  if (/different from the old|same_password/i.test(m)) return 'A nova senha precisa ser diferente da atual.';
  if (/at least \d+ characters|weak/i.test(m)) return 'Senha muito fraca. Use ao menos 6 caracteres.';
  if (/session.*missing|not authenticated|jwt/i.test(m)) return 'O link expirou. Volte ao login e peça um novo.';
  if (/rate limit/i.test(m)) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  return m;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    // Link vencido/já usado: o Supabase devolve o erro no endereço (#error_code=otp_expired)
    if (/error_code=|error=access_denied/.test(window.location.hash)) { setExpired(true); return; }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    const t = setTimeout(() => setExpired(true), 5000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    if (pw.length < 6) return setMsg('A senha precisa ter ao menos 6 caracteres.');
    if (pw !== pw2) return setMsg('As senhas não são iguais.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg(friendly(error.message));
    setDone(true);
    setTimeout(() => router.replace('/painel'), 1500);
  }

  if (done) {
    return (
      <AuthShell title="Senha alterada" subtitle="Tudo certo! Levando você ao painel…">
        <Link href="/painel" className="btn-dark w-full">Ir para o painel</Link>
      </AuthShell>
    );
  }

  if (!ready) {
    return (
      <AuthShell title={expired ? 'Link inválido ou expirado' : 'Verificando link…'}
        subtitle={expired ? 'Peça um novo link de redefinição para continuar.' : undefined}>
        {expired && <Link href="/login" className="btn-dark w-full">Voltar ao login</Link>}
      </AuthShell>
    );
  }

  const type = showPw ? 'text' : 'password';
  return (
    <AuthShell title="Nova senha" subtitle="Escolha uma senha que você não use em outros sites.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="pw" className="label">Nova senha</label>
          <div className="relative">
            <input id="pw" className="input pr-20" type={type} required minLength={6} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            <button type="button" onClick={() => setShowPw(!showPw)} aria-pressed={showPw}
              className="absolute inset-y-0 right-3 text-sm font-semibold text-muted">{showPw ? 'Ocultar' : 'Mostrar'}</button>
          </div>
          <p className="mt-1 text-xs text-muted">Mínimo de 6 caracteres.</p>
        </div>
        <div>
          <label htmlFor="pw2" className="label">Repita a nova senha</label>
          <input id="pw2" className="input" type={type} required minLength={6} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </div>
        <button disabled={busy} className="btn-dark w-full">{busy ? 'Salvando…' : 'Salvar nova senha'}</button>
        <p role="status" aria-live="polite" className="min-h-5 text-sm font-semibold text-red-600">{msg}</p>
      </form>
    </AuthShell>
  );
}
