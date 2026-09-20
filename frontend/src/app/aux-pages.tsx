'use client';
import { useState } from 'react';
import { validateGame } from '@/lib/api';
import { PlayslipGrid } from '@/components/PlayslipGrid';

export function ValidatePage() {
  const [game, setGame] = useState<number[]>([]);
  const [result, setResult] = useState<unknown>();
  return <PageShell eyebrow="Validar volante" title="Uma combinação, com contexto." intro="Confirme tamanho, métricas e avisos sem transformar uma nota estatística em erro."><PlayslipGrid onChange={setGame} /><button className="btn btn-primary" style={{ marginTop: 18 }} onClick={async () => setResult(await validateGame(game))}>Validar esta combinação</button>{result !== undefined && <pre className="paper-card" style={{ whiteSpace: 'pre-wrap', marginTop: 18 }}>{JSON.stringify(result, null, 2)}</pre>}</PageShell>;
}

function PageShell({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: React.ReactNode }) {
  return <main className="main"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{intro}</p><div style={{ marginTop: 30 }}>{children}</div></main>;
}
