import math
from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.core import get_cursor, verify_api_key

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
    dependencies=[Depends(verify_api_key)],
)


@router.get("/overview")
def overview():
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                COUNT(*) AS total_jobs,
                COALESCE(AVG(duracao_processamento_minutos), 0) AS tempo_medio_minutos,
                COALESCE(
                    100.0 * SUM(CASE WHEN processamento_sucesso THEN 1 ELSE 0 END)
                    / NULLIF(COUNT(*), 0),
                    0
                ) AS percentual_sucesso
            FROM gold_enrichments;
            """
        )
        totals = cur.fetchone()

        cur.execute(
            """
            SELECT categoria_tamanho_job, COUNT(*) AS total
            FROM gold_enrichments
            GROUP BY categoria_tamanho_job;
            """
        )
        por_categoria = cur.fetchall()

        cur.execute(
            """
            SELECT status_processamento, COUNT(*) AS total
            FROM gold_enrichments
            GROUP BY status_processamento;
            """
        )
        por_status = cur.fetchall()

    return {
        "total_jobs": totals["total_jobs"],
        "percentual_sucesso": round(float(totals["percentual_sucesso"]), 2),
        "tempo_medio_processamento_minutos": round(float(totals["tempo_medio_minutos"]), 2),
        "distribuicao_por_categoria_tamanho": {
            row["categoria_tamanho_job"] or "DESCONHECIDO": row["total"] for row in por_categoria
        },
        "distribuicao_por_status": {
            row["status_processamento"] or "DESCONHECIDO": row["total"] for row in por_status
        },
    }


@router.get("/enrichments")
def list_enrichments(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    id_workspace: Optional[str] = Query(default=None),
    status_processamento: Optional[str] = Query(default=None),
    data_inicio: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    data_fim: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
):
    filtros = []
    valores = []

    if id_workspace:
        filtros.append("id_workspace = %s")
        valores.append(id_workspace)

    if status_processamento:
        filtros.append("status_processamento = %s")
        valores.append(status_processamento)

    if data_inicio:
        filtros.append("data_criacao >= %s")
        valores.append(data_inicio)

    if data_fim:
        filtros.append("data_criacao <= %s")
        valores.append(data_fim)

    where_clause = f"WHERE {' AND '.join(filtros)}" if filtros else ""
    offset = (page - 1) * limit

    with get_cursor() as cur:
        cur.execute(f"SELECT COUNT(*) AS total FROM gold_enrichments {where_clause};", valores)
        total_items = cur.fetchone()["total"]

        cur.execute(
            f"""
            SELECT *
            FROM gold_enrichments
            {where_clause}
            ORDER BY data_atualizacao_dw DESC
            LIMIT %s OFFSET %s;
            """,
            valores + [limit, offset],
        )
        rows = cur.fetchall()

    total_pages = math.ceil(total_items / limit) if total_items else 0

    return {
        "meta": {
            "current_page": page,
            "items_per_page": limit,
            "total_items": total_items,
            "total_pages": total_pages,
        },
        "data": rows,
    }


@router.get("/pipeline-status")
def pipeline_status():
    """
    Retorna a execução mais recente de cada etapa do pipeline
    (INGESTAO, PROCESSAMENTO, ORQUESTRADOR), para o dashboard mostrar
    se o ciclo automático está rodando.
    """
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT ON (etapa)
                etapa, status, qtd_registros, mensagem_erro,
                iniciado_em, finalizado_em
            FROM dw_pipeline_runs
            ORDER BY etapa, iniciado_em DESC;
            """
        )
        rows = cur.fetchall()

    return {"data": rows}


@router.get("/workspaces/top")
def top_workspaces(limit: int = Query(default=10, ge=1, le=100)):
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                id_workspace,
                nome_workspace,
                COUNT(*) AS total_enriquecimentos,
                SUM(total_contatos) AS total_contatos_acumulado
            FROM gold_enrichments
            GROUP BY id_workspace, nome_workspace
            ORDER BY total_enriquecimentos DESC
            LIMIT %s;
            """,
            (limit,),
        )
        rows = cur.fetchall()

    return {"data": rows}