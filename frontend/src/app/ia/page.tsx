'use client';

import { useState } from 'react';
import { PageShell } from '@/app/aux-pages';
import { predictWithAi, type AiPredictionResponse } from '@/lib/api';

export default function AiPage() {
  const [quantity, setQuantity] = useState(5);
  const [numbersPerGame, setNumbersPerGame] = useState(15);
  const [result, setResult] = useState<AiPredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setLoading(true);
    setError('');
    try {
      setResult(await predictWithAi(quantity, numbersPerGame));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível gerar os palpites.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell
      eyebrow="06 · IA"
      title="Palpites inteligentes para explorar o histórico."
      intro="Um modelo TensorFlow.js analisa a sequência histórica e monta combinações para você revisar. É um diferencial de experiência e marketing, não uma previsão garantida do próximo sorteio."
    >
      <div className="paper-card">
        <div className="controls">
          <label>Quantidade<select value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>{[3, 5, 10, 15, 20].map((value) => <option key={value} value={value}>{value} palpites</option>)}</select></label>
          <label>Dezenas por jogo<select value={numbersPerGame} onChange={(e) => setNumbersPerGame(Number(e.target.value))}>{[15, 16, 17, 18, 19, 20].map((value) => <option key={value} value={value}>{value} dezenas</option>)}</select></label>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>{loading ? 'Treinando…' : 'Gerar palpites IA'}</button>
        </div>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="disclaimer"><p><strong>Como interpretar:</strong> o modelo aprende correlações de concursos anteriores, mas não acessa o futuro. Cada combinação continua tendo a mesma probabilidade matemática.</p></div>
      </div>
      {result && <section className="paper-card" style={{ marginTop: 24 }}>
        <div className="section-heading"><div><span className="eyebrow">Resultado</span><h2>Palpites gerados</h2></div><span className="status">{result.data.length} jogos</span></div>
        <div className="stat-grid"><div className="stat"><span>Modelo</span><b>{result.meta.model}</b></div><div className="stat"><span>Treino</span><b>{result.meta.trainingDraws} concursos</b></div><div className="stat"><span>Fonte</span><b>{result.meta.caixaComplemented ? 'Histórico + Caixa' : 'Histórico local'}</b></div></div>
        <div className="result-list" style={{ marginTop: 18 }}>{result.data.map((entry, index) => <div className="game-row" key={`${index}-${entry.game.join('-')}`}><span className="game-index">{String(index + 1).padStart(2, '0')}</span><div className="mini-grid">{entry.game.map((number) => <span className="mini-number" key={number}>{String(number).padStart(2, '0')}</span>)}</div><span className="status">score {entry.score.toFixed(2)}</span></div>)}</div>
        <div className="disclaimer"><p>{result.disclaimer}</p></div>
      </section>}
    </PageShell>
  );
}
