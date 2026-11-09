'use client';
import { useEffect } from 'react';

// Rede de segurança: se o Supabase mandar o link de recuperação para a página inicial
// (Redirect URL não cadastrada), encaminha para /redefinir-senha mantendo o token.
export function RecoveryRedirect() {
  useEffect(() => {
    if (/type=recovery/.test(window.location.hash)) {
      window.location.replace('/redefinir-senha' + window.location.hash);
    }
  }, []);
  return null;
}
