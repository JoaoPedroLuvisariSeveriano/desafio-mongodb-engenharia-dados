# Evidências de Execução — Parte 3 (Persistência com MongoDB e Mongoose)

- **Data/Hora da Execução:** 2026-11-23T16:01:31.067Z
- **API Base URL:** `http://localhost:3000`
- **Comprovações obtidas:**
  - `_id` (ObjectId) gerados pelo MongoDB para `usuarios`, `produtos` e `pedidos`.
  - `GET /produtos` retorna `vendedorId` populado via `.populate('vendedorId', 'nome')`: `{ "_id": "6b04635a92316f2295d07e34", "nome": "Loja Tech" }`.
  - Persistência confirmada após pedido de 2 unidades: estoque atualizado de `5` para `3`.

## Detalhamento das Operações Executadas

### Passo 1 — Cadastrar vendedor no MongoDB

- **Requisição:** `POST http://localhost:3000/usuarios`
- **Status HTTP:** `201`

**Payload Enviado:**
```json
{
  "nome": "Loja Tech",
  "tipo": "vendedor"
}
```

**Resposta JSON Real (MongoDB + Mongoose):**
```json
{
  "nome": "Loja Tech",
  "tipo": "vendedor",
  "_id": "6b04635a92316f2295d07e34"
}
```

### Passo 2 — Cadastrar comprador no MongoDB

- **Requisição:** `POST http://localhost:3000/usuarios`
- **Status HTTP:** `201`

**Payload Enviado:**
```json
{
  "nome": "João Silva",
  "tipo": "comprador"
}
```

**Resposta JSON Real (MongoDB + Mongoose):**
```json
{
  "nome": "João Silva",
  "tipo": "comprador",
  "_id": "6b04635a92316f2295d07e36"
}
```

### Passo 3 — Anunciar produto vinculado ao ObjectId do vendedor

- **Requisição:** `POST http://localhost:3000/produtos`
- **Status HTTP:** `201`

**Payload Enviado:**
```json
{
  "vendedorId": "6b04635a92316f2295d07e34",
  "nome": "Teclado Mecânico",
  "preco": 250,
  "estoque": 5
}
```

**Resposta JSON Real (MongoDB + Mongoose):**
```json
{
  "vendedorId": "6b04635a92316f2295d07e34",
  "nome": "Teclado Mecânico",
  "preco": 250,
  "estoque": 5,
  "_id": "6b04635b92316f2295d07e39"
}
```

### Passo 4 — Listar vitrine com .populate("vendedorId", "nome")

- **Requisição:** `GET http://localhost:3000/produtos`
- **Status HTTP:** `200`

**Resposta JSON Real (MongoDB + Mongoose):**
```json
[
  {
    "_id": "6b04635b92316f2295d07e39",
    "vendedorId": {
      "_id": "6b04635a92316f2295d07e34",
      "nome": "Loja Tech"
    },
    "nome": "Teclado Mecânico",
    "preco": 250,
    "estoque": 5
  }
]
```

### Passo 5 — Realizar pedido persistido em MongoDB

- **Requisição:** `POST http://localhost:3000/pedidos`
- **Status HTTP:** `201`

**Payload Enviado:**
```json
{
  "compradorId": "6b04635a92316f2295d07e36",
  "produtoId": "6b04635b92316f2295d07e39",
  "quantidade": 2
}
```

**Resposta JSON Real (MongoDB + Mongoose):**
```json
{
  "compradorId": "6b04635a92316f2295d07e36",
  "produtoId": "6b04635b92316f2295d07e39",
  "quantidade": 2,
  "valorTotal": 500,
  "_id": "6b04635b92316f2295d07e40",
  "data": "2026-11-23T16:01:31.050Z"
}
```

### Passo 6 — Confirmar estoque persistido atualizado para 3 + populate

- **Requisição:** `GET http://localhost:3000/produtos`
- **Status HTTP:** `200`

**Resposta JSON Real (MongoDB + Mongoose):**
```json
[
  {
    "_id": "6b04635b92316f2295d07e39",
    "vendedorId": {
      "_id": "6b04635a92316f2295d07e34",
      "nome": "Loja Tech"
    },
    "nome": "Teclado Mecânico",
    "preco": 250,
    "estoque": 3
  }
]
```
