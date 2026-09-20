'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getHistory, type HistoryQuery, type HistoryResponse } from '@/lib/api';

const emptyQuery: HistoryQuery = { dataInicio: '', dataFim: '', concurso: '', page: 1, limit: 50, order: 'desc' };

function queryFromParams(params: URLSearchParams): HistoryQuery {
  return {
    dataInicio: params.get('dataInicio') ?? '',
    dataFim: params.get('dataFim') ?? '',
    concurso: params.get('concurso') ?? '',
    page: Math.max(1, Number(params.get('page') ?? '1') || 1),
    limit: 50,
    order: params.get('order') === 'asc' ? 'asc' : 'desc',
  };
}

function formatNumber(number: number): string { return String(number).padStart(2, '0'); }
function formatDate(value: string): string { const [year, month, day] = value.split('-'); return `${day}/${month}/${year}`; }

function pageWindow(current: number, total: number): number[] {
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, Math.max(5, current + 2));
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
}

export default function HistoryClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<HistoryQuery>(() => queryFromParams(searchParams));
  const [result, setResult] = useState<HistoryResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const dateError = useMemo(() => filters.dataInicio && filters.dataFim && filters.dataInicio > filters.dataFim ? 'A data inicial deve ser anterior ou igual à data final.' : '', [filters.dataInicio, filters.dataFim]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (dateError) { setLoading(false); setError(dateError); return; }
      const params = new URLSearchParams();
      for (const key of ['dataInicio', 'dataFim', 'concurso'] as const) if (filters[key]) params.set(key, filters[key] as string);
      if ((filters.page ?? 1) > 1) params.set('page', String(filters.page));
      if (filters.order === 'asc') params.set('order', 'asc');
      router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
      setLoading(true);
      setError('');
      getHistory(filters).then(setResult).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o histórico.')).finally(() => setLoading(false));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [dateError, filters, pathname, router]);

  function updateFilter(key: 'dataInicio' | 'dataFim' | 'concurso', value: string) {
    setFilters((current) => ({ ...current, [key]: key === 'concurso' ? value.replace(/\D/g, '') : value, page: 1 }));
  }

  function clearFilters() { setFilters(emptyQuery); }
  const totalPages = result?.totalPages ?? 0;
  const pages = pageWindow(filters.page ?? 1, totalPages);

  return <main className="main history-page">
    <div className="history-heading">
      <div>
        <span className="eyebrow">Arquivo · Lotofácil</span>
        <h1>Histórico de resultados.</h1>
        <p>Consulte os concursos já registrados, com filtros simples e uma leitura limpa do resultado oficial.</p>
      </div>
      <div className="history-count" aria-live="polite"><strong>{result?.total.toLocaleString('pt-BR') ?? '—'}</strong><span>concursos encontrados</span></div>
    </div>

    <section className="paper-card history-filters" aria-labelledby="history-filter-title">
      <div className="section-heading"><div><span className="eyebrow">Refinar consulta</span><h2 id="history-filter-title">Encontre um concurso</h2></div><button className="btn btn-secondary" type="button" onClick={clearFilters}>Limpar filtros</button></div>
      <div className="controls history-controls">
        <label>Data inicial<input type="date" value={filters.dataInicio} onChange={(event) => updateFilter('dataInicio', event.target.value)} /></label>
        <label>Data final<input type="date" value={filters.dataFim} onChange={(event) => updateFilter('dataFim', event.target.value)} /></label>
        <label>Concurso<input inputMode="numeric" pattern="[0-9]*" placeholder="Ex.: 3782" value={filters.concurso} onChange={(event) => updateFilter('concurso', event.target.value)} /></label>
        <label>Ordem<select value={filters.order} onChange={(event) => setFilters((current) => ({ ...current, order: event.target.value as 'asc' | 'desc', page: 1 }))}><option value="desc">Mais recentes</option><option value="asc">Mais antigos</option></select></label>
      </div>
      {dateError && <p className="field-error" role="alert">{dateError}</p>}
    </section>

    <section className="paper-card history-results" aria-labelledby="history-results-title">
      <div className="section-heading"><div><span className="eyebrow">Resultados</span><h2 id="history-results-title">Concursos registrados</h2></div>{result && <span className="status">Página {result.page} de {Math.max(result.totalPages, 1)}</span>}</div>
      {loading ? <div className="history-skeleton" aria-label="Carregando resultados" aria-busy="true">{Array.from({ length: 5 }, (_, index) => <span key={index} />)}</div> : error ? <div className="empty history-message"><strong>Não foi possível carregar os resultados.</strong><p>{error}</p><button className="btn btn-secondary" type="button" onClick={() => setFilters((current) => ({ ...current }))}>Tentar novamente</button></div> : !result?.data.length ? <div className="empty history-message"><strong>Nenhum resultado encontrado para os filtros aplicados.</strong><p>Altere o intervalo ou limpe os filtros para consultar novamente.</p></div> : <>
        <div className="history-table-wrap"><table className="history-table"><caption className="sr-only">Histórico de resultados da Lotofácil</caption><thead><tr><th scope="col">Concurso</th><th scope="col">Data</th><th scope="col">Dezenas sorteadas</th><th scope="col">Acumulado</th></tr></thead><tbody>{result.data.map((item) => <tr key={item.concurso}><th scope="row">{item.concurso}</th><td>{formatDate(item.data)}</td><td><div className="drawn-numbers" aria-label={`Dezenas do concurso ${item.concurso}`}>{item.dezenas.map((number) => <span key={number}>{formatNumber(number)}</span>)}</div></td><td><span className={`accumulated ${item.acumulado ? 'is-yes' : 'is-no'}`}>{item.acumulado ? 'Sim' : 'Não'}</span></td></tr>)}</tbody></table></div>
        <div className="history-pagination"><span className="history-total">Mostrando {result.data.length} de {result.total.toLocaleString('pt-BR')}</span><nav aria-label="Paginação do histórico"><button className="pagination-button" type="button" disabled={(filters.page ?? 1) <= 1} onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, (current.page ?? 1) - 1) }))} aria-label="Página anterior">←</button>{pages.map((page) => <button className={`pagination-button ${page === filters.page ? 'is-current' : ''}`} type="button" key={page} aria-current={page === filters.page ? 'page' : undefined} onClick={() => setFilters((current) => ({ ...current, page }))}>{page}</button>)}<button className="pagination-button" type="button" disabled={(filters.page ?? 1) >= totalPages} onClick={() => setFilters((current) => ({ ...current, page: Math.min(totalPages, (current.page ?? 1) + 1) }))} aria-label="Próxima página">→</button></nav></div>
      </>}
    </section>
  </main>;
}
