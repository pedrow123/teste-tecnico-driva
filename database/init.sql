-- =====================================================================
-- init.sql
-- Cria automaticamente as tabelas necessárias quando o Postgres sobe
-- pela primeira vez (montado via volume no docker-compose.yml).
-- =====================================================================

-- Extensão usada para gerar UUIDs (id de execuções, etc.)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 1) TABELA DE SEED (fonte simulada da API de enriquecimentos)
--    Usada pelo endpoint GET /people/v1/enrichments para servir
--    dados determinísticos e paginados.
-- =====================================================================
CREATE TABLE IF NOT EXISTS api_enrichments_seed (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_workspace    UUID NOT NULL,
    workspace_name  TEXT NOT NULL,
    total_contacts  INTEGER NOT NULL,
    contact_type    TEXT NOT NULL CHECK (contact_type IN ('PERSON', 'COMPANY')),
    status          TEXT NOT NULL CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED', 'CANCELED')),
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_seed_created_at ON api_enrichments_seed (created_at);
CREATE INDEX IF NOT EXISTS idx_seed_workspace   ON api_enrichments_seed (id_workspace);

-- =====================================================================
-- 2) CAMADA BRONZE
--    Captura fiel do que a API de origem retorna. Tipos flexíveis
--    para não falhar por incompatibilidade de schema.
-- =====================================================================
CREATE TABLE IF NOT EXISTS bronze_enrichments (
    id_enriquecimento  UUID PRIMARY KEY,
    id_workspace        TEXT,
    workspace_name       TEXT,
    total_contacts        INTEGER,
    contact_type           TEXT,
    status                  TEXT,
    created_at               TIMESTAMPTZ,
    updated_at                TIMESTAMPTZ,
    raw_payload                JSONB,       -- payload bruto completo, para rastreabilidade

    -- Campos obrigatórios de controle do DW
    dw_ingested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    dw_updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bronze_status       ON bronze_enrichments (status);
CREATE INDEX IF NOT EXISTS idx_bronze_workspace     ON bronze_enrichments (id_workspace);
CREATE INDEX IF NOT EXISTS idx_bronze_dw_updated_at ON bronze_enrichments (dw_updated_at);

-- =====================================================================
-- 3) CAMADA GOLD
--    Colunas e valores em português + campos calculados.
-- =====================================================================
CREATE TABLE IF NOT EXISTS gold_enrichments (
    id_enriquecimento          UUID PRIMARY KEY,
    id_workspace                 TEXT NOT NULL,
    nome_workspace                 TEXT,
    total_contatos                    INTEGER,
    tipo_contato                        TEXT CHECK (tipo_contato IN ('PESSOA', 'EMPRESA')),
    status_processamento                  TEXT CHECK (status_processamento IN
                                             ('EM_PROCESSAMENTO', 'CONCLUIDO', 'FALHOU', 'CANCELADO')),
    data_criacao                            TIMESTAMPTZ,
    data_atualizacao                          TIMESTAMPTZ,

    -- Campos calculados
    duracao_processamento_minutos  NUMERIC,
    tempo_por_contato_minutos       NUMERIC,
    processamento_sucesso            BOOLEAN,
    categoria_tamanho_job              TEXT CHECK (categoria_tamanho_job IN
                                         ('PEQUENO', 'MEDIO', 'GRANDE', 'MUITO_GRANDE')),
    necessita_reprocessamento           BOOLEAN,

    -- Snapshot da execução que gerou/atualizou este registro
    data_atualizacao_dw    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gold_status     ON gold_enrichments (status_processamento);
CREATE INDEX IF NOT EXISTS idx_gold_workspace  ON gold_enrichments (id_workspace);
CREATE INDEX IF NOT EXISTS idx_gold_categoria  ON gold_enrichments (categoria_tamanho_job);
CREATE INDEX IF NOT EXISTS idx_gold_data_criacao ON gold_enrichments (data_criacao);

-- =====================================================================
-- 4) TABELA AUXILIAR DE CONTROLE / OBSERVABILIDADE DO PIPELINE
--    Guarda logs de cada execução (ingestão, processamento, orquestração)
--    e pode ser usada como watermark (última página/execução).
-- =====================================================================
CREATE TABLE IF NOT EXISTS dw_pipeline_runs (
    id_execucao       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    etapa             TEXT NOT NULL,             -- 'INGESTAO' | 'PROCESSAMENTO' | 'ORQUESTRADOR'
    status            TEXT NOT NULL,             -- 'SUCESSO' | 'ERRO' | 'EM_ANDAMENTO'
    qtd_registros     INTEGER DEFAULT 0,
    ultima_pagina     INTEGER,                   -- watermark de paginação, se aplicável
    mensagem_erro     TEXT,
    iniciado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    finalizado_em     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_etapa ON dw_pipeline_runs (etapa);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_iniciado_em ON dw_pipeline_runs (iniciado_em);
