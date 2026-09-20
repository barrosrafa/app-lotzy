'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateRandom, validateAndAnalyzeBatch, type GeneratedResponse, formatMoney, useLatestConcurso } from '@/lib/api';
import { PlayslipGrid } from '@/components/PlayslipGrid';

function GameRow({ game, index }: { game: number[]; index: number }) {
  return (
    <div className="game-row">
      <span className="game-index">{String(index + 1).padStart(2, '0')}</span>
      <div className="mini-grid">
        {game.map(number => (
          <span className="mini-number" key={number}>
            {String(number).padStart(2, '0')}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { latest, isLoading: isLatestLoading } = useLatestConcurso();
  const [quantity, setQuantity] = useState(5);
  const [numbersPerGame, setNumbersPerGame] = useState(15);
  const [result, setResult] = useState<GeneratedResponse>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError('');
    try {
      const generated = await generateRandom(quantity, numbersPerGame);
      const validated = await validateAndAnalyzeBatch(generated);
      sessionStorage.setItem('lotzy:validated-games', JSON.stringify(validated));
      setResult(generated);
      router.push('/analisar');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível gerar os jogos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="main">
      <div className="intro">
        <div>
          <span className="eyebrow">Geração responsável · Lotofácil</span>
          <h1>Marque o papel. Entenda o jogo.</h1>
          <p>Gere combinações uniformes e revise cada lote antes de exibi-lo. O Lotzy organiza escolhas; não prevê sorteios.</p>
        </div>
        <div className="hero-card">
          <span className="eyebrow" style={{ color: '#8bb9f5' }}>Último Concurso Registrado</span>
          {isLatestLoading ? (
            <div className="skeleton" style={{ height: 48, margin: '12px 0' }} />
          ) : latest ? (
            <div>
              <div className="metric">
                #{latest.concurso.concurso} <small>{latest.concurso.data}</small>
              </div>
              <div className="drawn-numbers" style={{ marginTop: 8 }}>
                {latest.concurso.dezenas.map(num => (
                  <span key={num} style={{ background: '#2f343b', color: '#fff' }}>
                    {String(num).padStart(2, '0')}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="metric">01 <small>gerar</small></div>
          )}
          <p style={{ margin: 0, fontSize: 13 }}>
            Após gerar, o lote é validado pela API e encaminhado para a análise.
          </p>
        </div>
      </div>

      <div className="paper-card">
        <div className="controls">
          <label>
            Quantidade
            <input
              type="number"
              min={1}
              max={500}
              value={quantity}
              onChange={e => setQuantity(Math.min(500, Math.max(1, Number(e.target.value))))}
            />
          </label>
          <label>
            Dezenas por jogo
            <select value={numbersPerGame} onChange={e => setNumbersPerGame(Number(e.target.value))}>
              {[15, 16, 17, 18, 19, 20].map(n => (
                <option key={n} value={n}>{n} dezenas</option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary" onClick={submit} disabled={loading} aria-busy={loading}>
            {loading ? 'Gerando…' : 'Gerar jogos'}
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => router.push('/filtros')}>
            Usar filtros
          </button>
        </div>

        {error && <div className="error" role="alert">{error}</div>}

        <div className="disclaimer">
          <p><strong>Antes de gerar:</strong> cada combinação tem a mesma probabilidade. Evitar padrões populares pode afetar rateio, mas não aumenta a chance de acerto.</p>
        </div>
      </div>

      <section className="grid-layout" style={{ marginTop: 24 }}>
        <PlayslipGrid />
        <div className="paper-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Prévia</span>
              <h2>O resultado aparece após analisar</h2>
            </div>
            {result && <span className="status">{result.meta.generatedQuantity} jogos</span>}
          </div>

          {loading ? (
            <div className="history-skeleton" aria-label="Gerando jogos" aria-busy="true">
              {Array.from({ length: Math.min(quantity, 5) }, (_, i) => (
                <span key={i} />
              ))}
            </div>
          ) : result ? (
            <>
              <div className="stat-grid" style={{ marginBottom: 16 }}>
                <div className="stat">
                  <span>Custo do lote</span>
                  <b>{formatMoney(result.cost.totalCents * result.meta.generatedQuantity)}</b>
                </div>
                <div className="stat">
                  <span>Apostas simples</span>
                  <b>{result.cost.simpleBets * result.meta.generatedQuantity}</b>
                </div>
                <div className="stat">
                  <span>Dezenas</span>
                  <b>{result.meta.numbersPerGame}</b>
                </div>
              </div>
              <div className="result-list">
                {result.data.map((entry: { game: number[] }, index: number) => (
                  <GameRow key={`${index}-${entry.game.join('-')}`} game={entry.game} index={index} />
                ))}
              </div>
            </>
          ) : (
            <div className="empty">
              <div>
                <strong>O resultado é o herói desta tela.</strong>
                <p>Escolha o tamanho do lote ou abra os filtros para começar.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

