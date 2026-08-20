const STATUS_STYLES = {
  CONCLUIDO: { color: "var(--color-success)", bg: "var(--color-success-soft)" },
  FALHOU: { color: "var(--color-error)", bg: "var(--color-error-soft)" },
  EM_PROCESSAMENTO: { color: "var(--color-warning)", bg: "var(--color-warning-soft)" },
  CANCELADO: { color: "var(--color-muted-status)", bg: "var(--color-muted-status-soft)" },
};

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.CANCELADO;
  return (
    <span
      className="status-badge"
      style={{ color: style.color, background: style.bg }}
    >
      {status?.replaceAll("_", " ") || "—"}
    </span>
  );
}
