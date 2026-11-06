'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { slugify } from '@/lib/utils';
import { AuthShell } from '@/lib/auth-shell';

type Mode = 'login' | 'signup' | 'forgot' | 'setup';

const TEXT: Record<Mode, { title: string; sub: string }> = {
  login: { title: 'Entrar', sub: 'Acesse o painel do seu estabelecimento.' },
  signup: { title: 'Criar conta', sub: 'Leva poucos minutos. O cardápio você monta depois.' },
  forgot: { title: 'Esqueceu a senha?', sub: 'Informe seu e-mail e enviaremos um link para criar uma nova senha.' },
  setup: { title: 'Seu estabelecimento', sub: 'O nome aparece no cardápio dos seus clientes. Você pode mudar depois.' },
};

function friendly(m: string) {
  if (/invalid login/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/already registered/i.test(m)) return 'Este e-mail já tem conta. Entre ou recupere a senha.';
  if (/rate limit/i.test(m)) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
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
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function afterAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: prof } = await supabase.from('profiles').select('id').eq('id', session.user.id).maybeSingle();
    if (prof) router.replace('/painel'); else setMode('setup');
  }
  useEffect(() => { afterAuth(); /* eslint-disable-next-line */ }, []);

  const go = (m: Mode) => { setMode(m); setMsg(null); };

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/redefinir-senha` });
      setBusy(false);
      return setMsg(error
        ? { text: friendly(error.message), ok: false }
        : { text: 'Se esse e-mail tiver conta, o link chega em instantes. Confira também o spam.', ok: true });
    }

    if (mode === 'setup') {
      const { error } = await supabase.rpc('create_establishment', { p_name: name.trim(), p_slug: slug || slugify(name) });
      setBusy(false);
      if (error) return setMsg({ text: friendly(error.message), ok: false });
      return router.replace('/painel');
    }

    const { data, error } = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) return setMsg({ text: friendly(error.message), ok: false });
    if (!data.session) return setMsg({ text: 'Conta criada! Confirme seu e-mail e depois entre.', ok: true });
    afterAuth();
  }

  const t = TEXT[mode];
  const cta = { login: 'Entrar', signup: 'Criar conta', forgot: 'Enviar link', setup: 'Criar e continuar' }[mode];
  const link = 'text-sm font-bold text-accent hover:underline';

  return (
    <AuthShell title={t.title} subtitle={t.sub}>
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
            {mode === 'signup' && <p className="mt-1 text-xs text-muted">Mínimo de 6 caracteres.</p>}
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

        <button disabled={busy} className="btn-dark w-full">{busy ? 'Aguarde…' : cta}</button>

        <p role="status" aria-live="polite" className={`min-h-5 text-sm font-semibold ${msg ? (msg.ok ? 'text-emerald-600' : 'text-red-600') : ''}`}>{msg?.text}</p>
      </form>

      <div className="mt-2 text-center">
        {mode === 'login' && <button className={link} onClick={() => go('signup')}>Ainda não tenho conta</button>}
        {mode === 'signup' && <button className={link} onClick={() => go('login')}>Já tenho conta</button>}
        {mode === 'forgot' && <button className={link} onClick={() => go('login')}>Voltar ao login</button>}
      </div>
    </AuthShell>
  );
}
