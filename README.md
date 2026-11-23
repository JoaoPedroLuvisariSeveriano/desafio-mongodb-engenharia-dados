# Desafio Técnico Back-End — Engenharia de Dados com MongoDB

Solução completa em **Node.js, Express e MongoDB 7 (Replica Set `rs0`)** cobrindo todas as 8 entregas do desafio (**Parte 1 a Parte 4** e **Tarefa 1 a Tarefa 4**), com execução real, benchmarks, validação transacional ACID e evidências visuais em PNG.

---

## Índice das Entregas

| Entrega | Descrição | Pasta / Código | Relatório / Evidência | Print Visual |
| :--- | :--- | :--- | :--- | :--- |
| **Infraestrutura** | Docker Compose (`mongo:7` Replica Set `rs0` + `mongo-express`), `.env.example`, `.gitignore` | [`docker-compose.yml`](./docker-compose.yml) | [`.env.example`](./.env.example) | — |
| **Parte 1** | API Marketplace monolítica em memória (Node.js + Express) | [`parte-1-api-memoria/`](./parte-1-api-memoria/index.js) | — | — |
| **Parte 2** | Testes automatizados da API, `requests.http` e coleção Postman | [`parte-2-testes-api/`](./parte-2-testes-api/testar-api.js) | [`EVIDENCIAS-PARTE-2.md`](./parte-2-testes-api/EVIDENCIAS-PARTE-2.md) | [`parte-2-testes-api.png`](./evidencias/prints/parte-2-testes-api.png) |
| **Parte 3** | Persistência com MongoDB, Mongoose, `.env` e `.populate()` | [`parte-3-api-mongodb/`](./parte-3-api-mongodb/index.js) | [`EVIDENCIAS-PARTE-3.md`](./parte-3-api-mongodb/EVIDENCIAS-PARTE-3.md) | [`parte-3-mongodb-colecoes.png`](./evidencias/prints/parte-3-mongodb-colecoes.png) |
| **Parte 4** | Seed em lote (`1k` produtos, `5k` usuários, `100k` pedidos) sem índices secundários + amostra | [`parte-4-seed/`](./parte-4-seed/seed.js) | [`RELATORIO-PARTE-4-AMOSTRA.md`](./parte-4-seed/RELATORIO-PARTE-4-AMOSTRA.md) | [`parte-4-seed-amostra.png`](./evidencias/prints/parte-4-seed-amostra.png) / [`parte-4-amostra-docs.png`](./evidencias/prints/parte-4-amostra-docs.png) |
| **Tarefa 1** | Modelagem JSON de Reviews (Hybrid/Computed/Subset) e Auditoria de Pedidos (`statusHistory`) | [`tarefa-1-modelagem/`](./tarefa-1-modelagem/) | [`SOLUCAO.md#tarefa-1`](./SOLUCAO.md#tarefa-1--modelagem-e-evolu%C3%A7%C3%A3o-de-schema) | — |
| **Tarefa 2** | Aggregation Framework: Faturamento por Categoria (90d) + Ranking VIP SP (`$facet` + `$lookup`) | [`tarefa-2-agregacoes/`](./tarefa-2-agregacoes/agregacoes.js) | [`RELATORIO-TAREFA-2.md`](./tarefa-2-agregacoes/RELATORIO-TAREFA-2.md) | [`tarefa-2-agregacoes.png`](./evidencias/prints/tarefa-2-agregacoes.png) |
| **Tarefa 3** | Diagnóstico `.explain("executionStats")` (`COLLSCAN` → `IXSCAN`) e índice composto pela Regra ESR | [`tarefa-3-performance/`](./tarefa-3-performance/benchmark-indices.js) | [`RELATORIO-TAREFA-3.md`](./tarefa-3-performance/RELATORIO-TAREFA-3.md) | [`tarefa-3-explain-comparativo.png`](./evidencias/prints/tarefa-3-explain-comparativo.png) |
| **Tarefa 4** | Checkout Transacional ACID (`startSession`, `commitTransaction`, `abortTransaction`) em 3 cenários | [`tarefa-4-transacoes/`](./tarefa-4-transacoes/checkout-transacional.js) | [`RELATORIO-TAREFA-4.md`](./tarefa-4-transacoes/RELATORIO-TAREFA-4.md) | [`tarefa-4-transacoes-acid.png`](./evidencias/prints/tarefa-4-transacoes-acid.png) |

> **Consolidação Arquitetural (Tarefas 1 a 4):** leia [`SOLUCAO.md`](./SOLUCAO.md).

---

## Como Subir a Infraestrutura e Reproduzir

### 1. Subir MongoDB 7 (Replica Set `rs0`) + Mongo Express

```powershell
# Caso não tenha MongoDB local ocupando a porta 27017:
docker compose up -d

# Caso a porta 27017 já esteja em uso no Windows, defina MONGO_PORT=27018 no .env:
docker compose --env-file .env up -d
```

- **Mongo Express UI:** `http://localhost:8081`

### 2. Executar cada etapa em ordem

```powershell
# Parte 1 e 2 (API em Memória + Testes)
cd parte-1-api-memoria; npm install; Start-Process node index.js
cd ../parte-2-testes-api; node testar-api.js

# Parte 3 (API MongoDB + Mongoose)
cd ../parte-3-api-mongodb; npm install; cp .env.example .env
# (Em dois terminais: `node index.js` e `node testar-persistencia.js`)

# Parte 4 (Seed de 106.000 documentos + Amostra)
cd ../parte-4-seed; npm install; node seed.js; node amostra-banco.js

# Tarefa 2 (Agregações)
cd ../tarefa-2-agregacoes; npm install; node agregacoes.js

# Tarefa 3 (Benchmark Antes x Depois + Índice ESR)
cd ../tarefa-3-performance; npm install; node benchmark-indices.js

# Tarefa 4 (Transações ACID)
cd ../tarefa-4-transacoes; npm install; node testar-transacoes.js
```
