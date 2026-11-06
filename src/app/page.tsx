import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-bold">Cardápio Digital</h1>
      <p className="text-gray-600">Cardápio por QR Code e pedidos direto da mesa, sem aplicativo.</p>
      <Link href="/login" className="btn-dark w-full">Entrar no painel</Link>
    </main>
  );
}
