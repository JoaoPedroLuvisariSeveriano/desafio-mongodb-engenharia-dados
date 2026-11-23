# Evidências de Execução — Parte 2 (Testes da API em Memória)

- **Data/Hora da Execução:** 2026-11-23T15:50:54.573Z
- **Base URL:** `http://localhost:3000`
- **Resultado Geral:** Todos os 6 passos validados com sucesso (estoque reduzido de `5` para `3`).

## Resumo das Requisições e Respostas Reais

| Passo | Método | Endpoint | Status HTTP | Destaque |
| :---: | :--- | :--- | :---: | :--- |
| 1 | `POST` | `/usuarios` | `201` | Usuário id=1 (vendedor) |
| 2 | `POST` | `/usuarios` | `201` | Usuário id=2 (comprador) |
| 3 | `POST` | `/produtos` | `201` | Produto id=1, estoque=5 |
| 4 | `GET` | `/produtos` | `200` | 1 item na vitrine, estoque=5 |
| 5 | `POST` | `/pedidos` | `201` | Pedido id=1, valorTotal=500 |
| 6 | `GET` | `/produtos` | `200` | Estoque atualizado para 3 |

## Detalhamento Completo (Payloads e Respostas JSON)

### Passo 1 — Cadastrar vendedor (Loja Tech)

- **Requisição:** `POST http://localhost:3000/usuarios`
- **Status HTTP:** `201`

**Payload Enviado:**
```json
{
  "nome": "Loja Tech",
  "tipo": "vendedor"
}
```

**Resposta Recebida:**
```json
{
  "id": 1,
  "nome": "Loja Tech",
  "tipo": "vendedor"
}
```

### Passo 2 — Cadastrar comprador (João Silva)

- **Requisição:** `POST http://localhost:3000/usuarios`
- **Status HTTP:** `201`

**Payload Enviado:**
```json
{
  "nome": "João Silva",
  "tipo": "comprador"
}
```

**Resposta Recebida:**
```json
{
  "id": 2,
  "nome": "João Silva",
  "tipo": "comprador"
}
```

### Passo 3 — Anunciar produto (Teclado Mecânico)

- **Requisição:** `POST http://localhost:3000/produtos`
- **Status HTTP:** `201`

**Payload Enviado:**
```json
{
  "vendedorId": 1,
  "nome": "Teclado Mecânico",
  "preco": 250,
  "estoque": 5
}
```

**Resposta Recebida:**
```json
{
  "id": 1,
  "vendedorId": 1,
  "nome": "Teclado Mecânico",
  "preco": 250,
  "estoque": 5
}
```

### Passo 4 — Listar vitrine inicial de produtos

- **Requisição:** `GET http://localhost:3000/produtos`
- **Status HTTP:** `200`

**Resposta Recebida:**
```json
[
  {
    "id": 1,
    "vendedorId": 1,
    "nome": "Teclado Mecânico",
    "preco": 250,
    "estoque": 5
  }
]
```

### Passo 5 — Realizar pedido de 2 unidades

- **Requisição:** `POST http://localhost:3000/pedidos`
- **Status HTTP:** `201`

**Payload Enviado:**
```json
{
  "compradorId": 2,
  "produtoId": 1,
  "quantidade": 2
}
```

**Resposta Recebida:**
```json
{
  "id": 1,
  "compradorId": 2,
  "produtoId": 1,
  "quantidade": 2,
  "valorTotal": 500,
  "data": "2026-11-23T15:50:54.569Z"
}
```

### Passo 6 — Confirmar atualização de estoque na vitrine (5 -> 3)

- **Requisição:** `GET http://localhost:3000/produtos`
- **Status HTTP:** `200`

**Resposta Recebida:**
```json
[
  {
    "id": 1,
    "vendedorId": 1,
    "nome": "Teclado Mecânico",
    "preco": 250,
    "estoque": 3
  }
]
```

## Comandos para Reprodução Manual (Terminal / Postman / Insomnia)

```powershell
# Terminal 1: subir a API em memória na porta 3000
cd parte-1-api-memoria
npm install
node index.js

# Terminal 2: executar a suíte automatizada
node parte-2-testes-api/testar-api.js
```

Você também pode importar [`postman_collection.json`](./postman_collection.json) no Postman/Insomnia ou executar as requisições em [`requests.http`](./requests.http).
