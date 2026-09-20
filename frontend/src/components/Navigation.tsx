'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links: ReadonlyArray<readonly [string, string]> = [['/', 'Gerar'], ['/history', 'Histórico'], ['/validar', 'Validar']];

export function Navigation() {
  const pathname = usePathname();
  return <nav className="nav" aria-label="Navegação principal">{links.map(([href, label]) => <Link key={href} className={pathname === href || (href === '/history' && pathname.startsWith('/history')) ? 'active' : undefined} href={href} aria-current={pathname === href || (href === '/history' && pathname.startsWith('/history')) ? 'page' : undefined}>{label}</Link>)}</nav>;
}
