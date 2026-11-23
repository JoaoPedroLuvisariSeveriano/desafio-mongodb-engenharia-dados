# Relatório de Amostra do Banco — Parte 4 (Seed em Lote)

- **Data/Hora da Verificação:** 2026-11-23T17:16:36.457Z
- **Banco de Dados:** `marketplace`

## 1. Contagem Exata de Documentos (`countDocuments`)

| Coleção | Documentos Inseridos | Esperado | Status |
| :--- | :---: | :---: | :---: |
| `products` | 1000 | 1000 | ✅ OK |
| `users` | 5000 | 5000 | ✅ OK |
| `orders` | 100000 | 100000 | ✅ OK |

## 2. Índices Existentes (Comprovação da Ausência de Índices Secundários)

| Coleção | Índices Presentes | Apenas `_id_`? |
| :--- | :--- | :---: |
| `products` | `_id_`: `{"_id":1}` | ✅ Sim |
| `users` | `_id_`: `{"_id":1}` | ✅ Sim |
| `orders` | `_id_`: `{"_id":1}` | ✅ Sim |

## 3. Amostra Real de Documentos (2 por coleção)

### Coleção `products`

```json
[
  {
    "_id": "6b0474f2457592851c1fe45c",
    "sku": "SKU-00001",
    "name": "Produto Exemplo 1",
    "category": "Moda",
    "price": 184.75,
    "stock": 354,
    "sellerId": "SELLER-5",
    "active": true
  },
  {
    "_id": "6b0474f2457592851c1fe45d",
    "sku": "SKU-00002",
    "name": "Produto Exemplo 2",
    "category": "Livros",
    "price": 299.68,
    "stock": 368,
    "sellerId": "SELLER-9",
    "active": false
  }
]
```

### Coleção `users`

```json
[
  {
    "_id": "6b0474f2457592851c1fe844",
    "name": "Cliente 1",
    "email": "cliente1@exemplo.com",
    "city": "Recife",
    "walletBalance": 1124.66,
    "createdAt": "2026-07-03T04:07:45.899Z"
  },
  {
    "_id": "6b0474f2457592851c1fe845",
    "name": "Cliente 2",
    "email": "cliente2@exemplo.com",
    "city": "Porto Alegre",
    "walletBalance": 1701.39,
    "createdAt": "2026-01-09T13:40:32.510Z"
  }
]
```

### Coleção `orders`

```json
[
  {
    "_id": "6b0474f2457592851c1ffbcc",
    "userId": "6b0474f2457592851c1ff7c6",
    "shippingCity": "Belo Horizonte",
    "status": "SHIPPED",
    "items": [
      {
        "productId": "6b0474f2457592851c1fe6bf",
        "sku": "SKU-00612",
        "category": "Casa e Cozinha",
        "unitPrice": 254.33,
        "quantity": 3
      },
      {
        "productId": "6b0474f2457592851c1fe7b3",
        "sku": "SKU-00856",
        "category": "Livros",
        "unitPrice": 493.45,
        "quantity": 1
      },
      {
        "productId": "6b0474f2457592851c1fe6b6",
        "sku": "SKU-00603",
        "category": "Casa e Cozinha",
        "unitPrice": 95.33,
        "quantity": 2
      },
      {
        "productId": "6b0474f2457592851c1fe786",
        "sku": "SKU-00811",
        "category": "Livros",
        "unitPrice": 457.16,
        "quantity": 2
      }
    ],
    "totalAmount": 2361.42,
    "createdAt": "2026-05-31T20:19:25.107Z"
  },
  {
    "_id": "6b0474f2457592851c1ffbcd",
    "userId": "6b0474f2457592851c1ffb3f",
    "shippingCity": "Belo Horizonte",
    "status": "DELIVERED",
    "items": [
      {
        "productId": "6b0474f2457592851c1fe74e",
        "sku": "SKU-00755",
        "category": "Eletrônicos",
        "unitPrice": 319.56,
        "quantity": 3
      },
      {
        "productId": "6b0474f2457592851c1fe7ff",
        "sku": "SKU-00932",
        "category": "Livros",
        "unitPrice": 130.49,
        "quantity": 1
      },
      {
        "productId": "6b0474f2457592851c1fe47e",
        "sku": "SKU-00035",
        "category": "Moda",
        "unitPrice": 70.61,
        "quantity": 1
      }
    ],
    "totalAmount": 1159.78,
    "createdAt": "2026-10-20T08:01:43.034Z"
  }
]
```
