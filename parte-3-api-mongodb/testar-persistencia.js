require('dotenv').config();
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const mongoose = require('mongoose');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/marketplace';

async function requisicao(ordem, titulo, method, endpoint, body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== null) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json();

  console.log(`\n[${ordem}] ${titulo} -> HTTP ${res.status}`);
  console.log(JSON.stringify(data, null, 2));
  return { ordem, titulo, method, url, endpoint, payload: body, status: res.status, response: data };
}

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  await Promise.all([
    db.collection('usuarios').deleteMany({}),
    db.collection('produtos').deleteMany({}),
    db.collection('pedidos').deleteMany({})
  ]);
  await mongoose.disconnect();

  const passos = [];

  const p1 = await requisicao(1, 'Cadastrar vendedor no MongoDB', 'POST', '/usuarios', {
    nome: 'Loja Tech',
    tipo: 'vendedor'
  });
  assert.strictEqual(p1.status, 201);
  assert.ok(mongoose.Types.ObjectId.isValid(p1.response._id));
  passos.push(p1);

  const p2 = await requisicao(2, 'Cadastrar comprador no MongoDB', 'POST', '/usuarios', {
    nome: 'João Silva',
    tipo: 'comprador'
  });
  assert.strictEqual(p2.status, 201);
  assert.ok(mongoose.Types.ObjectId.isValid(p2.response._id));
  passos.push(p2);

  const p3 = await requisicao(3, 'Anunciar produto vinculado ao ObjectId do vendedor', 'POST', '/produtos', {
    vendedorId: p1.response._id,
    nome: 'Teclado Mecânico',
    preco: 250,
    estoque: 5
  });
  assert.strictEqual(p3.status, 201);
  assert.ok(mongoose.Types.ObjectId.isValid(p3.response._id));
  assert.strictEqual(p3.response.vendedorId, p1.response._id);
  passos.push(p3);

  const p4 = await requisicao(4, 'Listar vitrine com .populate("vendedorId", "nome")', 'GET', '/produtos');
  assert.strictEqual(p4.status, 200);
  assert.strictEqual(p4.response.length, 1);
  assert.strictEqual(p4.response[0].vendedorId.nome, 'Loja Tech');
  assert.strictEqual(p4.response[0].estoque, 5);
  passos.push(p4);

  const p5 = await requisicao(5, 'Realizar pedido persistido em MongoDB', 'POST', '/pedidos', {
    compradorId: p2.response._id,
    produtoId: p3.response._id,
    quantidade: 2
  });
  assert.strictEqual(p5.status, 201);
  assert.ok(mongoose.Types.ObjectId.isValid(p5.response._id));
  assert.strictEqual(p5.response.valorTotal, 500);
  passos.push(p5);

  const p6 = await requisicao(6, 'Confirmar estoque persistido atualizado para 3 + populate', 'GET', '/produtos');
  assert.strictEqual(p6.status, 200);
  assert.strictEqual(p6.response[0].estoque, 3);
  assert.strictEqual(p6.response[0].vendedorId.nome, 'Loja Tech');
  passos.push(p6);

  const linhas = [
    '# Evidências de Execução — Parte 3 (Persistência com MongoDB e Mongoose)',
    '',
    `- **Data/Hora da Execução:** ${new Date().toISOString()}`,
    `- **API Base URL:** \`${BASE_URL}\``,
    '- **Comprovações obtidas:**',
    `  - \`_id\` (ObjectId) gerados pelo MongoDB para \`usuarios\`, \`produtos\` e \`pedidos\`.`,
    `  - \`GET /produtos\` retorna \`vendedorId\` populado via \`.populate('vendedorId', 'nome')\`: \`{ "_id": "${p1.response._id}", "nome": "Loja Tech" }\`.`,
    '  - Persistência confirmada após pedido de 2 unidades: estoque atualizado de `5` para `3`.',
    '',
    '## Detalhamento das Operações Executadas',
    ''
  ];

  for (const p of passos) {
    linhas.push(`### Passo ${p.ordem} — ${p.titulo}`);
    linhas.push('');
    linhas.push(`- **Requisição:** \`${p.method} ${p.url}\``);
    linhas.push(`- **Status HTTP:** \`${p.status}\``);
    if (p.payload !== null) {
      linhas.push('');
      linhas.push('**Payload Enviado:**');
      linhas.push('```json');
      linhas.push(JSON.stringify(p.payload, null, 2));
      linhas.push('```');
    }
    linhas.push('');
    linhas.push('**Resposta JSON Real (MongoDB + Mongoose):**');
    linhas.push('```json');
    linhas.push(JSON.stringify(p.response, null, 2));
    linhas.push('```');
    linhas.push('');
  }

  const outPath = path.join(__dirname, 'EVIDENCIAS-PARTE-3.md');
  fs.writeFileSync(outPath, linhas.join('\n'), 'utf8');
  console.log(`\n✅ Evidências da Parte 3 salvas em: ${outPath}`);
}

main().catch((err) => {
  console.error('❌ Erro nos testes da Parte 3:', err);
  process.exit(1);
});
