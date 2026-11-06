import type { Metadata, Viewport } from 'next';
import { Inter, Poppins, Merriweather, Nunito } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-poppins' });
const merri = Merriweather({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-merriweather' });
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito' });

export const metadata: Metadata = {
  title: 'Cardápio Digital',
  description: 'Cardápio digital com pedido por QR Code',
  manifest: '/manifest.webmanifest',
};
export const viewport: Viewport = { themeColor: '#111827', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} ${poppins.variable} ${merri.variable} ${nunito.variable} ${inter.className}`}>
        {children}
      </body>
    </html>
  );
}
