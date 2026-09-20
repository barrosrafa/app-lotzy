'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  analyzeGames,
  formatMoney,
  generateFiltered,
  getFilters,
  parseNumbers,
  useSimular,
  validateAndAnalyzeBatch,
  type FilterCatalog,
  type GeneratedResponse,
} from '@/lib/api';

export function FiltersPage() {
  const router = useRouter(); const [catalog, setCatalog] = useState<FilterCatalog>(); const [quantity, setQuantity] = useState(5); const [numbersPerGame, setNumbersPerGame] = useState(15); const [fixed, setFixed] = useState(''); const [excluded, setExcluded] = useState(''); const [sumMin, setSumMin] = useState(''); const [sumMax, setSumMax] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  useEffect(() => { getFilters().then(setCatalog).catch(reason => setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os filtros.')); }, []);
  async function submit() { setError(''); const fixedNumbers = parseNumbers(fixed); const excludedNumbers = parseNumbers(excluded); if (fixedNumbers.some(n => excludedNumbers.includes(n))) { setError('Uma dezena não pode ser fixa e excluída ao mesmo tempo.'); return; } setLoading(true); try { const response = await generateFiltered({ quantity, numbersPerGame, fixedNumbers, excludedNumbers, filters: { ...(sumMin || sumMax ? { sum: { ...(sumMin ? { min: Number(sumMin) } : {}), ...(sumMax ? { max: Number(sumMax) } : {}) } } : {}) } }); const validated = await validateAndAnalyzeBatch(response); sessionStorage.setItem('lotzy:validated-games', JSON.stringify(validated)); router.push('/analisar'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível gerar com os filtros.'); } finally { setLoading(false); } }
  return <PageShell eyebrow="01 · Filtros" title="Escolha as restrições." intro="Ajuste somente os filtros oferecidos pela API. A natureza e as advertências de cada filtro vêm do catálogo, sem promessas históricas."><div className="paper-card"><div className="controls"><label>Quantidade<input type="number" min={1} max={100} value={quantity} onChange={event => setQuantity(Math.min(100, Math.max(1, Number(event.target.value))))} /></label><label>Dezenas por jogo<select value={numbersPerGame} onChange={event => setNumbersPerGame(Number(event.target.value))}>{[15,16,17,18,19,20].map(number => <option key={number}>{number}</option>)}</select></label></div><div className="filter-grid"><label>Dezenas fixas<input placeholder="Ex.: 1, 7, 13" value={fixed} onChange={event => setFixed(event.target.value)} /><small>Serão incluídas em todos os jogos.</small></label><label>Dezenas excluídas<input placeholder="Ex.: 4, 9, 22" value={excluded} onChange={event => setExcluded(event.target.value)} /><small>Não serão usadas na geração.</small></label><label>Soma mínima<input type="number" placeholder="Ex.: 170" value={sumMin} onChange={event => setSumMin(event.target.value)} /></label><label>Soma máxima<input type="number" placeholder="Ex.: 220" value={sumMax} onChange={event => setSumMax(event.target.value)} /></label></div>{catalog?.data.map(item => <div className="catalog-row" key={item.key}><div><strong>{item.label}</strong><span className="tag">{item.nature}</span></div><p>{item.note ?? 'Disponível conforme o contrato da API.'}{item.deprecationHint ? ` ${item.deprecationHint}` : ''}</p></div>)}{error && <div className="error" role="alert">{error}</div>}<button className="btn btn-primary" type="button" onClick={submit} disabled={loading}>{loading ? 'Gerando…' : 'Gerar com filtros'}</button></div></PageShell>;
}

function downloadGames(games: number[][], format: 'csv'|'txt'|'json') { const body = format === 'csv' ? ['jogo,dezenas', ...games.map((game, index) => `${index + 1},\"${game.join(' ')}\"`)].join('\n') : format === 'txt' ? games.map(game => game.join(' ')).join('\n') : JSON.stringify(games.map(game => ({ game })), null, 2); const blob = new Blob([body], { type: format === 'json' ? 'application/json' : 'text/plain' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `lotzy-jogos-${Date.now()}.${format}`; link.click(); URL.revokeObjectURL(link.href); }
function shareGames(games: number[][]) { const text = `Meus jogos Lotzy\n${games.map((game, index) => `${index + 1}. ${game.join(' ')}`).join('\n')}`; if (navigator.share) navigator.share({ title: 'Jogos Lotzy', text }).catch(() => undefined); else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer'); }
export function AnalyzePage() {
  const [payload, setPayload] = useState<{ batch: GeneratedResponse; analysis: Awaited<ReturnType<typeof analyzeGames>> }>();
  const [isLoadingStorage, setIsLoadingStorage] = useState(true);
  const { simular, data: simularResult, isLoading: isSimulando, error: simularError } = useSimular();

  useEffect(() => {
    const raw = sessionStorage.getItem('lotzy:validated-games');
    if (raw) {
      try {
        setPayload(JSON.parse(raw));
      } catch {
        /* estado vazio */
      }
    }
    setIsLoadingStorage(false);
  }, []);

  async function handleSimular() {
    if (!payload?.analysis?.data) return;
    const cartoes = payload.analysis.data.map((item) => item.game);
    try {
      await simular({ cartoes });
    } catch {
      /* erro gerenciado pelo hook */
    }
  }

  return (
    <PageShell
      eyebrow="03 · Analisar"
      title="Leia o lote sem superestimar o acaso."
      intro="A análise mostra métricas calculadas pela API e mantém o aviso de que filtros e popularidade não aumentam a probabilidade de premiação."
    >
      {isLoadingStorage ? (
        <div className="history-skeleton" aria-busy="true">
          <span style={{ height: 90 }} />
          <span style={{ height: 200 }} />
        </div>
      ) : payload ? (
        <>
          <div className="stat-grid">
            <div className="stat">
              <span>Soma média</span>
              <b>{payload.analysis.aggregate.meanSum.toFixed(1)}</b>
            </div>
            <div className="stat">
              <span>Desvio da soma</span>
              <b>{payload.analysis.aggregate.stdDevSum.toFixed(1)}</b>
            </div>
            <div className="stat">
              <span>Popularidade média</span>
              <b>{payload.analysis.aggregate.meanPopularity.toFixed(2)}</b>
            </div>
          </div>

          <div className="paper-card" style={{ marginTop: 24 }}>
            <div className="section-heading">
              <h2>Jogos validados</h2>
              <div className="controls" style={{ margin: 0 }}>
                <button className="btn btn-secondary" onClick={() => downloadGames(payload.analysis.data.map((entry) => entry.game), 'csv')}>
                  CSV
                </button>
                <button className="btn btn-secondary" onClick={() => downloadGames(payload.analysis.data.map((entry) => entry.game), 'txt')}>
                  TXT
                </button>
                <button className="btn btn-secondary" onClick={() => shareGames(payload.analysis.data.map((entry) => entry.game))}>
                  Compartilhar
                </button>
                <button className="btn btn-primary" onClick={handleSimular} disabled={isSimulando} aria-busy={isSimulando}>
                  {isSimulando ? 'Simulando…' : 'Simular no Histórico (ROI)'}
                </button>
              </div>
            </div>

            {isSimulando && (
              <div className="history-skeleton" style={{ margin: '16px 0' }} aria-busy="true">
                <span style={{ height: 60 }} />
              </div>
            )}

            {simularError && <div className="error" role="alert">{simularError}</div>}

            {simularResult && (
              <div className="paper-card" style={{ background: 'var(--paper)', margin: '20px 0', border: '1px solid var(--line)' }}>
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">Simulação Histórica Completa</span>
                    <h3>Retorno Sobre Investimento (ROI)</h3>
                  </div>
                  <span className="status">{simularResult.data.totalConcursos} concursos analisados</span>
                </div>
                <div className="stat-grid" style={{ marginBottom: 16 }}>
                  <div className="stat">
                    <span>Custo total</span>
                    <b>{formatMoney(simularResult.data.custoTotalCents)}</b>
                  </div>
                  <div className="stat">
                    <span>Prêmio total estimado</span>
                    <b>{formatMoney(simularResult.data.premioTotalCents)}</b>
                  </div>
                  <div className="stat">
                    <span>ROI</span>
                    <b style={{ color: simularResult.data.roi >= 0 ? 'var(--seal)' : 'var(--strike)' }}>
                      {simularResult.data.roiPercentual}
                    </b>
                  </div>
                </div>
                <div className="stat-grid">
                  <div className="stat">
                    <span>Saldo líquido</span>
                    <b style={{ color: simularResult.data.saldoLiquidoCents >= 0 ? 'var(--seal)' : 'var(--strike)' }}>
                      {formatMoney(simularResult.data.saldoLiquidoCents)}
                    </b>
                  </div>
                  <div className="stat">
                    <span>Maior acerto</span>
                    <b>{simularResult.data.maiorAcerto} dezenas</b>
                  </div>
                  <div className="stat">
                    <span>Média de acertos</span>
                    <b>{simularResult.data.mediaAcertos} / cartão</b>
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <small style={{ color: 'var(--graphite-2)' }}>
                    Acertos por faixa: 11 pts: {simularResult.data.acertosPorFaixa['11'] ?? 0}x · 12 pts: {simularResult.data.acertosPorFaixa['12'] ?? 0}x · 13 pts: {simularResult.data.acertosPorFaixa['13'] ?? 0}x · 14 pts: {simularResult.data.acertosPorFaixa['14'] ?? 0}x · 15 pts: {simularResult.data.acertosPorFaixa['15'] ?? 0}x
                  </small>
                </div>
              </div>
            )}

            <div className="result-list">
              {payload.analysis.data.map((entry, index) => (
                <div className="game-row" key={`${index}-${entry.game.join('-')}`}>
                  <span className="game-index">{String(index + 1).padStart(2, '0')}</span>
                  <div className="mini-grid">
                    {entry.game.map((number) => (
                      <span className="mini-number" key={number}>
                        {String(number).padStart(2, '0')}
                      </span>
                    ))}
                  </div>
                  <span className="status">soma {entry.metrics.sum}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="disclaimer">
            <p>{payload.batch.disclaimer}</p>
          </div>
        </>
      ) : (
        <div className="empty">
          <div>
            <strong>Nenhum lote validado.</strong>
            <p>Use o gerador para iniciar o fluxo.</p>
          </div>
        </div>
      )}
    </PageShell>
  );
}

export function HelpPage() { return <PageShell eyebrow="Ajuda" title="Como usar o Lotzy." intro="O app organiza combinações da Lotofácil com transparência. Ele não registra apostas, não prevê sorteios e não oferece garantia de acerto."><div className="page-grid"><article className="paper-card"><span className="eyebrow">Gerar</span><h2>Gere um lote</h2><p>Escolha a quantidade e o número de dezenas por jogo. Para controlar dezenas fixas, excluídas ou a faixa de soma, abra <strong>Filtros</strong>.</p></article><article className="paper-card"><span className="eyebrow">Validar</span><h2>Validação automática</h2><p>Todo lote gerado é validado automaticamente antes de aparecer na análise. As métricas descrevem as combinações e não alteram suas probabilidades.</p></article><article className="paper-card"><span className="eyebrow">Analisar</span><h2>Interprete métricas</h2><p>Veja soma média, dispersão, popularidade e diversidade. Essas medidas descrevem o lote; não alteram as probabilidades do sorteio.</p></article><article className="paper-card"><span className="eyebrow">Responsabilidade</span><h2>Use com limite</h2><p>Os jogos precisam ser registrados nos canais oficiais para terem validade. Aposte apenas o que puder perder.</p></article></div></PageShell>; }

export function PageShell({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: React.ReactNode }) { return <main className="main"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{intro}</p><div style={{marginTop:30}}>{children}</div></main>; }
