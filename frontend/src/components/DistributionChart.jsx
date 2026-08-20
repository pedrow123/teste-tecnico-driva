const STATUS_COLORS = {
  CONCLUIDO: "var(--color-success)",
  FALHOU: "var(--color-error)",
  EM_PROCESSAMENTO: "var(--color-warning)",
  CANCELADO: "var(--color-muted-status)",
};

const SIZE_LABELS = {
  PEQUENO: "Pequeno",
  MEDIO: "Médio",
  GRANDE: "Grande",
  MUITO_GRANDE: "Muito grande",
};

export default function DistributionChart({ title, data, variant }) {
  const entries = Object.entries(data || {});
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="chart-card">
      <h3 className="chart-card__title">{title}</h3>

      {entries.length === 0 ? (
        <p className="empty-state">Sem dados na camada Gold ainda.</p>
      ) : (
        <div className="bar-list">
          {entries.map(([key, value]) => {
            const pct = total ? ((value / total) * 100).toFixed(1) : 0;
            const widthPct = (value / max) * 100;
            const label = variant === "status" ? key.replaceAll("_", " ") : SIZE_LABELS[key] || key;
            const color =
              variant === "status" ? STATUS_COLORS[key] || "var(--color-accent)" : "var(--color-accent)";

            return (
              <div className="bar-row" key={key}>
                <span className="bar-row__label">{label}</span>
                <div className="bar-row__track">
                  <div
                    className="bar-row__fill"
                    style={{ width: `${widthPct}%`, background: color }}
                  />
                </div>
                <span className="bar-row__value">
                  {value} <span className="bar-row__pct">({pct}%)</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
