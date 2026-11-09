import Link from 'next/link';
import { RecoveryRedirect } from '@/lib/recovery-redirect';

export default function Home() {
  return (
    <div className="pos-ui flex items-center justify-center">
      <RecoveryRedirect />
      <main className="flex max-w-md flex-col items-center gap-6 p-6 text-center">
        <h1 className="text-4xl">Cardápio Digital</h1>
        <p className="text-muted">Cardápio por QR Code e pedidos direto da mesa, sem aplicativo.</p>
        <Link href="/login" className="btn-dark w-full">Entrar no painel</Link>
      </main>
    </div>
  );
}
