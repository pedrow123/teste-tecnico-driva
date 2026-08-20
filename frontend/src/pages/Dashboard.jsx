import { useCallback, useEffect, useState } from "react";
import { getOverview, getEnrichments } from "../api/client.js";
import Header from "../components/Header.jsx";
import KpiCards from "../components/KpiCards.jsx";
import DistributionChart from "../components/DistributionChart.jsx";
import EnrichmentsTable from "../components/EnrichmentsTable.jsx";

const POLL_INTERVAL_MS = 30_000;

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [filters, setFilters] = useState({ page: 1, status: "", idWorkspace: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadAll = useCallback(async (currentFilters) => {
    setLoading(true);
    setError(null);
    try {
      const [overviewData, enrichmentsData] = await Promise.all([
        getOverview(),
        getEnrichments({
          page: currentFilters.page,
          limit: 10,
          status: currentFilters.status,
          idWorkspace: currentFilters.idWorkspace,
        }),
      ]);
      setOverview(overviewData);
      setRows(enrichmentsData.data);
      setMeta(enrichmentsData.meta);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll(filters);
  }, [filters, loadAll]);

  useEffect(() => {
    const interval = setInterval(() => loadAll(filters), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [filters, loadAll]);

  function handleFiltersChange(next) {
    setFilters({ ...next, page: 1 });
  }

  function handlePageChange(page) {
    setFilters((prev) => ({ ...prev, page }));
  }

  return (
    <div className="page">
      <Header
        lastUpdated={lastUpdated}
        onRefresh={() => loadAll(filters)}
        loading={loading}
      />

      {error && (
        <div className="banner banner--error">
          Não foi possível carregar os dados: {error}. Confira se a API está no ar.
        </div>
      )}

      {!error && !overview && loading && (
        <div className="banner">Carregando métricas…</div>
      )}

      <KpiCards overview={overview} />

      <section className="chart-grid">
        <DistributionChart
          title="Por status de processamento"
          data={overview?.distribuicao_por_status}
          variant="status"
        />
        <DistributionChart
          title="Por categoria de tamanho"
          data={overview?.distribuicao_por_categoria_tamanho}
          variant="categoria"
        />
      </section>

      <EnrichmentsTable
        rows={rows}
        meta={meta}
        loading={loading}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
