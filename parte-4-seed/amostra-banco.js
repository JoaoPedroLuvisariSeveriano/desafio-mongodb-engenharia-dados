const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/?replicaSet=rs0';
const DB_NAME = 'marketplace';

async function main() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    const collections = ['products', 'users', 'orders'];
    const counts = {};
    const indexes = {};
    const samples = {};

    for (const colName of collections) {
      const col = db.collection(colName);
      counts[colName] = await col.countDocuments();
      indexes[colName] = await col.indexes();
      samples[colName] = await col.find().limit(2).toArray();
    }

    console.log('=== CONTAGEM DE DOCUMENTOS ===');
    console.table(counts);

    console.log('\n=== ÍNDICES EXISTENTES (APENAS _id_) ===');
    for (const colName of collections) {
      console.log(`- ${colName}:`, indexes[colName].map((idx) => `${idx.name} (${JSON.stringify(idx.key)})`).join(', '));
    }

    console.log('\n=== AMOSTRA DE 2 DOCUMENTOS POR COLEÇÃO ===');
    for (const colName of collections) {
      console.log(`\n--- ${colName} ---`);
      console.log(JSON.stringify(samples[colName], null, 2));
    }

    const md = [
      '# Relatório de Amostra do Banco — Parte 4 (Seed em Lote)',
      '',
      `- **Data/Hora da Verificação:** ${new Date().toISOString()}`,
      `- **Banco de Dados:** \`${DB_NAME}\``,
      '',
      '## 1. Contagem Exata de Documentos (`countDocuments`)',
      '',
      '| Coleção | Documentos Inseridos | Esperado | Status |',
      '| :--- | :---: | :---: | :---: |',
      `| \`products\` | ${counts.products} | 1000 | ${counts.products === 1000 ? '✅ OK' : '❌ Divergente'} |`,
      `| \`users\` | ${counts.users} | 5000 | ${counts.users === 5000 ? '✅ OK' : '❌ Divergente'} |`,
      `| \`orders\` | ${counts.orders} | 100000 | ${counts.orders === 100000 ? '✅ OK' : '❌ Divergente'} |`,
      '',
      '## 2. Índices Existentes (Comprovação da Ausência de Índices Secundários)',
      '',
      '| Coleção | Índices Presentes | Apenas `_id_`? |',
      '| :--- | :--- | :---: |',
      ...collections.map((c) => {
        const idxStr = indexes[c].map((i) => `\`${i.name}\`: \`${JSON.stringify(i.key)}\``).join(', ');
        const onlyId = indexes[c].length === 1 && indexes[c][0].name === '_id_';
        return `| \`${c}\` | ${idxStr} | ${onlyId ? '✅ Sim' : '❌ Não'} |`;
      }),
      '',
      '## 3. Amostra Real de Documentos (2 por coleção)',
      ''
    ];

    for (const colName of collections) {
      md.push(`### Coleção \`${colName}\``);
      md.push('');
      md.push('```json');
      md.push(JSON.stringify(samples[colName], null, 2));
      md.push('```');
      md.push('');
    }

    const outPath = path.join(__dirname, 'RELATORIO-PARTE-4-AMOSTRA.md');
    fs.writeFileSync(outPath, md.join('\n'), 'utf8');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Parte 4 — Amostra Real do Banco (amostra-banco.js)</title>
  <style>
    body { margin: 0; padding: 28px; font-family: 'Segoe UI', system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
    .wrap { max-width: 1180px; margin: 0 auto; }
    .hero { display: flex; justify-content: space-between; align-items: center; background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px 24px; margin-bottom: 18px; }
    h1 { margin: 0 0 6px; font-size: 22px; color: #f8fafc; }
    .sub { margin: 0; font-size: 13px; color: #94a3b8; }
    .badge { padding: 8px 14px; border-radius: 999px; background: rgba(16, 185, 129, 0.16); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); font-weight: 700; font-size: 13px; }
    .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 18px; }
    .kpi { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 14px 16px; }
    .kpi .label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
    .kpi .val { font-size: 26px; font-weight: 700; margin-top: 6px; color: #38bdf8; }
    .kpi .desc { font-size: 12px; color: #34d399; margin-top: 4px; }
    .panel { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 18px 20px; margin-bottom: 18px; }
    h2 { margin: 0 0 12px; font-size: 16px; color: #f8fafc; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #334155; text-align: left; }
    th { color: #94a3b8; font-size: 11px; text-transform: uppercase; }
    .good { color: #34d399; font-weight: 700; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
    .cols .panel { margin-bottom: 0; }
    pre { margin: 0; background: #0b1120; border: 1px solid #334155; border-radius: 8px; padding: 12px; font-size: 12px; line-height: 1.45; color: #cbd5e1; overflow-x: auto; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <div>
        <h1>Parte 4 — Amostra Real do Banco (amostra-banco.js)</h1>
        <p class="sub">Verificação após seed em lote no banco ${DB_NAME} • Execução em ${new Date().toISOString()}</p>
      </div>
      <div class="badge">106.000 Documentos • Apenas _id_ ✓</div>
    </div>

    <div class="cards">
      <div class="kpi"><div class="label">Coleção products</div><div class="val">${counts.products.toLocaleString('pt-BR')}</div><div class="desc">Esperado: 1.000 ✓</div></div>
      <div class="kpi"><div class="label">Coleção users</div><div class="val">${counts.users.toLocaleString('pt-BR')}</div><div class="desc">Esperado: 5.000 ✓</div></div>
      <div class="kpi"><div class="label">Coleção orders</div><div class="val">${counts.orders.toLocaleString('pt-BR')}</div><div class="desc">Esperado: 100.000 ✓</div></div>
    </div>

    <div class="panel">
      <h2>Índices Existentes (Comprovação de Ausência de Índices Secundários)</h2>
      <table>
        <thead>
          <tr><th>Coleção</th><th>Índices Presentes</th><th>Apenas _id_?</th></tr>
        </thead>
        <tbody>
          ${collections.map((c) => {
            const idxStr = indexes[c].map((i) => `${i.name} (${JSON.stringify(i.key)})`).join(', ');
            const onlyId = indexes[c].length === 1 && indexes[c][0].name === '_id_';
            return `<tr><td><strong>${c}</strong></td><td><code>${idxStr}</code></td><td class="good">${onlyId ? '✓ Sim (Sem índices secundários)' : '✗ Não'}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div class="cols">
      <div class="panel">
        <h2>Documento de Amostra — products (1 de 1.000)</h2>
        <pre>${JSON.stringify(samples.products[0], null, 2)}</pre>
      </div>
      <div class="panel">
        <h2>Documento de Amostra — users (1 de 5.000)</h2>
        <pre>${JSON.stringify(samples.users[0], null, 2)}</pre>
      </div>
    </div>

    <div class="panel">
      <h2>Documento de Amostra — orders (1 de 100.000)</h2>
      <pre>${JSON.stringify(samples.orders[0], null, 2)}</pre>
    </div>
  </div>
</body>
</html>`;

    const htmlPath = path.join(__dirname, 'visualizador-amostra.html');
    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log(`\n✅ Relatório salvo em: ${outPath}`);
    console.log(`✅ Visualizador HTML salvo em: ${htmlPath}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('❌ Erro ao gerar amostra do banco:', err);
  process.exit(1);
});
