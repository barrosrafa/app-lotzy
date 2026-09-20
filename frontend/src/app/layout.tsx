import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { Navigation } from '@/components/Navigation';

export const metadata: Metadata = { title: 'Lotzy — jogos com contexto', description: 'Geração e análise combinatória para Lotofácil, sem promessa de previsão.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><div className="shell"><header className="topbar"><Link className="brand" href="/"><span className="brand-mark">L</span> lotzy</Link><Navigation /></header>{children}<footer className="footer">Lotzy é uma ferramenta combinatória independente. Nenhum recurso aumenta a probabilidade de premiação. Aposte apenas o que puder perder.</footer></div></body></html>;
}
