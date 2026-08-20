function formatNumber(n) {
  return new Intl.NumberFormat("pt-BR").format(n ?? 0);
}

function Card({ eyebrow, value, unit, fillPercent }) {
  return (
    <div className="kpi-card">
      <span className="kpi-card__eyebrow">{eyebrow}</span>
      <div className="kpi-card__value">
        <span className="kpi-card__number">{value}</span>
        {unit && <span className="kpi-card__unit">{unit}</span>}
      </div>
      {typeof fillPercent === "number" && (
        <div className="kpi-card__gauge">
          <div
            className="kpi-card__gauge-fill"
            style={{ width: `${Math.min(100, Math.max(0, fillPercent))}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function KpiCards({ overview }) {
  if (!overview) return null;

  const {
    total_jobs,
    percentual_sucesso,
    tempo_medio_processamento_minutos,
    distribuicao_por_categoria_tamanho,
  } = overview;

  const totalGrande =
    (distribuicao_por_categoria_tamanho?.GRANDE || 0) +
    (distribuicao_por_categoria_tamanho?.MUITO_GRANDE || 0);

  return (
    <section className="kpi-grid">
      <Card eyebrow="Total de enriquecimentos" value={formatNumber(total_jobs)} />
      <Card
        eyebrow="Taxa de sucesso"
        value={percentual_sucesso?.toFixed(1)}
        unit="%"
        fillPercent={percentual_sucesso}
      />
      <Card
        eyebrow="Tempo médio de processamento"
        value={tempo_medio_processamento_minutos?.toFixed(1)}
        unit="min"
      />
      <Card eyebrow="Jobs grandes ou maiores" value={formatNumber(totalGrande)} />
    </section>
  );
}
