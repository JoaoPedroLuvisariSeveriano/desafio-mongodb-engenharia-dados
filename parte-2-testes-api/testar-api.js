const fs = require('fs');
const path = require('path');
const assert = require('assert');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

async function executarRequisicao(ordem, titulo, method, endpoint, body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body !== null) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const responseBody = await response.json();

  console.log(`\n[${ordem}] ${titulo}`);
  console.log(`-> ${method} ${url}`);
  if (body !== null) {
    console.log(`-> Payload: ${JSON.stringify(body)}`);
  }
  console.log(`<- Status: ${response.status}`);
  console.log(`<- Resposta: ${JSON.stringify(responseBody, null, 2)}`);

  return { ordem, titulo, method, url, endpoint, payload: body, status: response.status, response: responseBody };
}

async function main() {
  const registros = [];

  const r1 = await executarRequisicao(
    1,
    'Cadastrar vendedor (Loja Tech)',
    'POST',
    '/usuarios',
    { nome: 'Loja Tech', tipo: 'vendedor' }
  );
  assert.strictEqual(r1.status, 201);
  assert.strictEqual(r1.response.id, 1);
  assert.strictEqual(r1.response.tipo, 'vendedor');
  registros.push(r1);

  const r2 = await executarRequisicao(
    2,
    'Cadastrar comprador (João Silva)',
    'POST',
    '/usuarios',
    { nome: 'João Silva', tipo: 'comprador' }
  );
  assert.strictEqual(r2.status, 201);
  assert.strictEqual(r2.response.id, 2);
  assert.strictEqual(r2.response.tipo, 'comprador');
  registros.push(r2);

  const r3 = await executarRequisicao(
    3,
    'Anunciar produto (Teclado Mecânico)',
    'POST',
    '/produtos',
    { vendedorId: 1, nome: 'Teclado Mecânico', preco: 250, estoque: 5 }
  );
  assert.strictEqual(r3.status, 201);
  assert.strictEqual(r3.response.id, 1);
  assert.strictEqual(r3.response.estoque, 5);
  registros.push(r3);

  const r4 = await executarRequisicao(
    4,
    'Listar vitrine inicial de produtos',
    'GET',
    '/produtos'
  );
  assert.strictEqual(r4.status, 200);
  assert.ok(Array.isArray(r4.response) && r4.response.length === 1);
  assert.strictEqual(r4.response[0].estoque, 5);
  registros.push(r4);

  const r5 = await executarRequisicao(
    5,
    'Realizar pedido de 2 unidades',
    'POST',
    '/pedidos',
    { compradorId: 2, produtoId: 1, quantidade: 2 }
  );
  assert.strictEqual(r5.status, 201);
  assert.strictEqual(r5.response.valorTotal, 500);
  assert.strictEqual(r5.response.quantidade, 2);
  registros.push(r5);

  const r6 = await executarRequisicao(
    6,
    'Confirmar atualização de estoque na vitrine (5 -> 3)',
    'GET',
    '/produtos'
  );
  assert.strictEqual(r6.status, 200);
  assert.ok(Array.isArray(r6.response) && r6.response.length === 1);
  assert.strictEqual(r6.response[0].estoque, 3);
  registros.push(r6);

  const linhas = [
    '# Evidências de Execução — Parte 2 (Testes da API em Memória)',
    '',
    `- **Data/Hora da Execução:** ${new Date().toISOString()}`,
    `- **Base URL:** \`${BASE_URL}\``,
    `- **Resultado Geral:** Todos os 6 passos validados com sucesso (estoque reduzido de \`5\` para \`3\`).`,
    '',
    '## Resumo das Requisições e Respostas Reais',
    '',
    '| Passo | Método | Endpoint | Status HTTP | Destaque |',
    '| :---: | :--- | :--- | :---: | :--- |',
    ...registros.map((r) => {
      let destaque = '-';
      if (r.ordem === 1) destaque = `Usuário id=${r.response.id} (${r.response.tipo})`;
      if (r.ordem === 2) destaque = `Usuário id=${r.response.id} (${r.response.tipo})`;
      if (r.ordem === 3) destaque = `Produto id=${r.response.id}, estoque=${r.response.estoque}`;
      if (r.ordem === 4) destaque = `${r.response.length} item na vitrine, estoque=${r.response[0].estoque}`;
      if (r.ordem === 5) destaque = `Pedido id=${r.response.id}, valorTotal=${r.response.valorTotal}`;
      if (r.ordem === 6) destaque = `Estoque atualizado para ${r.response[0].estoque}`;
      return `| ${r.ordem} | \`${r.method}\` | \`${r.endpoint}\` | \`${r.status}\` | ${destaque} |`;
    }),
    '',
    '## Detalhamento Completo (Payloads e Respostas JSON)',
    ''
  ];

  for (const r of registros) {
    linhas.push(`### Passo ${r.ordem} — ${r.titulo}`);
    linhas.push('');
    linhas.push(`- **Requisição:** \`${r.method} ${r.url}\``);
    linhas.push(`- **Status HTTP:** \`${r.status}\``);
    if (r.payload !== null) {
      linhas.push('');
      linhas.push('**Payload Enviado:**');
      linhas.push('```json');
      linhas.push(JSON.stringify(r.payload, null, 2));
      linhas.push('```');
    }
    linhas.push('');
    linhas.push('**Resposta Recebida:**');
    linhas.push('```json');
    linhas.push(JSON.stringify(r.response, null, 2));
    linhas.push('```');
    linhas.push('');
  }

  linhas.push('## Comandos para Reprodução Manual (Terminal / Postman / Insomnia)');
  linhas.push('');
  linhas.push('```powershell');
  linhas.push('# Terminal 1: subir a API em memória na porta 3000');
  linhas.push('cd parte-1-api-memoria');
  linhas.push('npm install');
  linhas.push('node index.js');
  linhas.push('');
  linhas.push('# Terminal 2: executar a suíte automatizada');
  linhas.push('node parte-2-testes-api/testar-api.js');
  linhas.push('```');
  linhas.push('');
  linhas.push('Você também pode importar [`postman_collection.json`](./postman_collection.json) no Postman/Insomnia ou executar as requisições em [`requests.http`](./requests.http).');
  linhas.push('');

  const outPath = path.join(__dirname, 'EVIDENCIAS-PARTE-2.md');
  fs.writeFileSync(outPath, linhas.join('\n'), 'utf8');
  console.log(`\n✅ Todos os testes passaram! Evidências salvas em: ${outPath}`);
}

main().catch((err) => {
  console.error('❌ Falha nos testes da Parte 2:', err);
  process.exit(1);
});
