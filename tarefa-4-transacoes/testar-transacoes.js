const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { MongoClient, ObjectId } = require('mongodb');
const { realizarCheckout } = require('./checkout-transacional');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/?replicaSet=rs0';
const DB_NAME = 'marketplace';

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function obterSnapshot(db, productId, userId) {
  const [produto, usuario, totalOrders] = await Promise.all([
    db.collection('products').findOne({ _id: productId }, { projection: { sku: 1, name: 1, price: 1, stock: 1 } }),
    db.collection('users').findOne({ _id: userId }, { projection: { name: 1, city: 1, walletBalance: 1 } }),
    db.collection('orders').countDocuments()
  ]);

  return {
    productStock: produto.stock,
    productPrice: produto.price,
    walletBalance: Number(usuario.walletBalance.toFixed(2)),
    totalOrders
  };
}

async function main() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    // Prepara documentos dedicados e determinísticos para os 3 cenários (sem afetar usuários/produtos reais existentes)
    const testProductId = new ObjectId();
    const testUserId = new ObjectId();

    await db.collection('products').insertOne({
      _id: testProductId,
      sku: 'SKU-ACID-01',
      name: 'Produto Teste Transacional ACID',
      category: 'Eletrônicos',
      price: 150.0,
      stock: 10,
      sellerId: 'SELLER-1',
      active: true
    });

    await db.collection('users').insertOne({
      _id: testUserId,
      name: 'Cliente Teste ACID',
      email: 'acid.teste@exemplo.com',
      city: 'São Paulo',
      walletBalance: 500.0,
      createdAt: new Date()
    });

    const relatoriosCenarios = [];

    // =========================================================================
    // CENÁRIO 1: Sucesso / Commit
    // =========================================================================
    const c1Antes = await obterSnapshot(db, testProductId, testUserId);
    const c1Resultado = await realizarCheckout(client, {
      userId: testUserId,
      productId: testProductId,
      quantity: 2
    });
    const c1Depois = await obterSnapshot(db, testProductId, testUserId);

    assert.strictEqual(c1Resultado.ok, true);
    assert.strictEqual(c1Depois.productStock, c1Antes.productStock - 2);
    assert.strictEqual(c1Depois.walletBalance, Number((c1Antes.walletBalance - 300).toFixed(2)));
    assert.strictEqual(c1Depois.totalOrders, c1Antes.totalOrders + 1);

    const pedidoCriado = await db.collection('orders').findOne({ _id: c1Resultado.orderId });
    assert.strictEqual(pedidoCriado.status, 'PAID');
    assert.ok(Array.isArray(pedidoCriado.statusHistory) && pedidoCriado.statusHistory.length === 1);

    relatoriosCenarios.push({
      numero: 1,
      titulo: 'Sucesso / Commit Transacional',
      acao: 'Checkout de 2 unidades (R$ 150,00 cada = R$ 300,00)',
      status: 'COMMITTED',
      antes: c1Antes,
      depois: c1Depois,
      detalhe: `Pedido ${c1Resultado.orderId} inserido com status PAID e statusHistory. Estoque: ${c1Antes.productStock} -> ${c1Depois.productStock}. Saldo: R$ ${c1Antes.walletBalance.toFixed(2)} -> R$ ${c1Depois.walletBalance.toFixed(2)}.`
    });

    // =========================================================================
    // CENÁRIO 2: Falha de Validação (Saldo Insuficiente) / Rollback
    // =========================================================================
    const c2Antes = await obterSnapshot(db, testProductId, testUserId);
    let c2Erro = null;
    try {
      // Saldo restante é R$ 200,00; 3 unidades custam R$ 450,00 -> deve falhar e abortar
      await realizarCheckout(client, {
        userId: testUserId,
        productId: testProductId,
        quantity: 3
      });
    } catch (err) {
      c2Erro = err.message;
    }
    const c2Depois = await obterSnapshot(db, testProductId, testUserId);

    assert.ok(c2Erro && c2Erro.includes('Saldo insuficiente'));
    assert.deepStrictEqual(c2Depois, c2Antes);

    relatoriosCenarios.push({
      numero: 2,
      titulo: 'Falha de Validação (Saldo Insuficiente) / Rollback',
      acao: 'Tentativa de checkout de 3 unidades (R$ 450,00) com saldo de R$ 200,00',
      status: 'ABORTED (Rollback)',
      antes: c2Antes,
      depois: c2Depois,
      detalhe: `Erro capturado: "${c2Erro}". Estado do banco permaneceu 100% intacto.`
    });

    // =========================================================================
    // CENÁRIO 3: Erro Simulado no Meio da Transação / Rollback ACID
    // =========================================================================
    const c3Antes = await obterSnapshot(db, testProductId, testUserId);
    let c3Erro = null;
    try {
      // 1 unidade custa R$ 150,00 (passa validações, debita estoque 8->7 na transação, mas falha antes da carteira!)
      await realizarCheckout(client, {
        userId: testUserId,
        productId: testProductId,
        quantity: 1,
        simularErroAposEstoque: true
      });
    } catch (err) {
      c3Erro = err.message;
    }
    const c3Depois = await obterSnapshot(db, testProductId, testUserId);

    assert.ok(c3Erro && c3Erro.includes('ERRO SIMULADO NO MEIO DA TRANSAÇÃO'));
    assert.deepStrictEqual(c3Depois, c3Antes);

    relatoriosCenarios.push({
      numero: 3,
      titulo: 'Erro Simulado Pós-Débito de Estoque / Rollback ACID',
      acao: 'Checkout de 1 unidade com falha forçada após $inc no estoque e antes do débito na carteira',
      status: 'ABORTED (Rollback ACID)',
      antes: c3Antes,
      depois: c3Depois,
      detalhe: `Erro capturado: "${c3Erro}". Consulta posterior comprovou que o estoque voltou exatamente para ${c3Depois.productStock}, saldo permaneceu em R$ ${c3Depois.walletBalance.toFixed(2)} e totalOrders permaneceu em ${c3Depois.totalOrders}.`
    });

    console.log('\n=== RESUMO DOS 3 CENÁRIOS DE TRANSAÇÕES ACID ===');
    for (const c of relatoriosCenarios) {
      console.log(`\n[Cenário ${c.numero}] ${c.titulo} -> ${c.status}`);
      console.log('  ANTES :', c.antes);
      console.log('  DEPOIS:', c.depois);
      console.log('  DETALHE:', c.detalhe);
    }

    // Limpa registros sintéticos de teste para não poluir dados do seed se re-executado
    await db.collection('orders').deleteOne({ _id: c1Resultado.orderId });
    await db.collection('products').deleteOne({ _id: testProductId });
    await db.collection('users').deleteOne({ _id: testUserId });

    const md = [
      '# Relatório da Tarefa 4 — Consistência e Transações ACID',
      '',
      `- **Data/Hora da Execução:** ${new Date().toISOString()}`,
      '- **Topologia:** MongoDB 7 Replica Set (`rs0`) com `client.startSession()`, `startTransaction()`, `commitTransaction()` e `abortTransaction()`.',
      '- **Isolamento e Atomicidade:** Todas as operações de leitura e escrita (`products`, `users`, `orders`) recebem `{ session }`, garantindo que débitos parciais nunca sejam visíveis nem persistidos em caso de falha.',
      '',
      '## Resumo Comparativo (Estado ANTES × DEPOIS)',
      '',
      '| Cenário | Ação | Resultado | Estoque (Antes → Depois) | Saldo (Antes → Depois) | Pedidos (Antes → Depois) |',
      '| :---: | :--- | :---: | :---: | :---: | :---: |',
      ...relatoriosCenarios.map((c) =>
        `| ${c.numero} | ${c.titulo} | \`${c.status}\` | \`${c.antes.productStock} → ${c.depois.productStock}\` | \`R$ ${c.antes.walletBalance.toFixed(2)} → R$ ${c.depois.walletBalance.toFixed(2)}\` | \`${c.antes.totalOrders} → ${c.depois.totalOrders}\` |`
      ),
      '',
      '## Evidências Detalhadas por Cenário',
      ''
    ];

    for (const c of relatoriosCenarios) {
      md.push(`### Cenário ${c.numero} — ${c.titulo}`);
      md.push('');
      md.push(`- **Operação:** ${c.acao}`);
      md.push(`- **Desfecho da Transação:** \`${c.status}\``);
      md.push(`- **Comprovação:** ${c.detalhe}`);
      md.push('');
      md.push('```json');
      md.push(JSON.stringify({ antes: c.antes, depois: c.depois }, null, 2));
      md.push('```');
      md.push('');
    }

    const mdPath = path.join(__dirname, 'RELATORIO-TAREFA-4.md');
    fs.writeFileSync(mdPath, md.join('\n'), 'utf8');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Tarefa 4 — Transações ACID (Commit e Rollback)</title>
  <style>
    body { margin: 0; padding: 28px; font-family: 'Segoe UI', system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
    .wrap { max-width: 1180px; margin: 0 auto; }
    .hero { display: flex; justify-content: space-between; align-items: center; background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px 24px; margin-bottom: 18px; }
    h1 { margin: 0 0 6px; font-size: 22px; color: #f8fafc; }
    .sub { margin: 0; font-size: 13px; color: #94a3b8; }
    .badge { padding: 8px 14px; border-radius: 999px; background: rgba(16, 185, 129, 0.16); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); font-weight: 700; font-size: 13px; }
    .grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 18px 20px; }
    .card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .card-head h2 { margin: 0; font-size: 16px; color: #f8fafc; }
    .pill-ok { padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; background: rgba(16, 185, 129, 0.18); color: #34d399; }
    .pill-rb { padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; background: rgba(245, 158, 11, 0.18); color: #fbbf24; }
    .desc { font-size: 13px; color: #cbd5e1; margin-bottom: 12px; }
    .diff { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    pre { margin: 0; background: #0b1120; border: 1px solid #334155; border-radius: 8px; padding: 12px; font-size: 12px; line-height: 1.45; color: #cbd5e1; }
    .lbl { font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <div>
        <h1>Tarefa 4 — Checkout Transacional ACID no MongoDB (Replica Set rs0)</h1>
        <p class="sub">Validação real de commitTransaction() e abortTransaction() com estado ANTES × DEPOIS</p>
      </div>
      <div class="badge">3/3 Cenários ACID Validados ✓</div>
    </div>
    <div class="grid">
      ${relatoriosCenarios.map((c) => `
        <div class="card">
          <div class="card-head">
            <h2>Cenário ${c.numero} — ${escapeHtml(c.titulo)}</h2>
            <span class="${c.numero === 1 ? 'pill-ok' : 'pill-rb'}">${escapeHtml(c.status)}</span>
          </div>
          <div class="desc"><strong>Operação:</strong> ${escapeHtml(c.acao)}<br/><strong>Resultado:</strong> ${escapeHtml(c.detalhe)}</div>
          <div class="diff">
            <div><div class="lbl">Estado ANTES da Transação</div><pre>${JSON.stringify(c.antes, null, 2)}</pre></div>
            <div><div class="lbl">Estado DEPOIS da Transação</div><pre>${JSON.stringify(c.depois, null, 2)}</pre></div>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>`;

    const htmlPath = path.join(__dirname, 'visualizador-transacoes.html');
    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log(`\n✅ Relatório salvo em: ${mdPath}`);
    console.log(`✅ Visualizador HTML salvo em: ${htmlPath}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('❌ Erro nos testes de transação ACID:', err);
  process.exit(1);
});
