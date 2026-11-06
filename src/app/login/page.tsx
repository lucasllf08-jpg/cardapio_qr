'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { slugify } from '@/lib/utils';
import { AuthShell } from '@/lib/auth-shell';

type Mode = 'login' | 'signup' | 'forgot' | 'setup' | 'check';
type Msg = { text: string; ok: boolean };

const TEXT: Record<Mode, { title: string; sub: string }> = {
  login: { title: 'Entrar', sub: 'Acesse o painel do seu estabelecimento.' },
  signup: { title: 'Criar conta', sub: 'Leva poucos minutos. O cardápio você monta depois.' },
  forgot: { title: 'Esqueceu a senha?', sub: 'Informe seu e-mail e enviaremos um link para criar uma nova senha.' },
  setup: { title: 'Seu estabelecimento', sub: 'O nome aparece no cardápio dos seus clientes. Você pode mudar depois.' },
  check: { title: 'Confirme seu e-mail', sub: '' },
};

function friendly(m: string) {
  if (/invalid login/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/already registered/i.test(m)) return 'Este e-mail já tem conta. Entre ou recupere a senha.';
  if (/only request this after|rate limit/i.test(m)) return 'Muitos pedidos seguidos. Aguarde alguns minutos e tente de novo.';
  if (/not authorized/i.test(m)) return 'O envio de e-mails ainda não está configurado no sistema. Avise o administrador.';
  if (/duplicate|already in use/i.test(m)) return 'Esse endereço já está em uso. Escolha outro.';
  return m;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [msg, setMsg] = useState<Msg | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0); // segundos até poder reenviar e-mail

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function afterAuth(confirmed = false) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: prof } = await supabase.from('profiles').select('id').eq('id', session.user.id).maybeSingle();
    if (prof) return router.replace('/painel');
    setMode('setup');
    if (confirmed) setMsg({ text: 'E-mail confirmado! Agora cadastre seu estabelecimento.', ok: true });
  }
  useEffect(() => {
    afterAuth(new URLSearchParams(window.location.search).has('confirmado'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (m: Mode) => { setMode(m); setMsg(null); };
  const confirmUrl = () => `${window.location.origin}/login?confirmado=1`;

  async function resend() {
    if (wait > 0 || !email) return;
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: confirmUrl() } });
    setBusy(false);
    if (error) return setMsg({ text: friendly(error.message), ok: false });
    setWait(60);
    setMsg({ text: 'Enviamos um novo link. Confira também a caixa de spam.', ok: true });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setMsg(null);

    if (mode === 'forgot') {
      if (wait > 0) return setBusy(false);
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/redefinir-senha` });
      setBusy(false);
      if (error) return setMsg({ text: friendly(error.message), ok: false });
      setWait(60);
      return setMsg({ text: 'Se esse e-mail tiver conta, o link chega em instantes. Confira também o spam.', ok: true });
    }

    if (mode === 'setup') {
      const { error } = await supabase.rpc('create_establishment', { p_name: name.trim(), p_slug: slug || slugify(name) });
      setBusy(false);
      if (error) return setMsg({ text: friendly(error.message), ok: false });
      return router.replace('/painel');
    }

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: confirmUrl() } });
      setBusy(false);
      if (error) return setMsg({ text: friendly(error.message), ok: false });
      // Com confirmação ligada, e-mail já cadastrado volta "sucesso" sem identidades
      if (data.user && data.user.identities?.length === 0) return setMsg({ text: 'Este e-mail já tem conta. Entre ou recupere a senha.', ok: false });
      if (!data.session) { setWait(60); return go('check'); }
      return afterAuth();
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      if (/not confirmed/i.test(error.message)) {
        setMode('check');
        return setMsg({ text: 'Seu e-mail ainda não foi confirmado. Use o link que enviamos ou peça um novo.', ok: false });
      }
      return setMsg({ text: friendly(error.message), ok: false });
    }
    afterAuth();
  }

  const t = TEXT[mode];
  const sub = mode === 'check' ? `Enviamos um link para ${email || 'o seu e-mail'}. Clique nele para ativar a conta e depois volte aqui para entrar.` : t.sub;
  const cta = { login: 'Entrar', signup: 'Criar conta', forgot: wait > 0 ? `Reenviar em ${wait}s` : 'Enviar link', setup: 'Criar e continuar', check: '' }[mode];
  const link = 'text-sm font-bold text-accent hover:underline';
  const status = (
    <p role="status" aria-live="polite" className={`min-h-5 text-sm font-semibold ${msg ? (msg.ok ? 'text-emerald-600' : 'text-red-600') : ''}`}>{msg?.text}</p>
  );

  if (mode === 'check') {
    return (
      <AuthShell title={t.title} subtitle={sub}>
        <div className="space-y-4">
          <button className="btn-dark w-full" disabled={busy || wait > 0} onClick={resend}>
            {busy ? 'Aguarde…' : wait > 0 ? `Reenviar em ${wait}s` : 'Reenviar e-mail'}
          </button>
          {status}
          <p className="text-sm text-muted">Não chegou? Veja a caixa de spam e confira se o e-mail está correto.</p>
          <div className="text-center"><button className={link} onClick={() => go('login')}>Voltar ao login</button></div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t.title} subtitle={sub}>
      <form onSubmit={submit} className="space-y-4">
        {mode !== 'setup' && (
          <div>
            <label htmlFor="email" className="label">E-mail</label>
            <input id="email" className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        )}

        {(mode === 'login' || mode === 'signup') && (
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="label">Senha</label>
              {mode === 'login' && <button type="button" className={link} onClick={() => go('forgot')}>Esqueci minha senha</button>}
            </div>
            <div className="relative">
              <input id="password" className="input pr-20" type={showPw ? 'text' : 'password'} required minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShowPw(!showPw)} aria-pressed={showPw}
                className="absolute inset-y-0 right-3 text-sm font-semibold text-muted">{showPw ? 'Ocultar' : 'Mostrar'}</button>
            </div>
            {mode === 'signup' && <p className="mt-1 text-xs text-muted">Mínimo de 6 caracteres. Vamos enviar um link para confirmar seu e-mail.</p>}
          </div>
        )}

        {mode === 'setup' && (
          <>
            <div>
              <label htmlFor="name" className="label">Nome do estabelecimento</label>
              <input id="name" className="input" required value={name} onChange={(e) => { setName(e.target.value); setSlug(slugify(e.target.value)); }} />
            </div>
            <div>
              <label htmlFor="slug" className="label">Endereço do cardápio</label>
              <input id="slug" className="input" required value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
              <p className="mt-1 text-xs text-muted">Seu cardápio ficará em /c/{slug || 'seu-endereco'}</p>
            </div>
          </>
        )}

        <button disabled={busy || (mode === 'forgot' && wait > 0)} className="btn-dark w-full">{busy ? 'Aguarde…' : cta}</button>
        {status}
      </form>

      <div className="mt-2 text-center">
        {mode === 'login' && <button className={link} onClick={() => go('signup')}>Ainda não tenho conta</button>}
        {mode === 'signup' && <button className={link} onClick={() => go('login')}>Já tenho conta</button>}
        {mode === 'forgot' && <button className={link} onClick={() => go('login')}>Voltar ao login</button>}
      </div>
    </AuthShell>
  );
}
