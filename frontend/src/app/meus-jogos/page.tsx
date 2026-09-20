'use client';

import { useEffect, useState } from 'react';
import { PageShell } from '@/app/aux-pages';
import { getSavedGamesFromLocalStorage, saveValidatedGamesToLocalStorage } from '@/lib/localGames';

export default function MyGamesPage() {
  const [games, setGames] = useState<number[][]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setGames(getSavedGamesFromLocalStorage());
  }, []);

  function save() {
    try {
      const savedCount = saveValidatedGamesToLocalStorage();
      setGames(getSavedGamesFromLocalStorage());
      setMessage(`${savedCount} ${savedCount === 1 ? 'jogo salvo' : 'jogos salvos'} localmente.`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Não foi possível salvar o lote.');
    }
  }

  function clear() {
    setGames([]);
    setMessage('');
    localStorage.removeItem('lotzy:meus-jogos');
  }

  return (
    <PageShell
      eyebrow="07 · Meus Jogos"
      title="Seus jogos, no seu dispositivo."
      intro="Este recurso usa apenas localStorage. Não há conta, sincronização ou envio para o servidor."
    >
      <div className="controls">
        <button className="btn btn-primary" onClick={save}>Salvar lote atual</button>
        <button className="btn btn-danger" onClick={clear}>Apagar deste dispositivo</button>
      </div>
      {message && <div className="disclaimer" role="status"><p>{message}</p></div>}
      <div className="paper-card">
        <div className="result-list">
          {games.length ? games.map((game, index) => (
            <div className="game-row" key={`${index}-${game.join('-')}`}>
              <span className="game-index">{index + 1}</span>
              <span style={{ flex: 1 }}>{game.join(' · ')}</span>
            </div>
          )) : (
            <div className="empty">
              <strong>Nenhum jogo salvo.</strong>
              <p>Salve um lote analisado para encontrá-lo aqui.</p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
