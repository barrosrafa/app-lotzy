'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  generateFiltered,
  validateGame,
  validateAndAnalyzeBatch,
  useDesdobrar,
} from '@/lib/api';
import { PageShell } from '@/app/aux-pages';

export default function AssemblePage() {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [validation, setValidation] = useState<unknown>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { desdobrar, data: desdobrarResult, isLoading: isDesdobrando } = useDesdobrar();

  const toggle = (number: number) =>
    setSelected(
      selected.includes(number)
        ? selected.filter((n) => n !== number)
        : selected.length < 20
          ? [...selected, number].sort((a, b) => a - b)
          : selected,
    );

  async function validate() {
    if (selected.length < 15) {
      setError('Selecione de 15 a 20 dezenas para validar.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await validateGame(selected);
      setValidation(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao validar combinação.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDesdobrar() {
    if (selected.length < 16) {
      setError('Para desdobrar, selecione pelo menos 16 dezenas (até 20).');
      return;
    }
    setError('');
    try {
      await desdobrar({ dezenas: selected, regras: { targetSize: 15 } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível desdobrar as dezenas.');
    }
  }

  async function generate() {
    if (selected.length < 15) {
      setError('Selecione pelo menos 15 dezenas.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const response = await generateFiltered({
        quantity: 5,
        numbersPerGame: 15,
        fixedNumbers: selected.slice(0, 10),
        excludedNumbers: [],
        filters: {},
      });
      const validated = await validateAndAnalyzeBatch(response);
      sessionStorage.setItem('lotzy:validated-games', JSON.stringify(validated));
      router.push('/analisar');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível gerar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell
      eyebrow="06 · Montar"
      title="Monte no volante, com contexto."
      intro="A montagem registra a sua seleção visual. Todas as métricas, validações e desdobramentos são processados remotamente pelo servidor."
    >
      <div className="paper-card">
        <div className="number-grid" role="grid" aria-label="Volante de seleção de 1 a 25">
          {Array.from({ length: 25 }, (_, i) => i + 1).map((n) => (
            <button
              className={`number ${selected.includes(n) ? 'selected' : ''}`}
              aria-pressed={selected.includes(n)}
              key={n}
              onClick={() => toggle(n)}
            >
              {String(n).padStart(2, '0')}
            </button>
          ))}
        </div>

        <div className="stat-grid" style={{ marginTop: 24 }}>
          <div className="stat">
            <span>Dezenas marcadas</span>
            <b>{selected.length}/20</b>
          </div>
          <div className="stat">
            <span>Status da seleção</span>
            <b>{selected.length < 15 ? 'Incompleto' : `${selected.length} dezenas`}</b>
          </div>
          <div className="stat">
            <span>Operações disponíveis</span>
            <b>{selected.length >= 16 ? 'Validar / Desdobrar' : selected.length === 15 ? 'Validar / Gerar' : 'Marque 15+'}</b>
          </div>
        </div>

        <div className="controls">
          <button className="btn btn-secondary" onClick={validate} disabled={loading || selected.length < 15} aria-busy={loading}>
            {loading ? 'Validando…' : 'Validar seleção'}
          </button>
          {selected.length >= 16 && (
            <button className="btn btn-secondary" onClick={handleDesdobrar} disabled={isDesdobrando} aria-busy={isDesdobrando}>
              {isDesdobrando ? 'Desdobrando…' : 'Desdobrar seleção'}
            </button>
          )}
          <button className="btn btn-primary" onClick={generate} disabled={loading || selected.length < 15} aria-busy={loading}>
            {loading ? 'Processando…' : 'Gerar a partir daqui'}
          </button>
        </div>

        {error && <div className="error" role="alert">{error}</div>}

        {(loading || isDesdobrando) && (
          <div className="history-skeleton" style={{ marginTop: 18 }} aria-label="Processando requisição" aria-busy="true">
            <span style={{ height: 44 }} />
            <span style={{ height: 44 }} />
          </div>
        )}

        {Boolean(validation) && (
          <div style={{ marginTop: 18 }}>
            <h3>Resultado da validação</h3>
            <pre className="code-result">{JSON.stringify(validation, null, 2)}</pre>
          </div>
        )}

        {desdobrarResult && (
          <div style={{ marginTop: 18 }}>
            <div className="section-heading">
              <div>
                <span className="eyebrow">Desdobramento</span>
                <h2>{desdobrarResult.total} cartões gerados</h2>
              </div>
            </div>
            <div className="result-list" style={{ maxHeight: 300 }}>
              {desdobrarResult.cartoes.map((cartao, idx) => (
                <div className="game-row" key={idx}>
                  <span className="game-index">{String(idx + 1).padStart(2, '0')}</span>
                  <span style={{ flex: 1 }}>{cartao.map((n) => String(n).padStart(2, '0')).join(' · ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
