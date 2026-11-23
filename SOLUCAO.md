# Solução Técnica Consolidada — Engenharia de Dados com MongoDB

Este documento consolida as decisões arquiteturais, modelagens JSON, pipelines de agregação, benchmarks reais de performance e validações transacionais ACID referentes às **Tarefas 1, 2, 3 e 4** do desafio.

---

## Tarefa 1 — Modelagem e Evolução de Schema

> **Arquivos de referência:** [`tarefa-1-modelagem/`](./tarefa-1-modelagem/) ([`product-com-reviews.json`](./tarefa-1-modelagem/product-com-reviews.json), [`review-documento.json`](./tarefa-1-modelagem/review-documento.json), [`order-com-status-history.json`](./tarefa-1-modelagem/order-com-status-history.json), [`operacoes-atualizacao.js`](./tarefa-1-modelagem/operacoes-atualizacao.js))

### 1.1 Avaliações de Produtos (Reviews) — Abordagem Híbrida (Referencing + Computed + Subset Pattern)

Um produto popular pode acumular dezenas de milhares de avaliações ao longo do tempo. Embutir todas as avaliações diretamente no documento da coleção `products` violaria o limite rígido de **16 MB por documento BSON** (**antipadrão Unbounded Arrays**), além de causar fragmentação e alto custo de escrita/leitura.

A solução adotada combina **3 padrões oficiais de modelagem MongoDB**:

1. **Referencing (Coleção separada `reviews`):**
   - Armazena o histórico completo e ilimitado de avaliações, referenciando `productId` e `userId`.
   - Índice composto `{ productId: 1, createdAt: -1 }` permite paginação eficiente de avaliações antigas sob demanda.
2. **Computed Pattern (`reviewStats` embutido em `products`):**
   - Mantém `averageRating`, `totalReviews` e `ratingSum` pré-calculados no documento do produto, evitando `$group`/`$avg` em tempo de leitura.
3. **Subset Pattern (`recentReviews` embutido em `products`):**
   - Mantém **estritamente as 10 avaliações mais recentes** no documento do produto usando `$push` + `$each` + `$sort: { createdAt: -1 }` + `$slice: 10` (ou pipeline de atualização com `$sortArray` + `$slice`).

**Benefício de leitura O(1):** Na tela do produto, uma única consulta `db.products.findOne({ _id: productId })` retorna dados do produto, nota média, contagem total e as 10 avaliações mais recentes **sem nenhum `$lookup` ou agregação pesada**.

#### Modelo JSON — `products` (com `reviewStats` e `recentReviews`)

```json
{
  "_id": { "$oid": "67c100000000000000000001" },
  "sku": "SKU-00001",
  "name": "Produto Exemplo 1",
  "category": "Eletrônicos",
  "price": 249.9,
  "stock": 120,
  "sellerId": "SELLER-12",
  "active": true,
  "reviewStats": {
    "averageRating": 4.8,
    "totalReviews": 1542,
    "ratingSum": 7402
  },
  "recentReviews": [
    {
      "_id": { "$oid": "67c100000000000000009010" },
      "userId": { "$oid": "67c100000000000000001042" },
      "authorName": "Cliente 1042",
      "rating": 5,
      "comment": "Excelente qualidade de construção e entrega rápida.",
      "createdAt": { "$date": "2026-11-22T18:10:00.000Z" }
    }
  ]
}
```

#### Modelo JSON — `reviews` (Coleção Referenciada)

```json
{
  "_id": { "$oid": "67c100000000000000009010" },
  "productId": { "$oid": "67c100000000000000000001" },
  "userId": { "$oid": "67c100000000000000001042" },
  "authorName": "Cliente 1042",
  "rating": 5,
  "comment": "Excelente qualidade de construção e entrega rápida.",
  "createdAt": { "$date": "2026-11-22T18:10:00.000Z" }
}
```

---

### 1.2 Logs de Auditoria de Pedidos (`statusHistory`) — Embedding (Bounded Array)

Diferentemente de avaliações, o ciclo de vida de um pedido (`PENDING -> PAID -> SHIPPED -> DELIVERED`, ou `CANCELED`) possui **cardinalidade pequena e estritamente limitada** (tipicamente de 2 a 6 transições por pedido). Por isso, utiliza-se **Embedding** direto no documento `orders` por meio do array `statusHistory`.

- **Onde foi usado Embedding:** `items` e `statusHistory` em `orders`, além de `reviewStats` e `recentReviews` (limitado a 10) em `products`.
- **Onde foi usado Referencing:** `reviews.productId -> products._id`, `reviews.userId -> users._id` e `orders.userId -> users._id`.
- **Prevenção de Unbounded Arrays (16 MB BSON):** Nenhum array embutido cresce indefinidamente: `recentReviews` tem teto rígido (`$slice: 10`), `items` é limitado pelos itens do carrinho e `statusHistory` acompanha exclusivamente os estados finitos da máquina de estados do pedido.

#### Modelo JSON — `orders` (com `statusHistory`)

```json
{
  "_id": { "$oid": "67c100000000000000005001" },
  "userId": { "$oid": "67c100000000000000001042" },
  "shippingCity": "São Paulo",
  "status": "DELIVERED",
  "items": [
    {
      "productId": { "$oid": "67c100000000000000000001" },
      "sku": "SKU-00001",
      "category": "Eletrônicos",
      "unitPrice": 249.9,
      "quantity": 2
    }
  ],
  "totalAmount": 499.8,
  "createdAt": { "$date": "2026-11-20T10:00:00.000Z" },
  "statusHistory": [
    {
      "status": "PENDING",
      "changedAt": { "$date": "2026-11-20T10:00:00.000Z" },
      "changedBy": { "userId": { "$oid": "67c100000000000000001042" }, "role": "CUSTOMER", "name": "Cliente 1042" }
    },
    {
      "status": "PAID",
      "changedAt": { "$date": "2026-11-20T10:00:14.000Z" },
      "changedBy": { "userId": null, "role": "PAYMENT_GATEWAY", "name": "Stripe Webhook" }
    },
    {
      "status": "SHIPPED",
      "changedAt": { "$date": "2026-11-21T09:30:00.000Z" },
      "changedBy": { "userId": "SELLER-12", "role": "SELLER", "name": "Loja Oficial Eletrônicos" }
    },
    {
      "status": "DELIVERED",
      "changedAt": { "$date": "2026-11-22T15:45:00.000Z" },
      "changedBy": { "userId": null, "role": "CARRIER", "name": "Transportadora Express" }
    }
  ]
}
```

---

## Tarefa 2 — Aggregation Framework (100.000 Pedidos)

> **Arquivos de referência:** [`tarefa-2-agregacoes/agregacoes.js`](./tarefa-2-agregacoes/agregacoes.js) | [`RELATORIO-TAREFA-2.md`](./tarefa-2-agregacoes/RELATORIO-TAREFA-2.md) | Print: [`evidencias/prints/tarefa-2-agregacoes.png`](./evidencias/prints/tarefa-2-agregacoes.png)

Ambos os pipelines foram executados **100% no servidor MongoDB**, sem manipulação de arrays na memória do Node.js.

### 2.1 Faturamento por Categoria (Últimos 90 dias) — `159 ms`

Filtra pedidos com `status` em `['PAID', 'SHIPPED', 'DELIVERED']` e `createdAt >= últimos 90 dias`, aplica `$unwind: '$items'`, agrupa por `$items.category`, calcula `faturamentoTotal` com `$round(..., 2)` e `quantidadeItensVendidos`, e ordena decrescentemente:

| Posição | Categoria | Faturamento Total (R$) | Quantidade de Itens Vendidos |
| :---: | :--- | ---: | ---: |
| 1 | Livros | R$ 8.823.045,12 | 31.640 |
| 2 | Casa e Cozinha | R$ 8.254.224,58 | 29.352 |
| 3 | Esportes | R$ 7.993.407,52 | 28.972 |
| 4 | Eletrônicos | R$ 7.950.236,18 | 31.192 |
| 5 | Moda | R$ 7.447.656,85 | 28.417 |

### 2.2 Ranking de Clientes VIP em São Paulo (Paginado com `$facet` + `$lookup`) — `58 ms`

- **Regra de negócio:** Filtra `shippingCity: "São Paulo"` e pedidos efetivados (`PAID`, `SHIPPED`, `DELIVERED`), evitando que pedidos `PENDING` ou `CANCELED` distorçam o ranking de receita por cliente.
- **Otimização:** O `$lookup` em `users` é posicionado dentro do ramo `data` do `$facet` **depois** de `$skip` e `$limit: 10`, executando apenas 10 junções em vez de 858.
- **Metadados retornados:** `totalClientesElegiveis: 858`, `paginaAtual: 1`, `limitePorPagina: 10`, `totalPaginas: 86`.

| Posição | Cliente | E-mail | Pedidos | Total Gasto (R$) |
| :---: | :--- | :--- | :---: | ---: |
| 1 | Cliente 673 | `cliente673@exemplo.com` | 23 | R$ 34.422,37 |
| 2 | Cliente 1207 | `cliente1207@exemplo.com` | 19 | R$ 34.047,40 |
| 3 | Cliente 1645 | `cliente1645@exemplo.com` | 26 | R$ 33.575,93 |
| 4 | Cliente 2363 | `cliente2363@exemplo.com` | 19 | R$ 32.297,46 |
| 5 | Cliente 430 | `cliente430@exemplo.com` | 19 | R$ 31.977,33 |
| 6 | Cliente 1042 | `cliente1042@exemplo.com` | 17 | R$ 31.888,16 |
| 7 | Cliente 4350 | `cliente4350@exemplo.com` | 20 | R$ 31.744,55 |
| 8 | Cliente 1530 | `cliente1530@exemplo.com` | 22 | R$ 31.202,59 |
| 9 | Cliente 2576 | `cliente2576@exemplo.com` | 16 | R$ 30.371,12 |
| 10 | Cliente 3297 | `cliente3297@exemplo.com` | 18 | R$ 29.936,88 |

---

## Tarefa 3 — Diagnóstico e Otimização de Performance (Regra ESR)

> **Arquivos de referência:** [`tarefa-3-performance/benchmark-indices.js`](./tarefa-3-performance/benchmark-indices.js) | [`RELATORIO-TAREFA-3.md`](./tarefa-3-performance/RELATORIO-TAREFA-3.md) | Print: [`evidencias/prints/tarefa-3-explain-comparativo.png`](./evidencias/prints/tarefa-3-explain-comparativo.png)

Consulta analisada sobre os **100.000 documentos** da coleção `orders`:

```js
db.orders.find({
  shippingCity: "São Paulo",
  status: "DELIVERED",
  createdAt: { $gte: new Date(Date.now() - 30 * 86400000) }
}).sort({ createdAt: -1 })
```

### Comparativo Real Antes × Depois (`.explain("executionStats")`)

| Métrica | Antes (Sem Índice Secundário) | Depois (Índice ESR) | Impacto |
| :--- | :--- | :--- | :--- |
| **Estágio do Plano** | `SORT -> COLLSCAN` | `FETCH -> IXSCAN (idx_orders_city_status_createdAt_esr)` | Eliminou `COLLSCAN` e `SORT` em memória |
| **`executionTimeMillis`** | `50 ms` | `2 ms` | **25.0x mais rápido** |
| **`totalDocsExamined`** | `100.000` | `547` | **Redução de 99,45%** |
| **`totalKeysExamined`** | `0` | `547` | Seletividade 1:1 na B-Tree |
| **`nReturned`** | `547` | `547` | Resultado idêntico |

### Por que `{ shippingCity: 1, status: 1, createdAt: -1 }` (Regra ESR)?

1. **Equality (`shippingCity: 1`, `status: 1`):** Campos de igualdade exata vão primeiro para podar imediatamente a árvore B-Tree. `shippingCity` (6 cidades) precede `status` (5 estados) pela maior cardinalidade.
2. **Sort (`createdAt: -1`):** Posicionado logo após as igualdades na mesma direção da ordenação solicitada (`.sort({ createdAt: -1 })`), entregando os resultados já ordenados e eliminando o estágio bloqueante `SORT` em memória.
3. **Range (`createdAt: { $gte: ... }`):** O filtro de intervalo atua sobre a mesma chave de ordenação, permitindo varredura contínua de índice (`IXSCAN`) até o limite de 30 dias atrás sem examinar documentos descartados.

---

## Tarefa 4 — Consistência e Transações ACID

> **Arquivos de referência:** [`tarefa-4-transacoes/checkout-transacional.js`](./tarefa-4-transacoes/checkout-transacional.js) | [`testar-transacoes.js`](./tarefa-4-transacoes/testar-transacoes.js) | [`RELATORIO-TAREFA-4.md`](./tarefa-4-transacoes/RELATORIO-TAREFA-4.md) | Print: [`evidencias/prints/tarefa-4-transacoes-acid.png`](./evidencias/prints/tarefa-4-transacoes-acid.png)

O checkout atômico foi implementado em `realizarCheckout(client, { userId, productId, quantity })` utilizando `client.startSession()`, `session.startTransaction()`, `session.commitTransaction()` e `session.abortTransaction()` sobre o MongoDB 7 configurado como Replica Set (`rs0`), passando `{ session }` em todas as leituras e escritas entre `products`, `users` e `orders` (além de guardas condicionais `stock: { $gte: quantity }` e `walletBalance: { $gte: totalAmount }`).

### Resultados Reais dos 3 Cenários Executados

| Cenário | Operação | Desfecho | Estoque (Antes → Depois) | Saldo (Antes → Depois) | Total Pedidos (Antes → Depois) |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **1** | Checkout válido de 2 un. (R$ 300,00) | `COMMITTED` | `10 → 8` | `R$ 500,00 → R$ 200,00` | `100000 → 100001` |
| **2** | Saldo insuficiente (R$ 450,00 vs R$ 200,00) | `ABORTED (Rollback)` | `8 → 8` | `R$ 200,00 → R$ 200,00` | `100001 → 100001` |
| **3** | Erro forçado **após** `$inc` no estoque e antes do débito da carteira | `ABORTED (Rollback ACID)` | `8 → 8` | `R$ 200,00 → R$ 200,00` | `100001 → 100001` |

No **Cenário 3**, mesmo após a execução bem-sucedida do `updateOne` que decrementa o estoque dentro da transação, a exceção lançada antes do débito na carteira dispara `await session.abortTransaction()`, revertendo o estoque exatamente para `8` na consulta posterior — comprovando **atomicidade e isolamento ACID** multi-documento e multi-coleção.
