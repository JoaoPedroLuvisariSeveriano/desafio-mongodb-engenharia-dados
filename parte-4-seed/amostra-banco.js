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
    console.log(`\n✅ Relatório salvo em: ${outPath}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('❌ Erro ao gerar amostra do banco:', err);
  process.exit(1);
});
