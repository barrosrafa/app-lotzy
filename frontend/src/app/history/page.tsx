import { Suspense } from 'react';
import HistoryClient from './HistoryClient';

export default function HistoryPage() {
  return <Suspense fallback={<main className="main"><div className="paper-card history-loading-page">Carregando histórico…</div></main>}><HistoryClient /></Suspense>;
}
