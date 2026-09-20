'use client';
import { useState } from 'react';

type State = 'neutral' | 'selected' | 'fixed' | 'excluded';
const next: Record<State, State> = { neutral: 'selected', selected: 'fixed', fixed: 'excluded', excluded: 'neutral' };
export function PlayslipGrid({ initial = [], onChange }: { initial?: number[]; onChange?: (numbers: number[]) => void }) {
  const [states, setStates] = useState<Record<number, State>>(() => Object.fromEntries(initial.map(n => [n, 'selected'])) as Record<number, State>);
  const cycle = (number: number) => setStates(current => { const updated = { ...current, [number]: next[current[number] ?? 'neutral'] }; onChange?.(Object.entries(updated).filter(([, state]) => state === 'selected' || state === 'fixed').map(([n]) => Number(n)).sort((a,b) => a-b)); return updated; });
  const count = Object.values(states).filter(s => s === 'selected' || s === 'fixed').length;
  return <section className="slip" aria-label="Volante de seleção"><div className="slip-head"><span className="slip-title">Marque suas dezenas</span><span aria-live="polite">{count}/15 mín.</span></div><div className="number-grid" role="grid" aria-label="Dezenas de 1 a 25">{Array.from({ length: 25 }, (_, i) => i + 1).map(number => { const state = states[number] ?? 'neutral'; const label = state === 'fixed' ? 'fixa' : state === 'excluded' ? 'excluída' : state === 'selected' ? 'marcada' : 'disponível'; return <button key={number} type="button" role="gridcell" className={`number ${state}`} onClick={() => cycle(number)} aria-label={`Dezena ${number}, ${label}. Clique para avançar o estado.`}>{number}</button>; })}</div><p style={{fontSize:12, marginBottom:0}}>Clique para marcar, fixar, excluir ou limpar. O estado nunca depende só da cor.</p></section>;
}
