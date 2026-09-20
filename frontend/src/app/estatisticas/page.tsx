'use client';

import { useEffect, useState } from 'react';
import {
  generateCycle,
  getCompositionStats,
  getCycles,
  getDelays,
  getTemperature,
  type CompositionResponse,
  type CycleResponse,
  type StatsDelay,
  type StatsTemperature,
} from '@/lib/api';
import { PageShell } from '@/app/aux-pages';

function DistributionList({ title, distribution, limit }: { title: string; distribution: Record<string, number>; limit?: number }) {
  const entries = Object.entries(distribution).sort(([, first], [, second]) => second - first || Number(first) - Number(second));
  const visibleEntries = limit ? entries.slice(0, limit) : entries;
  const maximum = Math.max(1, ...visibleEntries.map(([, count]) => count));

  return (
    <div className="distribution-block">
      <h3>{title}</h3>
      <div className="distribution-list">
        {visibleEntries.map(([label, count]) => (
          <div className="distribution-row" key={label}>
            <span className="distribution-label">{label}</span>
            <div className="distribution-bar" aria-hidden="true"><span style={{ width: `${(count / maximum) * 100}%` }} /></div>
            <span className="status">{count}x</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function percentage(value: number, total: number): string {
  return `${((value / Math.max(1, total)) * 100).toFixed(1)}%`;
}

export default function StatisticsPage() {
  const [delays, setDelays] = useState<StatsDelay[]>([]);
  const [temperature, setTemperature] = useState<StatsTemperature>();
  const [cycles, setCycles] = useState<CycleResponse>();
  const [composition, setComposition] = useState<CompositionResponse>();
  const [windowSize, setWindowSize] = useState<10 | 20 | 50>(20);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getDelays(), getTemperature(windowSize), getCycles(), getCompositionStats()])
      .then(([delaysResponse, temperatureResponse, cyclesResponse, compositionResponse]) => {
        setDelays(delaysResponse.data);
        setTemperature(temperatureResponse);
        setCycles(cyclesResponse);
        setComposition(compositionResponse);
      })
      .catch(error => setMessage(error instanceof Error ? error.message : 'Não foi possível carregar as estatísticas.'))
      .finally(() => setLoading(false));
  }, [windowSize]);

  async function cycleGame() {
    if (!cycles) return;
    setMessage('Gerando…');
    try {
      const result = await generateCycle(1, Math.max(15, cycles.dezenasFaltantes.length));
      sessionStorage.setItem('lotzy:validated-games', JSON.stringify({ batch: { disclaimer: result.disclaimer }, analysis: { data: result.data, aggregate: { meanSum: 0, stdDevSum: 0, meanPopularity: 0 } } }));
      setMessage('Jogo gerado com as dezenas faltantes. Abra Analisar para revisar.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível gerar.');
    }
  }

  const compositionData = composition?.data;
  const sequenceTotal = compositionData ? compositionData.distribuicoes.sequencias.longas + compositionData.distribuicoes.sequencias.curtas : 0;

  return (
    <PageShell
      eyebrow="04 · Estatísticas"
      title="Leia o histórico sem transformá-lo em promessa."
      intro="Frequência e composição ajudam a descrever resultados anteriores; nenhuma métrica muda a probabilidade do próximo sorteio."
    >
      {loading ? (
        <div className="paper-card">Carregando histórico…</div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat"><span>Ciclo atual</span><b>{cycles?.cicloAtual ?? '—'}</b></div>
            <div className="stat"><span>Concursos analisados</span><b>{compositionData?.totalConcursos ?? '—'}</b></div>
            <div className="stat"><span>Dezenas faltantes no ciclo</span><b>{cycles?.dezenasFaltantes.join(', ') || 'Nenhuma'}</b></div>
          </div>

          <div className="controls">
            <label>
              Janela de temperatura
              <select value={windowSize} onChange={event => setWindowSize(Number(event.target.value) as 10 | 20 | 50)}>
                <option value={10}>10 concursos</option>
                <option value={20}>20 concursos</option>
                <option value={50}>50 concursos</option>
              </select>
            </label>
            <button className="btn btn-primary" onClick={cycleGame} disabled={!cycles?.dezenasFaltantes.length}>Gerar jogo do ciclo</button>
          </div>

          {compositionData && (
            <>
              <section className="paper-card statistics-section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">Composição</span>
                    <h2>Números primos</h2>
                  </div>
                  <span className="status">média {compositionData.medias.primos.toFixed(2)} por concurso</span>
                </div>
                <p>A contagem considera o mesmo conjunto de primos usado pelo domínio do Lotzy: 2, 3, 5, 7, 11, 13, 17, 19 e 23.</p>
                <DistributionList title="Frequência de primos por concurso" distribution={compositionData.distribuicoes.primos} />
              </section>

              <section className="paper-card statistics-section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">Geometria do volante</span>
                    <h2>Moldura vs. miolo</h2>
                  </div>
                  <span className="status">moldura {compositionData.medias.moldura.toFixed(2)} · miolo {compositionData.medias.miolo.toFixed(2)}</span>
                </div>
                <p>Na maioria esmagadora dos sorteios, saem entre 9 e 11 números na moldura, com 10 como resultado mais comum, e entre 4 e 6 no miolo.</p>
                <div className="page-grid">
                  <DistributionList title="Números na moldura" distribution={compositionData.distribuicoes.moldura} />
                  <DistributionList title="Números no miolo" distribution={compositionData.distribuicoes.miolo} />
                </div>
              </section>

              <section className="paper-card statistics-section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">Distribuição espacial</span>
                    <h2>Linhas e colunas</h2>
                  </div>
                </div>
                <p>Dificilmente uma linha ou coluna fica totalmente vazia ou totalmente cheia. O padrão mais equilibrado costuma ter 2, 3 ou 4 números por linha ou coluna, como 3-3-3-3-3 e 4-3-3-3-2.</p>
                <div className="page-grid">
                  <DistributionList title="Padrões por linha" distribution={compositionData.distribuicoes.linhas} />
                  <DistributionList title="Padrões por coluna" distribution={compositionData.distribuicoes.colunas} />
                </div>
              </section>

              <section className="paper-card statistics-section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">Paridade</span>
                    <h2>Pares e ímpares</h2>
                  </div>
                  <span className="status">média {compositionData.medias.pares.toFixed(2)} pares · {compositionData.medias.impares.toFixed(2)} ímpares</span>
                </div>
                <div className="page-grid">
                  <DistributionList title="Quantidade de pares" distribution={compositionData.distribuicoes.pares} />
                  <DistributionList title="Quantidade de ímpares" distribution={compositionData.distribuicoes.impares} />
                </div>
              </section>

              <section className="paper-card statistics-section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">Consecutividade</span>
                    <h2>Sequências longas e curtas</h2>
                  </div>
                  <span className="status">maior corrida média {compositionData.medias.maiorSequencia.toFixed(2)}</span>
                </div>
                <p>Uma sequência longa é classificada quando a maior corrida de números consecutivos é igual ou superior a 3; sequências curtas têm corrida máxima de até 2.</p>
                <div className="stat-grid">
                  <div className="stat"><span>Sequências longas (≥ 3)</span><b>{compositionData.distribuicoes.sequencias.longas} <small>({percentage(compositionData.distribuicoes.sequencias.longas, sequenceTotal)})</small></b></div>
                  <div className="stat"><span>Sequências curtas (≤ 2)</span><b>{compositionData.distribuicoes.sequencias.curtas} <small>({percentage(compositionData.distribuicoes.sequencias.curtas, sequenceTotal)})</small></b></div>
                  <div className="stat"><span>Total de concursos</span><b>{sequenceTotal}</b></div>
                </div>
              </section>
            </>
          )}

          <div className="page-grid">
            <section className="paper-card">
              <h2>Temperatura · {temperature?.janela}</h2>
              <div className="result-list">{temperature?.data.map(item => <div className="game-row" key={item.dezena}><span className="game-index">{String(item.dezena).padStart(2, '0')}</span><div style={{ flex: 1 }}><div style={{ height: 8, borderRadius: 99, background: 'var(--ink)', width: `${Math.max(3, item.percentual)}%` }} /></div><span className="status">{item.frequencia}x</span></div>)}</div>
            </section>
            <section className="paper-card">
              <h2>Maiores atrasos atuais</h2>
              <div className="result-list">{[...delays].sort((a, b) => b.atrasoAtual - a.atrasoAtual).slice(0, 10).map(item => <div className="game-row" key={item.dezena}><span className="game-index">Dezena {item.dezena}</span><span className="status">{item.atrasoAtual} concursos</span></div>)}</div>
            </section>
          </div>

          <div className="disclaimer"><p>{composition?.disclaimer ?? cycles?.disclaimer ?? 'Estas métricas são descritivas e não alteram a probabilidade de qualquer combinação.'}</p></div>
          {message && <div className="error" role="status">{message}</div>}
        </>
      )}
    </PageShell>
  );
}
