import { useState } from "react";
import StatusBadge from "./StatusBadge.jsx";

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "CONCLUIDO", label: "Concluído" },
  { value: "FALHOU", label: "Falhou" },
  { value: "EM_PROCESSAMENTO", label: "Em processamento" },
  { value: "CANCELADO", label: "Cancelado" },
];

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EnrichmentsTable({
  rows,
  meta,
  loading,
  filters,
  onFiltersChange,
  onPageChange,
}) {
  const [workspaceInput, setWorkspaceInput] = useState(filters.idWorkspace);

  function handleWorkspaceSubmit(e) {
    e.preventDefault();
    onFiltersChange({ ...filters, idWorkspace: workspaceInput.trim() });
  }

  return (
    <section className="table-card">
      <div className="table-card__header">
        <h3 className="chart-card__title">Enriquecimentos</h3>

        <div className="table-card__filters">
          <form onSubmit={handleWorkspaceSubmit} className="filter-search">
            <input
              type="text"
              placeholder="Filtrar por id_workspace"
              value={workspaceInput}
              onChange={(e) => setWorkspaceInput(e.target.value)}
            />
            <button type="submit" className="btn btn--ghost btn--small">
              Buscar
            </button>
          </form>

          <select
            value={filters.status}
            onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Workspace</th>
              <th>Tipo</th>
              <th>Contatos</th>
              <th>Status</th>
              <th>Duração</th>
              <th>Categoria</th>
              <th>Criado em</th>
              <th>Atualizado no DW</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-state">
                  Nenhum enriquecimento encontrado com esses filtros.
                </td>
              </tr>
            )}

            {rows.map((row) => (
              <tr key={row.id_enriquecimento}>
                <td>{row.nome_workspace}</td>
                <td className="mono">{row.tipo_contato}</td>
                <td className="mono">{row.total_contatos}</td>
                <td>
                  <StatusBadge status={row.status_processamento} />
                </td>
                <td className="mono">
                  {row.duracao_processamento_minutos != null
                    ? `${Number(row.duracao_processamento_minutos).toFixed(1)} min`
                    : "—"}
                </td>
                <td>{row.categoria_tamanho_job}</td>
                <td className="mono">{formatDate(row.data_criacao)}</td>
                <td className="mono">{formatDate(row.data_atualizacao_dw)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-card__pagination">
        <span className="pagination__info">
          {meta?.total_items ? (
            <>
              Página {meta.current_page} de {meta.total_pages} · {meta.total_items} registros
            </>
          ) : (
            "—"
          )}
        </span>
        <div className="pagination__buttons">
          <button
            className="btn btn--ghost btn--small"
            onClick={() => onPageChange(filters.page - 1)}
            disabled={filters.page <= 1 || loading}
          >
            Anterior
          </button>
          <button
            className="btn btn--ghost btn--small"
            onClick={() => onPageChange(filters.page + 1)}
            disabled={!meta || filters.page >= meta.total_pages || loading}
          >
            Próxima
          </button>
        </div>
      </div>
    </section>
  );
}