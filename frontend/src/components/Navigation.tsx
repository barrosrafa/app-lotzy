'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
const links: ReadonlyArray<readonly [string, string]> = [['/', 'Gerar'], ['/filtros', 'Filtros'], ['/analisar', 'Analisar'], ['/history', 'Histórico'], ['/validar', 'Validar'], ['/ajuda', 'Ajuda']];
export function Navigation() { const pathname = usePathname(); return <nav className="nav" aria-label="Navegação principal">{links.map(([href, label]) => { const active = pathname === href || (href !== '/' && pathname.startsWith(href)); return <Link key={href} className={active ? 'active' : undefined} href={href} aria-current={active ? 'page' : undefined}>{label}</Link>; })}</nav>; }
