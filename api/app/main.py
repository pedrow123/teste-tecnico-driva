from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import analytics, source
from app.seed import seed_if_empty

app = FastAPI(
    title="Driva - Enrichments API",
    description="API de fonte (simulação) + endpoints de analytics sobre a camada Gold.",
    version="1.0.0",
)

# Permite que o dashboard (rodando em outra origem/porta) chame a API do navegador.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # para o teste técnico; em produção, restrinja ao domínio do dashboard
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(source.router)
app.include_router(analytics.router)


@app.on_event("startup")
def on_startup():
    seed_if_empty()


@app.get("/health")
def health():
    return {"status": "ok"}