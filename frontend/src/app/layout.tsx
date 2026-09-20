import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = { title: 'Lotzy — jogos com contexto', description: 'Geração e análise combinatória para Lotofácil, sem promessa de previsão.' };
const links: ReadonlyArray<readonly [string, string]> = [['/', 'Gerar'], ['/filtros', 'Filtros'], ['/validar', 'Validar'], ['/analisar', 'Analisar'], ['/conferir', 'Conferir'], ['/ferramentas', 'Ferramentas'], ['/carteira', 'Carteira']];
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><div className="shell"><header className="topbar"><Link className="brand" href="/"><span className="brand-mark">L</span> lotzy</Link><nav className="nav" aria-label="Navegação principal">{links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}</nav></header>{children}<footer className="footer">Lotzy é uma ferramenta combinatória independente. Nenhum recurso aumenta a probabilidade de premiação. Aposte apenas o que puder perder.</footer></div></body></html>;
}
