# Relatório da Tarefa 4 — Consistência e Transações ACID

- **Data/Hora da Execução:** 2026-11-23T17:35:44.674Z
- **Topologia:** MongoDB 7 Replica Set (`rs0`) com `client.startSession()`, `startTransaction()`, `commitTransaction()` e `abortTransaction()`.
- **Isolamento e Atomicidade:** Todas as operações de leitura e escrita (`products`, `users`, `orders`) recebem `{ session }`, garantindo que débitos parciais nunca sejam visíveis nem persistidos em caso de falha.

## Resumo Comparativo (Estado ANTES × DEPOIS)

| Cenário | Ação | Resultado | Estoque (Antes → Depois) | Saldo (Antes → Depois) | Pedidos (Antes → Depois) |
| :---: | :--- | :---: | :---: | :---: | :---: |
| 1 | Sucesso / Commit Transacional | `COMMITTED` | `10 → 8` | `R$ 500.00 → R$ 200.00` | `100000 → 100001` |
| 2 | Falha de Validação (Saldo Insuficiente) / Rollback | `ABORTED (Rollback)` | `8 → 8` | `R$ 200.00 → R$ 200.00` | `100001 → 100001` |
| 3 | Erro Simulado Pós-Débito de Estoque / Rollback ACID | `ABORTED (Rollback ACID)` | `8 → 8` | `R$ 200.00 → R$ 200.00` | `100001 → 100001` |

## Evidências Detalhadas por Cenário

### Cenário 1 — Sucesso / Commit Transacional

- **Operação:** Checkout de 2 unidades (R$ 150,00 cada = R$ 300,00)
- **Desfecho da Transação:** `COMMITTED`
- **Comprovação:** Pedido 6b04797003708b85888b08ba inserido com status PAID e statusHistory. Estoque: 10 -> 8. Saldo: R$ 500.00 -> R$ 200.00.

```json
{
  "antes": {
    "productStock": 10,
    "productPrice": 150,
    "walletBalance": 500,
    "totalOrders": 100000
  },
  "depois": {
    "productStock": 8,
    "productPrice": 150,
    "walletBalance": 200,
    "totalOrders": 100001
  }
}
```

### Cenário 2 — Falha de Validação (Saldo Insuficiente) / Rollback

- **Operação:** Tentativa de checkout de 3 unidades (R$ 450,00) com saldo de R$ 200,00
- **Desfecho da Transação:** `ABORTED (Rollback)`
- **Comprovação:** Erro capturado: "Saldo insuficiente para Cliente Teste ACID: disponível R$ 200.00, necessário R$ 450.00.". Estado do banco permaneceu 100% intacto.

```json
{
  "antes": {
    "productStock": 8,
    "productPrice": 150,
    "walletBalance": 200,
    "totalOrders": 100001
  },
  "depois": {
    "productStock": 8,
    "productPrice": 150,
    "walletBalance": 200,
    "totalOrders": 100001
  }
}
```

### Cenário 3 — Erro Simulado Pós-Débito de Estoque / Rollback ACID

- **Operação:** Checkout de 1 unidade com falha forçada após $inc no estoque e antes do débito na carteira
- **Desfecho da Transação:** `ABORTED (Rollback ACID)`
- **Comprovação:** Erro capturado: "ERRO SIMULADO NO MEIO DA TRANSAÇÃO: falha inesperada após debitar estoque e antes de debitar a carteira!". Consulta posterior comprovou que o estoque voltou exatamente para 8, saldo permaneceu em R$ 200.00 e totalOrders permaneceu em 100001.

```json
{
  "antes": {
    "productStock": 8,
    "productPrice": 150,
    "walletBalance": 200,
    "totalOrders": 100001
  },
  "depois": {
    "productStock": 8,
    "productPrice": 150,
    "walletBalance": 200,
    "totalOrders": 100001
  }
}
```
