import random
import uuid
from datetime import timedelta

from faker import Faker

from app.core import SEED_TOTAL_RECORDS
from app.core import get_cursor

fake = Faker("pt_BR")

STATUSES = ["PROCESSING", "COMPLETED", "FAILED", "CANCELED"]
# Distribuição realista: maioria concluída, algumas falhas/canceladas, poucas em processamento
STATUS_WEIGHTS = [5, 75, 12, 8]

CONTACT_TYPES = ["PERSON", "COMPANY"]

# Um conjunto fixo de workspaces para os dados terem coerência
# (mesmo id_workspace aparecendo em vários enrichments)
_WORKSPACES = [
    (str(uuid.uuid4()), fake.company())
    for _ in range(120)
]


def _random_created_at():
    # Distribui os registros nos últimos 90 dias
    days_ago = random.randint(0, 90)
    return fake.date_time_between(start_date=f"-{days_ago}d", end_date="now")


def _build_record():
    id_workspace, workspace_name = random.choice(_WORKSPACES)
    status = random.choices(STATUSES, weights=STATUS_WEIGHTS, k=1)[0]
    contact_type = random.choice(CONTACT_TYPES)
    total_contacts = random.choice(
        [random.randint(1, 99), random.randint(100, 500),
         random.randint(501, 1000), random.randint(1001, 5000)]
    )

    created_at = _random_created_at()

    if status == "PROCESSING":
        # Ainda em andamento: updated_at é só um pouco depois do created_at
        updated_at = created_at + timedelta(minutes=random.randint(1, 5))
    else:
        # Concluído/Falhou/Cancelado: duração de processamento variável
        updated_at = created_at + timedelta(minutes=random.randint(1, 240))

    return {
        "id": str(uuid.uuid4()),
        "id_workspace": id_workspace,
        "workspace_name": workspace_name,
        "total_contacts": total_contacts,
        "contact_type": contact_type,
        "status": status,
        "created_at": created_at,
        "updated_at": updated_at,
    }


def seed_if_empty():
    """
    Popula api_enrichments_seed apenas se a tabela estiver vazia,
    para manter o seed determinístico entre reinicializações do container.
    """
    with get_cursor() as cur:
        cur.execute("SELECT COUNT(*) AS total FROM api_enrichments_seed;")
        total = cur.fetchone()["total"]

        if total > 0:
            print(f"[seed] api_enrichments_seed já possui {total} registros. Pulando seed.")
            return

        print(f"[seed] Gerando {SEED_TOTAL_RECORDS} registros de enriquecimento...")

        records = [_build_record() for _ in range(SEED_TOTAL_RECORDS)]

        args = [
            (
                r["id"], r["id_workspace"], r["workspace_name"], r["total_contacts"],
                r["contact_type"], r["status"], r["created_at"], r["updated_at"],
            )
            for r in records
        ]

        cur.executemany(
            """
            INSERT INTO api_enrichments_seed
                (id, id_workspace, workspace_name, total_contacts,
                 contact_type, status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            args,
        )

        print(f"[seed] {len(records)} registros inseridos com sucesso.")