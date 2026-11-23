# Relatório da Tarefa 2 — Aggregation Framework

- **Data/Hora da Execução:** 2026-11-23T17:32:18.099Z
- **Base Analisada:** `marketplace.orders` (100.000 documentos)
- **Processamento:** 100% executado no servidor MongoDB (zero processamento de arrays em Node.js).

## 1. Pipeline 1 — Relatório de Faturamento por Categoria (Últimos 90 dias)

- **Tempo de Execução:** `159 ms`
- **Data de Corte:** `2026-08-25T17:32:17.879Z`
- **Status Considerados:** `PAID`, `SHIPPED`, `DELIVERED` (exclui `PENDING` e `CANCELED` por ainda não representarem receita efetivada).

### Código do Pipeline

```js
[
  {
    "$match": {
      "status": {
        "$in": [
          "PAID",
          "SHIPPED",
          "DELIVERED"
        ]
      },
      "createdAt": {
        "$gte": "2026-08-25T17:32:17.879Z"
      }
    }
  },
  {
    "$unwind": "$items"
  },
  {
    "$group": {
      "_id": "$items.category",
      "faturamentoBruto": {
        "$sum": {
          "$multiply": [
            "$items.unitPrice",
            "$items.quantity"
          ]
        }
      },
      "quantidadeItensVendidos": {
        "$sum": "$items.quantity"
      }
    }
  },
  {
    "$project": {
      "_id": 0,
      "categoria": "$_id",
      "faturamentoTotal": {
        "$round": [
          "$faturamentoBruto",
          2
        ]
      },
      "quantidadeItensVendidos": 1
    }
  },
  {
    "$sort": {
      "faturamentoTotal": -1
    }
  }
]
```

### Resultado Real Obtido

| Posição | Categoria | Faturamento Total (R$) | Quantidade de Itens Vendidos |
| :---: | :--- | ---: | ---: |
| 1 | Livros | R$ 8.823.045,12 | 31.640 |
| 2 | Casa e Cozinha | R$ 8.254.224,58 | 29.352 |
| 3 | Esportes | R$ 7.993.407,52 | 28.972 |
| 4 | Eletrônicos | R$ 7.950.236,18 | 31.192 |
| 5 | Moda | R$ 7.447.656,85 | 28.417 |

## 2. Pipeline 2 — Ranking de Clientes VIP em São Paulo (Paginado)

- **Tempo de Execução:** `58 ms`
- **Regra de Negócio Aplicada:** Filtra `shippingCity: "São Paulo"` e apenas pedidos efetivados (`status` em `PAID`, `SHIPPED`, `DELIVERED`), evitando que pedidos cancelados ou pendentes inflem o ranking VIP.
- **Otimização de `$lookup`:** O estágio `$lookup` na coleção `users` é executado **após** `$skip` e `$limit: 10` dentro do ramo `data` do `$facet`, reduzindo as junções de milhares de clientes para exatamente **10 lookups** por página.

### Código do Pipeline

```js
[
  {
    "$match": {
      "shippingCity": "São Paulo",
      "status": {
        "$in": [
          "PAID",
          "SHIPPED",
          "DELIVERED"
        ]
      }
    }
  },
  {
    "$group": {
      "_id": "$userId",
      "totalGastoBruto": {
        "$sum": "$totalAmount"
      },
      "quantidadePedidos": {
        "$sum": 1
      }
    }
  },
  {
    "$sort": {
      "totalGastoBruto": -1
    }
  },
  {
    "$facet": {
      "metadata": [
        {
          "$count": "totalClientesElegiveis"
        },
        {
          "$addFields": {
            "paginaAtual": 1,
            "limitePorPagina": 10,
            "totalPaginas": {
              "$ceil": {
                "$divide": [
                  "$totalClientesElegiveis",
                  10
                ]
              }
            }
          }
        }
      ],
      "data": [
        {
          "$skip": 0
        },
        {
          "$limit": 10
        },
        {
          "$lookup": {
            "from": "users",
            "localField": "_id",
            "foreignField": "_id",
            "as": "usuario"
          }
        },
        {
          "$unwind": "$usuario"
        },
        {
          "$project": {
            "_id": 0,
            "userId": "$_id",
            "nome": "$usuario.name",
            "email": "$usuario.email",
            "totalGasto": {
              "$round": [
                "$totalGastoBruto",
                2
              ]
            },
            "quantidadePedidos": 1
          }
        }
      ]
    }
  }
]
```

### Metadados de Paginação (`metadata`)

```json
{
  "totalClientesElegiveis": 858,
  "paginaAtual": 1,
  "limitePorPagina": 10,
  "totalPaginas": 86
}
```

### Top 10 Clientes VIP — Página 1 (`data`)

| Posição | Nome | E-mail | Total Gasto (R$) | Qtd. Pedidos |
| :---: | :--- | :--- | ---: | ---: |
| 1 | Cliente 673 | cliente673@exemplo.com | R$ 34.422,37 | 23 |
| 2 | Cliente 1207 | cliente1207@exemplo.com | R$ 34.047,40 | 19 |
| 3 | Cliente 1645 | cliente1645@exemplo.com | R$ 33.575,93 | 26 |
| 4 | Cliente 2363 | cliente2363@exemplo.com | R$ 32.297,46 | 19 |
| 5 | Cliente 430 | cliente430@exemplo.com | R$ 31.977,33 | 19 |
| 6 | Cliente 1042 | cliente1042@exemplo.com | R$ 31.888,16 | 17 |
| 7 | Cliente 4350 | cliente4350@exemplo.com | R$ 31.744,55 | 20 |
| 8 | Cliente 1530 | cliente1530@exemplo.com | R$ 31.202,59 | 22 |
| 9 | Cliente 2576 | cliente2576@exemplo.com | R$ 30.371,12 | 16 |
| 10 | Cliente 3297 | cliente3297@exemplo.com | R$ 29.936,88 | 18 |

### JSON Bruto Completo do Ranking VIP

```json
{
  "metadata": {
    "totalClientesElegiveis": 858,
    "paginaAtual": 1,
    "limitePorPagina": 10,
    "totalPaginas": 86
  },
  "data": [
    {
      "quantidadePedidos": 23,
      "userId": "6b0474f2457592851c1feae4",
      "nome": "Cliente 673",
      "email": "cliente673@exemplo.com",
      "totalGasto": 34422.37
    },
    {
      "quantidadePedidos": 19,
      "userId": "6b0474f2457592851c1fecfa",
      "nome": "Cliente 1207",
      "email": "cliente1207@exemplo.com",
      "totalGasto": 34047.4
    },
    {
      "quantidadePedidos": 26,
      "userId": "6b0474f2457592851c1feeb0",
      "nome": "Cliente 1645",
      "email": "cliente1645@exemplo.com",
      "totalGasto": 33575.93
    },
    {
      "quantidadePedidos": 19,
      "userId": "6b0474f2457592851c1ff17e",
      "nome": "Cliente 2363",
      "email": "cliente2363@exemplo.com",
      "totalGasto": 32297.46
    },
    {
      "quantidadePedidos": 19,
      "userId": "6b0474f2457592851c1fe9f1",
      "nome": "Cliente 430",
      "email": "cliente430@exemplo.com",
      "totalGasto": 31977.33
    },
    {
      "quantidadePedidos": 17,
      "userId": "6b0474f2457592851c1fec55",
      "nome": "Cliente 1042",
      "email": "cliente1042@exemplo.com",
      "totalGasto": 31888.16
    },
    {
      "quantidadePedidos": 20,
      "userId": "6b0474f2457592851c1ff941",
      "nome": "Cliente 4350",
      "email": "cliente4350@exemplo.com",
      "totalGasto": 31744.55
    },
    {
      "quantidadePedidos": 22,
      "userId": "6b0474f2457592851c1fee3d",
      "nome": "Cliente 1530",
      "email": "cliente1530@exemplo.com",
      "totalGasto": 31202.59
    },
    {
      "quantidadePedidos": 16,
      "userId": "6b0474f2457592851c1ff253",
      "nome": "Cliente 2576",
      "email": "cliente2576@exemplo.com",
      "totalGasto": 30371.12
    },
    {
      "quantidadePedidos": 18,
      "userId": "6b0474f2457592851c1ff524",
      "nome": "Cliente 3297",
      "email": "cliente3297@exemplo.com",
      "totalGasto": 29936.88
    }
  ]
}
```
