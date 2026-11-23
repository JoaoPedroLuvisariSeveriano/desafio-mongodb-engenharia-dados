# Relatório da Tarefa 3 — Diagnóstico e Otimização de Performance (Regra ESR)

- **Data/Hora da Execução:** 2026-11-23T17:34:31.441Z
- **Coleção Analisada:** `marketplace.orders` (100.000 documentos)
- **Consulta Alvo:**

```js
db.orders.find({
  shippingCity: "São Paulo",
  status: "DELIVERED",
  createdAt: { $gte: new Date("2026-10-24T17:34:31.029Z") }
}).sort({ createdAt: -1 })
```

## 1. Comparativo Real Antes × Depois (`.explain("executionStats")`)

| Métrica | Antes (Sem Índice Secundário) | Depois (Índice Composto ESR) | Impacto |
| :--- | :--- | :--- | :--- |
| **Plano de Execução** | `SORT -> COLLSCAN` | `FETCH -> IXSCAN (idx_orders_city_status_createdAt_esr)` | Eliminação de `COLLSCAN` e `SORT` em memória |
| **executionTimeMillis** | `50 ms` | `2 ms` | 25.0x mais rápido |
| **totalDocsExamined** | `100.000` | `547` | Redução de **99.45%** |
| **totalKeysExamined** | `0` | `547` | Leitura direta na B-Tree |
| **nReturned** | `547` | `547` | Resultado idêntico |

## 2. Justificativa do Índice Composto pela Regra ESR (Equality, Sort, Range)

Índice criado: `{ shippingCity: 1, status: 1, createdAt: -1 }` (`idx_orders_city_status_createdAt_esr`).

1. **E (Equality) — `shippingCity: 1` e `status: 1`:** Campos filtrados por igualdade exata vão primeiro no índice para restringir imediatamente o intervalo de busca na B-Tree. `shippingCity` (6 valores no seed) vem antes de `status` (5 valores) por possuir maior cardinalidade/seletividade.
2. **S (Sort) — `createdAt: -1`:** Ao posicionar `createdAt: -1` logo após os campos de igualdade, as chaves dentro da partição `(shippingCity="São Paulo", status="DELIVERED")` já ficam fisicamente ordenadas em ordem decrescente de data, eliminando o estágio bloqueante `SORT` em memória.
3. **R (Range) — `createdAt: { $gte: ... }`:** Como o filtro de intervalo atua no mesmo campo da ordenação (`createdAt`), a consulta executa um único `IXSCAN` contínuo do valor mais recente até a data de corte de 30 dias atrás, examinando exatamente `nReturned` chaves e documentos.

## 3. Trechos Reais do `.explain("executionStats")`

### Antes (COLLSCAN + SORT)
```json
{
  "queryPlanner": {
    "winningPlan": {
      "stage": "SORT",
      "sortPattern": {
        "createdAt": -1
      },
      "memLimit": 104857600,
      "type": "simple",
      "inputStage": {
        "stage": "COLLSCAN",
        "filter": {
          "$and": [
            {
              "shippingCity": {
                "$eq": "São Paulo"
              }
            },
            {
              "status": {
                "$eq": "DELIVERED"
              }
            },
            {
              "createdAt": {
                "$gte": "2026-10-24T17:34:31.029Z"
              }
            }
          ]
        },
        "direction": "forward"
      }
    }
  },
  "executionStats": {
    "executionSuccess": true,
    "nReturned": 547,
    "executionTimeMillis": 50,
    "totalKeysExamined": 0,
    "totalDocsExamined": 100000
  }
}
```

### Depois (IXSCAN + FETCH sem SORT)
```json
{
  "queryPlanner": {
    "winningPlan": {
      "stage": "FETCH",
      "inputStage": {
        "stage": "IXSCAN",
        "keyPattern": {
          "shippingCity": 1,
          "status": 1,
          "createdAt": -1
        },
        "indexName": "idx_orders_city_status_createdAt_esr",
        "isMultiKey": false,
        "multiKeyPaths": {
          "shippingCity": [],
          "status": [],
          "createdAt": []
        },
        "isUnique": false,
        "isSparse": false,
        "isPartial": false,
        "indexVersion": 2,
        "direction": "forward",
        "indexBounds": {
          "shippingCity": [
            "[\"São Paulo\", \"São Paulo\"]"
          ],
          "status": [
            "[\"DELIVERED\", \"DELIVERED\"]"
          ],
          "createdAt": [
            "[new Date(9223372036854775807), new Date(1792863271029)]"
          ]
        }
      }
    }
  },
  "executionStats": {
    "executionSuccess": true,
    "nReturned": 547,
    "executionTimeMillis": 2,
    "totalKeysExamined": 547,
    "totalDocsExamined": 547
  },
  "indicesNaColecao": [
    {
      "name": "_id_",
      "key": {
        "_id": 1
      }
    },
    {
      "name": "idx_orders_city_status_createdAt_esr",
      "key": {
        "shippingCity": 1,
        "status": 1,
        "createdAt": -1
      }
    }
  ]
}
```
