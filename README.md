# Driva — Pipeline de Ingestão + API + Dashboard de Visibilidade

Solução do teste técnico: pipeline de dados em camadas **Bronze/Gold** para monitorar performance e qualidade dos enriquecimentos entregues na plataforma, com API própria, orquestração via **n8n** e um **dashboard** de consumo para o time de Visibilidade.

## Demonstração

Vídeo de demonstração da solução, apresentando a arquitetura, execução da pipeline, workflows do n8n, API e dashboard.

[Assistir ao vídeo de demonstração](https://drive.google.com/file/d/1MiolVZnAFvcJJKN7kDMGAjT_nxttqHtq/view?usp=drive_link)

---

## Visão geral da solução

O fluxo completo funciona assim:

1. A **API** expõe um endpoint de **fonte** (`/people/v1/enrichments`) que simula a API interna de enriquecimentos da Driva — paginada, autenticada e com chance simulada de `429 Too Many Requests`. Os dados vêm de uma tabela de seed gerada automaticamente no primeiro start (6.000 registros determinísticos).
2. O **n8n** roda um **Orquestrador** agendado a cada 5 minutos, que chama dois workflows:
   - **Ingestão**: pagina o endpoint de fonte e grava (upsert) tudo na camada **Bronze**, fielmente.
   - **Processamento**: lê a Bronze, traduz e transforma os dados, e grava (upsert) na camada **Gold**, já em português e com campos calculados.
3. A **API** expõe endpoints de **Analytics** que leem a Gold.
4. O **Dashboard** (React) consome esses endpoints de Analytics e mostra KPIs, gráficos de distribuição, status do pipeline em tempo quase real e uma tabela paginada/filtrável.

---

## Arquitetura

```
                    ┌──────────────┐
   a cada 5min      │  n8n         │
   ┌────────────── ▶│  Orquestrador│
   │                 └──────┬───────┘
   │                        │ chama
   │            ┌───────────┴────────────┐
   │            ▼                        ▼
   │   ┌─────────────────┐     ┌──────────────────┐
   │   │ Workflow         │     │ Workflow          │
   │   │ Ingestão         │     │ Processamento     │
   │   │ (API → Bronze)   │────▶│ (Bronze → Gold)   │
   │   └────────┬─────────┘     └─────────┬─────────┘
   │            │ GET paginado             │ upsert
   │            ▼                          ▼
   │   ┌──────────────────────────────────────────┐
   └───│  API (FastAPI)                            │
       │  /people/v1/enrichments  (fonte, seed)     │
       │  /analytics/*             (lê a Gold)      │
       └───────────────────┬────────────────────────┘
                            │
                            ▼
                 ┌────────────────────┐
                 │ Postgres (DW)       │
                 │ bronze_enrichments  │
                 │ gold_enrichments    │
                 │ dw_pipeline_runs    │
                 └─────────┬───────────┘
                            │ lido via API
                            ▼
                 ┌────────────────────┐
                 │ Dashboard (React)   │
                 │ KPIs, gráficos,     │
                 │ tabela, status      │
                 └────────────────────┘
```

---

## Estrutura do projeto

```
driva-teste-tecnico/
├── docker-compose.yml
├── .env.example
├── README.md
│
├── database/
│   └── init.sql                 # cria Bronze, Gold, seed e tabela de logs
│
├── api/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py              # instância FastAPI + CORS + startup (seed)
│       ├── core.py              # config, pool do Postgres, autenticação
│       ├── seed.py              # gera os 6.000 registros de origem
│       └── routers/
│           ├── source.py        # GET /people/v1/enrichments
│           └── analytics.py     # GET /analytics/*
│
├── n8n/
│   └── workflows/
│       ├── Workflow 1 - Ingestão.json
│       ├── Workflow 2 - Processamento.json
│       └── Workflow 3 - Orquestrador.json
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.js               
    ├── index.html
    └── src/
        ├── main.jsx / App.jsx
        ├── index.css / App.css      
        ├── api/client.js            
        ├── components/
        │   ├── Header.jsx
        │   ├── PipelineStatusCard.jsx
        │   ├── KpiCards.jsx
        │   ├── DistributionChart.jsx
        │   ├── EnrichmentsTable.jsx
        │   └── StatusBadge.jsx
        └── pages/Dashboard.jsx
```

> **Nota:** os JSONs em `n8n/workflows/` devem ser exportados manualmente pela UI do n8n (`⋮ → Download`) depois de montados — não são gerados automaticamente pelo ambiente Docker.

---

## Pré-requisitos

- Docker e Docker Compose instalados
- Portas livres: `5432` (Postgres), `5678` (n8n), `3000` (API), `5173` (frontend)

---

## Como subir o ambiente

```bash
# 1. Clone/extraia o projeto e entre na pasta raiz
cd teste-tecnico-driva

# 2. Copie o arquivo de variáveis de ambiente (único, na raiz — usado por todos os serviços)
cp .env.example .env

# 3. Suba tudo
docker compose up --build
```

> **Importante:** o `docker-compose.yml` exige que todas as variáveis estejam definidas no `.env` (não há valores hardcoded como fallback) — se o `.env` não existir ou faltar alguma variável, o `docker compose up` falha com uma mensagem clara indicando qual variável está faltando, em vez de subir silenciosamente com uma senha/chave incorreta.

Isso sobe, nessa ordem de dependência:
1. **postgres** — cria as tabelas automaticamente via `init.sql` (montado como volume de inicialização).
2. **api** — conecta no Postgres e, no primeiro start, popula a tabela de seed com 6.000 registros (idempotente: só roda se a tabela estiver vazia).
3. **n8n** — sobe vazio na primeira vez (ver seção de workflows abaixo sobre importação).
4. **frontend** — sobe o dashboard em modo dev (Vite).

Acessos:
- API: `http://localhost:3000` (docs interativas em `http://localhost:3000/docs`)
- n8n: `http://localhost:5678`
- Dashboard: `http://localhost:5173`
- Postgres: `localhost:5432` (user `driva` / senha `driva_pass` / db `driva_dw`)

Para subir só um serviço específico (útil durante o desenvolvimento):
```bash
docker compose up postgres
docker compose up --build api
```

Para forçar rebuild sem cache (necessário depois de alterar dependências ou se o container parecer "preso" no código antigo):
```bash
docker compose build --no-cache api
docker compose up -d --force-recreate api
```

### Rodando o frontend fora do Docker (alternativa)

Não é necessário nenhum `.env` adicional dentro de `frontend/` — o `vite.config.js` está configurado com `envDir` apontando para a raiz do projeto, então o Vite lê as variáveis `VITE_*` direto do `.env` já criado no passo anterior, mesmo rodando fora do container:

```bash
cd frontend
npm install
npm run dev
```
Acesse `http://localhost:5173`.

---

## Banco de dados (`init.sql`)

Criado automaticamente no primeiro start do Postgres (via `docker-entrypoint-initdb.d`). Contém:

| Tabela | Propósito |
|---|---|
| `api_enrichments_seed` | Fonte de dados simulada, consumida pelo endpoint `/people/v1/enrichments`. Populada pela API no startup. |
| `bronze_enrichments` | Captura fiel do que a API de origem retorna, com `raw_payload JSONB` (payload bruto completo) e os campos de controle `dw_ingested_at`/`dw_updated_at`. |
| `gold_enrichments` | Dados traduzidos para português + campos calculados, prontos para consumo do dashboard. |
| `dw_pipeline_runs` | Log/observabilidade de cada execução (etapa, status, quantidade de registros, erros, watermark de página). |

Todas as tabelas têm índices nos campos mais consultados (`status`, `id_workspace`, `data_criacao`, `categoria_tamanho_job`).

---

## API

Stack: **Python + FastAPI**, rodando em Uvicorn dentro do container `api`.

### Autenticação

Todos os endpoints exigem o header:
```
Authorization: Bearer driva_test_key_abc123xyz789
```
(configurável via variável de ambiente `API_KEY`)

### Grupo 1 — Fonte (consumida pelo n8n)

**`GET /people/v1/enrichments?page={page}&limit={limit}`**

- Pagina sobre a tabela `api_enrichments_seed` (6.000 registros fixos e determinísticos, gerados com `Faker`).
- `limit` máximo de 100.
- Retorna `meta.total_pages` / `meta.total_items` conforme especificado.
- Simula `429 Too Many Requests` com ~8% de chance por requisição (`RATE_LIMIT_CHANCE`, configurável), para forçar o tratamento de retry no n8n.

### Grupo 2 — Analytics (consumido pelo dashboard)

| Endpoint | Descrição |
|---|---|
| `GET /analytics/overview` | KPIs agregados: total de jobs, % de sucesso, tempo médio de processamento, distribuição por categoria de tamanho e por status. |
| `GET /analytics/enrichments` | Listagem paginada da Gold, com filtros opcionais por `id_workspace`, `status_processamento`, `data_inicio`, `data_fim`. |
| `GET /analytics/pipeline-status` | Última execução de cada etapa do pipeline (`INGESTAO`, `PROCESSAMENTO`, `ORQUESTRADOR`) — usado pelo dashboard para mostrar se o ciclo automático está rodando. |
| `GET /analytics/workspaces/top` *(bônus)* | Ranking de workspaces por volume de enriquecimentos e total de contatos. |

### CORS

A API libera CORS (`allow_origins=["*"]`) para que o dashboard, rodando em outra porta/origem, consiga chamá-la diretamente do navegador. Em um cenário de produção real, isso seria restrito ao domínio do dashboard.

---

## n8n — Workflows

### Setup inicial (uma vez, após o primeiro `docker compose up`)

1. Acesse `http://localhost:5678` e crie sua conta local.
2. Crie uma credencial Postgres (**Settings → Credentials → New → Postgres**):
   - Host: `postgres` | Database: `driva_dw` | User: `driva` | Password: `driva_pass` | Port: `5432`
3. Importe os 3 workflows: **Workflows → Import from File** → selecione cada JSON em `n8n/workflows/`.
4. Em cada node **Postgres** dos workflows importados, reselecione a credencial criada no passo 2 (o n8n não migra credenciais dentro do JSON, por segurança).

### Os três workflows

**`Workflow 1 - Ingestão.json`** — chamável (`Execute Workflow Trigger`). Pagina o endpoint de fonte, trata `429` com retry e backoff exponencial, e faz upsert na Bronze.

**`Workflow 2 - Processamento.json`** — chamável. Lê a Bronze inteira, aplica as traduções e os campos calculados, e faz upsert na Gold.

**`Workflow 3 - Orquestrador.json`** — `Schedule Trigger` a cada 5 minutos. Chama Ingestão → Processamento em sequência, com tratamento de erro via saída `On Error: Continue (using error output)` em cada `Execute Workflow`, logando sucesso/erro em `dw_pipeline_runs`.

### Testando sem esperar o schedule

Qualquer workflow pode ser testado manualmente pelo botão **"Test workflow"**, independente do tipo de trigger configurado — não é necessário publicar para popular a Bronze/Gold uma vez.

### Ativando o schedule automático

O n8n (versão usada neste projeto) usa o modelo **Draft/Publish**: só workflows **publicados** têm seus triggers automáticos (como o `Schedule Trigger`) realmente ativos em background. Para deixar o pipeline rodando sozinho:

1. Termine de validar manualmente o Orquestrador.
2. Clique em **Publish** na tela do Workflow 3.
3. Para pausar depois, use a opção de **Unpublish** no mesmo local.

### Persistência dos workflows

Os workflows e credenciais do n8n ficam em um volume Docker nomeado (`n8n_data`), então sobrevivem a `docker compose stop/up` e reinicializações. Eles só são perdidos com `docker compose down -v` (remoção explícita de volumes) — por isso os JSONs exportados em `n8n/workflows/` são o backup oficial e o que deve ser reimportado em qualquer ambiente novo.

---

## Dashboard (Frontend)

Stack: **React + Vite**, sem dependências de biblioteca de gráficos (os gráficos de distribuição são SVG/CSS customizados).

### O que ele mostra

- **Status do pipeline**: última execução de Ingestão, Processamento e Orquestrador, com indicador visual (verde/âmbar/vermelho) e "há X minutos" — prova visual de que o schedule automático está rodando.
- **KPIs**: total de enriquecimentos, taxa de sucesso, tempo médio de processamento, jobs grandes ou maiores.
- **Gráficos de distribuição**: por status de processamento e por categoria de tamanho de job.
- **Tabela paginada**: enriquecimentos da Gold, com filtro por `id_workspace` e por status, ordenada por `data_atualizacao_dw` (não por `data_criacao`) — assim, a cada ciclo do pipeline, as linhas que acabaram de ser tocadas pelo upsert sobem para o topo, tornando visível que o pipeline está rodando mesmo quando os dados de negócio em si não mudam (seed fixo). A coluna "Atualizado no DW" exibe esse timestamp lado a lado com a data de criação original.

Os dados são buscados a cada carregamento e também via **polling automático a cada 30 segundos**, sem precisar recarregar a página.

### Direção visual

Tema "enriquecimento de dados": fundo escuro (ambiente de data warehouse) com acento âmbar/dourado representando o valor agregado aos dados. Tipografia: Space Grotesk (headers/números), Inter (UI), IBM Plex Mono (dados tabulares/IDs).

---

## Exemplos de chamadas (curl)

```bash
# Endpoint de fonte (paginado)
curl -H "Authorization: Bearer driva_test_key_abc123xyz789" \
  "http://localhost:3000/people/v1/enrichments?page=1&limit=50"

# KPIs gerais
curl -H "Authorization: Bearer driva_test_key_abc123xyz789" \
  "http://localhost:3000/analytics/overview"

# Enriquecimentos filtrados por status, paginados
curl -H "Authorization: Bearer driva_test_key_abc123xyz789" \
  "http://localhost:3000/analytics/enrichments?page=1&limit=10&status_processamento=CONCLUIDO"

# Status do pipeline (última execução de cada etapa)
curl -H "Authorization: Bearer driva_test_key_abc123xyz789" \
  "http://localhost:3000/analytics/pipeline-status"

# Ranking de workspaces (bônus)
curl -H "Authorization: Bearer driva_test_key_abc123xyz789" \
  "http://localhost:3000/analytics/workspaces/top?limit=5"

# Sem o header de autenticação -> 401
curl "http://localhost:3000/analytics/overview"
```

---

## Decisões de projeto

- **Seed determinístico (6.000 registros, fixo)**: a tabela de origem só é populada uma vez, no primeiro start. Isso torna o pipeline testável e reprodutível — rodar a ingestão múltiplas vezes sempre resulta no mesmo total, o que serve como prova de que o upsert está funcionando corretamente (idempotência), em vez de duplicar dados a cada execução.
- **Upsert em vez de append em Bronze e Gold**: ambas as camadas usam `ON CONFLICT ... DO UPDATE` pela chave `id_enriquecimento`, garantindo que a Gold sempre reflita o estado mais atual da Bronze, conforme pedido no enunciado, sem crescer indefinidamente a cada ciclo de 5 minutos.
- **`raw_payload JSONB` na Bronze**: além dos campos individuais, guardamos o payload bruto completo para rastreabilidade e para facilitar debugging sem depender só dos campos tipados.
- **Separação Ingestão/Processamento/Orquestrador em 3 workflows**: os dois primeiros são chamáveis (`Execute Workflow Trigger`) e reutilizáveis independentemente; o Orquestrador só cuida de agendamento e tratamento de erro entre eles — mantém cada workflow com responsabilidade única e mais fácil de testar isoladamente.
- **Retry com backoff no 429, feito manualmente no n8n** (em vez de confiar só no retry nativo do node HTTP Request): dá controle explícito sobre o número de tentativas e o tempo de espera crescente, e evita que o retry nativo do node rode em paralelo com a lógica de paginação, o que causava chamadas duplicadas durante o desenvolvimento.
- **CORS liberado (`*`) na API**: simplifica o setup local do teste técnico; em produção seria restrito ao domínio do dashboard.
- **Um único `.env` para todo o projeto**: em vez de um `.env` por serviço, todas as variáveis (Postgres, API Key, e as `VITE_*` do frontend) vivem em um só arquivo na raiz. O `vite.config.js` usa `envDir` apontando para essa raiz, então isso funciona tanto rodando via Docker (onde o Compose já injeta as variáveis diretamente no container) quanto rodando o frontend fora do Docker (`npm run dev` local) — sem precisar duplicar valores em dois arquivos.
- **Variáveis obrigatórias no `docker-compose.yml` (`${VAR:?mensagem}`, sem defaults hardcoded)**: evita que o ambiente suba silenciosamente com credenciais diferentes das documentadas no `.env.example` caso alguém esqueça de copiar o `.env` — falha rápido e explícito em vez de mascarar o problema.
- **Sem biblioteca de gráficos no frontend**: os gráficos de distribuição são poucos e simples (barras horizontais), então implementá-los em SVG/CSS evita uma dependência extra sem ganho real de funcionalidade.
- **Polling de 30s no dashboard, em vez de WebSockets**: para o volume e a frequência de atualização deste caso (pipeline roda a cada 5 min), polling simples é suficiente e muito mais simples de implementar/depurar do que uma conexão em tempo real.

---

## Troubleshooting

**Dashboard não mostra dados / erro de CORS no console**
Confirme que a API foi reconstruída com o `CORSMiddleware` (`docker compose build --no-cache api && docker compose up -d --force-recreate api`) e teste o preflight manualmente:
```bash
curl -i -X OPTIONS http://localhost:3000/analytics/overview \
  -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: GET"
```
Deve retornar o header `access-control-allow-origin`.

**`Workflow could not be published: ... references workflow ... which is not published`**
O n8n exige que todo workflow chamado via `Execute Workflow` (Ingestão e Processamento) esteja publicado antes de publicar quem os chama (o Orquestrador). Publique primeiro o Workflow 1 e o Workflow 2 individualmente, depois o Orquestrador. Isso não faz Ingestão/Processamento rodarem sozinhos — o trigger deles continua sendo só "chamável", não agendado.

**`total_items` sempre 6000, mesmo rodando a ingestão várias vezes**
Comportamento esperado — o seed é fixo e o upsert é idempotente (ver seção de Decisões de projeto).

**Workflow no n8n entra em loop ou perde `page`/`limit` no meio da paginação**
Certifique-se de que os nodes de incremento de página/tentativa preservam os campos anteriores (evite Sets que substituem o item inteiro) e que os nodes que juntam resultados de um `Split Out` (ex.: `Limit` ou `Aggregate`) vêm **antes** do IF que decide se pagina de novo — caso contrário o IF roda uma vez por item, e não uma vez por página.

**n8n perdeu os workflows depois de um `docker compose down`**
Só o `down -v` remove os volumes (incluindo `n8n_data`). Sem o `-v`, os workflows persistem. Se precisar recriar do zero, reimporte os JSONs de `n8n/workflows/`.
