import math
import random

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from app.core import RATE_LIMIT_CHANCE, get_cursor, verify_api_key

router = APIRouter(
    prefix="/people/v1",
    tags=["source"],
    dependencies=[Depends(verify_api_key)],
)


@router.get("/enrichments")
def list_enrichments(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
):
    # Simulação de rate limiting: às vezes a "API de origem" responde 429
    if random.random() < RATE_LIMIT_CHANCE:
        return JSONResponse(
            status_code=429,
            content={"detail": "Too Many Requests. Tente novamente em instantes."},
        )

    offset = (page - 1) * limit

    with get_cursor() as cur:
        cur.execute("SELECT COUNT(*) AS total FROM api_enrichments_seed;")
        total_items = cur.fetchone()["total"]

        cur.execute(
            """
            SELECT id, id_workspace, workspace_name, total_contacts,
                   contact_type, status, created_at, updated_at
            FROM api_enrichments_seed
            ORDER BY created_at ASC, id ASC
            LIMIT %s OFFSET %s;
            """,
            (limit, offset),
        )
        rows = cur.fetchall()

    total_pages = math.ceil(total_items / limit) if total_items else 0

    data = [
        {
            "id": str(row["id"]),
            "id_workspace": str(row["id_workspace"]),
            "workspace_name": row["workspace_name"],
            "total_contacts": row["total_contacts"],
            "contact_type": row["contact_type"],
            "status": row["status"],
            "created_at": row["created_at"].isoformat(),
            "updated_at": row["updated_at"].isoformat(),
        }
        for row in rows
    ]

    return {
        "meta": {
            "current_page": page,
            "items_per_page": limit,
            "total_items": total_items,
            "total_pages": total_pages,
        },
        "data": data,
    }