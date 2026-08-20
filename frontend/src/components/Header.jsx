export default function Header({ lastUpdated, onRefresh, loading }) {
  return (
    <header className="header">
      <div className="header__title-group">
        <div className="header__eyebrow">
          <span className="pulse-dot" aria-hidden="true" />
          <span>Pipeline de enriquecimento</span>
        </div>
        <h1 className="header__title">Visibilidade</h1>
        <p className="header__subtitle">
          Performance e qualidade dos enriquecimentos entregues na plataforma
        </p>
      </div>

      <div className="header__actions">
        {lastUpdated && (
          <span className="header__updated">
            Atualizado {lastUpdated.toLocaleTimeString("pt-BR")}
          </span>
        )}
        <button className="btn btn--ghost" onClick={onRefresh} disabled={loading}>
          {loading ? "Atualizando…" : "Atualizar"}
        </button>
      </div>
    </header>
  );
}
