'use client';
import { useState } from 'react';

type State = 'neutral' | 'selected' | 'fixed' | 'excluded';
const next: Record<State, State> = { neutral: 'selected', selected: 'fixed', fixed: 'excluded', excluded: 'neutral' };

type Props = { initial?: number[]; onChange?: (numbers: number[]) => void; heatmapValues?: number[]; readOnly?: boolean; label?: string };
export function PlayslipGrid({ initial = [], onChange, heatmapValues, readOnly = false, label = 'Volante de seleção' }: Props) {
  const [states, setStates] = useState<Record<number, State>>(() => Object.fromEntries(initial.map(n => [n, 'selected'])) as Record<number, State>);
  const maximum = Math.max(...(heatmapValues ?? [0]), 1);
  const cycle = (number: number) => {
    if (readOnly) return;
    setStates(current => { const updated = { ...current, [number]: next[current[number] ?? 'neutral'] }; onChange?.(Object.entries(updated).filter(([, state]) => state === 'selected' || state === 'fixed').map(([n]) => Number(n)).sort((a, b) => a - b)); return updated; });
  };
  const count = Object.values(states).filter(s => s === 'selected' || s === 'fixed').length;
  return <section className="slip" aria-label={label}><div className="slip-head"><span className="slip-title">{readOnly ? 'Frequência observada' : 'Marque suas dezenas'}</span><span aria-live="polite">{readOnly ? '1–25' : `${count}/15 mín.`}</span></div><div className="number-grid" role="grid" aria-label="Dezenas de 1 a 25">{Array.from({ length: 25 }, (_, i) => i + 1).map(number => { const state = states[number] ?? 'neutral'; const frequency = heatmapValues?.[number - 1] ?? 0; const intensity = heatmapValues ? Math.max(.08, frequency / maximum) : undefined; const labelText = state === 'fixed' ? 'fixa' : state === 'excluded' ? 'excluída' : state === 'selected' ? 'marcada' : heatmapValues ? `${frequency} ocorrências` : 'disponível'; return <button key={number} type="button" role="gridcell" className={`number ${state} ${heatmapValues ? 'heatmap-number' : ''}`} style={intensity === undefined ? undefined : { ['--heat-intensity' as string]: intensity }} onClick={() => cycle(number)} aria-label={`Dezena ${number}, ${labelText}${readOnly ? '.' : '. Clique para avançar o estado.'}`} tabIndex={readOnly ? -1 : 0}>{number}</button>; })}</div><p style={{ fontSize: 12, marginBottom: 0 }}>{readOnly ? 'Azul mais intenso indica maior frequência relativa no arquivo histórico. O valor numérico também é informado para não depender apenas da cor.' : 'Clique para marcar, fixar, excluir ou limpar. O estado nunca depende só da cor.'}</p></section>;
}
