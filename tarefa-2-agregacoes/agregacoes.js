const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/?replicaSet=rs0';
const DB_NAME = 'marketplace';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function main() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const ordersCol = db.collection('orders');

    const noventaDiasAtras = new Date(Date.now() - 90 * 86400000);
    const statusEfetivados = ['PAID', 'SHIPPED', 'DELIVERED'];

    // Pipeline 1: Relatório de Faturamento por Categoria (últimos 90 dias)
    const pipelineFaturamento = [
      {
        $match: {
          status: { $in: statusEfetivados },
          createdAt: { $gte: noventaDiasAtras }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.category',
          faturamentoBruto: {
            $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] }
          },
          quantidadeItensVendidos: { $sum: '$items.quantity' }
        }
      },
      {
        $project: {
          _id: 0,
          categoria: '$_id',
          faturamentoTotal: { $round: ['$faturamentoBruto', 2] },
          quantidadeItensVendidos: 1
        }
      },
      { $sort: { faturamentoTotal: -1 } }
    ];

    const t0 = Date.now();
    const faturamentoPorCategoria = await ordersCol.aggregate(pipelineFaturamento).toArray();
    const tempoPipeline1Ms = Date.now() - t0;

    // Pipeline 2: Ranking de Clientes VIP em São Paulo (Paginado com $facet e $lookup pós-$limit)
    const pagina = 1;
    const limite = 10;
    const skip = (pagina - 1) * limite;

    const pipelineClientesVip = [
      {
        $match: {
          shippingCity: 'São Paulo',
          status: { $in: statusEfetivados }
        }
      },
      {
        $group: {
          _id: '$userId',
          totalGastoBruto: { $sum: '$totalAmount' },
          quantidadePedidos: { $sum: 1 }
        }
      },
      { $sort: { totalGastoBruto: -1 } },
      {
        $facet: {
          metadata: [
            { $count: 'totalClientesElegiveis' },
            {
              $addFields: {
                paginaAtual: pagina,
                limitePorPagina: limite,
                totalPaginas: {
                  $ceil: { $divide: ['$totalClientesElegiveis', limite] }
                }
              }
            }
          ],
          data: [
            { $skip: skip },
            { $limit: limite },
            {
              $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'usuario'
              }
            },
            { $unwind: '$usuario' },
            {
              $project: {
                _id: 0,
                userId: '$_id',
                nome: '$usuario.name',
                email: '$usuario.email',
                totalGasto: { $round: ['$totalGastoBruto', 2] },
                quantidadePedidos: 1
              }
            }
          ]
        }
      }
    ];

    const t1 = Date.now();
    const [resultadoVip] = await ordersCol.aggregate(pipelineClientesVip).toArray();
    const tempoPipeline2Ms = Date.now() - t1;

    const metadataVip = resultadoVip.metadata[0] || {
      totalClientesElegiveis: 0,
      paginaAtual: pagina,
      limitePorPagina: limite,
      totalPaginas: 0
    };
    const top10Vip = resultadoVip.data || [];

    console.log(`\n=== PIPELINE 1: FATURAMENTO POR CATEGORIA (${tempoPipeline1Ms} ms) ===`);
    console.table(faturamentoPorCategoria);

    console.log(`\n=== PIPELINE 2: RANKING CLIENTES VIP - SÃO PAULO (${tempoPipeline2Ms} ms) ===`);
    console.log('Metadata:', metadataVip);
    console.table(top10Vip.map((c) => ({
      nome: c.nome,
      email: c.email,
      totalGasto: c.totalGasto,
      quantidadePedidos: c.quantidadePedidos
    })));

    // Gerar RELATORIO-TAREFA-2.md
    const md = [
      '# Relatório da Tarefa 2 — Aggregation Framework',
      '',
      `- **Data/Hora da Execução:** ${new Date().toISOString()}`,
      `- **Base Analisada:** \`${DB_NAME}.orders\` (100.000 documentos)`,
      '- **Processamento:** 100% executado no servidor MongoDB (zero processamento de arrays em Node.js).',
      '',
      '## 1. Pipeline 1 — Relatório de Faturamento por Categoria (Últimos 90 dias)',
      '',
      `- **Tempo de Execução:** \`${tempoPipeline1Ms} ms\``,
      '- **Data de Corte:** `' + noventaDiasAtras.toISOString() + '`',
      '- **Status Considerados:** `PAID`, `SHIPPED`, `DELIVERED` (exclui `PENDING` e `CANCELED` por ainda não representarem receita efetivada).',
      '',
      '### Código do Pipeline',
      '',
      '```js',
      JSON.stringify(pipelineFaturamento, null, 2),
      '```',
      '',
      '### Resultado Real Obtido',
      '',
      '| Posição | Categoria | Faturamento Total (R$) | Quantidade de Itens Vendidos |',
      '| :---: | :--- | ---: | ---: |',
      ...faturamentoPorCategoria.map((row, idx) =>
        `| ${idx + 1} | ${row.categoria} | R$ ${row.faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | ${row.quantidadeItensVendidos.toLocaleString('pt-BR')} |`
      ),
      '',
      '## 2. Pipeline 2 — Ranking de Clientes VIP em São Paulo (Paginado)',
      '',
      `- **Tempo de Execução:** \`${tempoPipeline2Ms} ms\``,
      '- **Regra de Negócio Aplicada:** Filtra `shippingCity: "São Paulo"` e apenas pedidos efetivados (`status` em `PAID`, `SHIPPED`, `DELIVERED`), evitando que pedidos cancelados ou pendentes inflem o ranking VIP.',
      '- **Otimização de `$lookup`:** O estágio `$lookup` na coleção `users` é executado **após** `$skip` e `$limit: 10` dentro do ramo `data` do `$facet`, reduzindo as junções de milhares de clientes para exatamente **10 lookups** por página.',
      '',
      '### Código do Pipeline',
      '',
      '```js',
      JSON.stringify(pipelineClientesVip, null, 2),
      '```',
      '',
      '### Metadados de Paginação (`metadata`)',
      '',
      '```json',
      JSON.stringify(metadataVip, null, 2),
      '```',
      '',
      '### Top 10 Clientes VIP — Página 1 (`data`)',
      '',
      '| Posição | Nome | E-mail | Total Gasto (R$) | Qtd. Pedidos |',
      '| :---: | :--- | :--- | ---: | ---: |',
      ...top10Vip.map((c, idx) =>
        `| ${idx + 1} | ${c.nome} | ${c.email} | R$ ${c.totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | ${c.quantidadePedidos} |`
      ),
      '',
      '### JSON Bruto Completo do Ranking VIP',
      '',
      '```json',
      JSON.stringify({ metadata: metadataVip, data: top10Vip }, null, 2),
      '```',
      ''
    ];

    const mdPath = path.join(__dirname, 'RELATORIO-TAREFA-2.md');
    fs.writeFileSync(mdPath, md.join('\n'), 'utf8');

    // Gerar visualizador-agregacoes.html para print com dados REAIS
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Tarefa 2 — Aggregation Framework (Resultados Reais)</title>
  <style>
    body { margin: 0; padding: 28px; font-family: 'Segoe UI', system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
    .wrap { max-width: 1200px; margin: 0 auto; }
    .hero { display: flex; justify-content: space-between; align-items: center; background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px 24px; margin-bottom: 20px; }
    h1 { margin: 0 0 6px; font-size: 22px; color: #f8fafc; }
    .sub { margin: 0; font-size: 13px; color: #94a3b8; }
    .badge { padding: 8px 14px; border-radius: 999px; background: rgba(16, 185, 129, 0.16); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); font-weight: 700; font-size: 13px; }
    .grid { display: grid; grid-template-columns: 1fr 1.35fr; gap: 18px; }
    .panel { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 18px 20px; }
    .panel h2 { margin: 0 0 4px; font-size: 16px; color: #f8fafc; }
    .meta { font-size: 12px; color: #94a3b8; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 9px 10px; border-bottom: 1px solid #334155; text-align: left; }
    th { color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
    .kpi { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 10px 12px; }
    .kpi .k { font-size: 11px; color: #94a3b8; text-transform: uppercase; }
    .kpi .v { font-size: 18px; font-weight: 700; color: #38bdf8; margin-top: 2px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <div>
        <h1>Tarefa 2 — Aggregation Framework sobre 100.000 Pedidos</h1>
        <p class="sub">Pipelines executados 100% no MongoDB (zero manipulação de arrays no Node.js)</p>
      </div>
      <div class="badge">MongoDB Aggregation Engine ✓</div>
    </div>

    <div class="grid">
      <div class="panel">
        <h2>1. Faturamento por Categoria (Últimos 90 dias)</h2>
        <div class="meta">Status: PAID, SHIPPED, DELIVERED • Tempo: ${tempoPipeline1Ms} ms</div>
        <table>
          <thead>
            <tr><th>#</th><th>Categoria</th><th class="num">Itens</th><th class="num">Faturamento (R$)</th></tr>
          </thead>
          <tbody>
            ${faturamentoPorCategoria.map((r, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><strong>${escapeHtml(r.categoria)}</strong></td>
                <td class="num">${r.quantidadeItensVendidos.toLocaleString('pt-BR')}</td>
                <td class="num">R$ ${r.faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="panel">
        <h2>2. Ranking Clientes VIP — São Paulo ($facet + $lookup pós-$limit)</h2>
        <div class="meta">Status efetivados • Apenas 10 $lookups executados na página • Tempo: ${tempoPipeline2Ms} ms</div>
        <div class="kpis">
          <div class="kpi"><div class="k">Clientes Elegíveis</div><div class="v">${metadataVip.totalClientesElegiveis}</div></div>
          <div class="kpi"><div class="k">Página / Limite</div><div class="v">${metadataVip.paginaAtual} / ${metadataVip.limitePorPagina}</div></div>
          <div class="kpi"><div class="k">Total de Páginas</div><div class="v">${metadataVip.totalPaginas}</div></div>
        </div>
        <table>
          <thead>
            <tr><th>#</th><th>Cliente</th><th>E-mail</th><th class="num">Pedidos</th><th class="num">Total Gasto</th></tr>
          </thead>
          <tbody>
            ${top10Vip.map((c, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><strong>${escapeHtml(c.nome)}</strong></td>
                <td>${escapeHtml(c.email)}</td>
                <td class="num">${c.quantidadePedidos}</td>
                <td class="num">R$ ${c.totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`;

    const htmlPath = path.join(__dirname, 'visualizador-agregacoes.html');
    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log(`\n✅ Relatório salvo em: ${mdPath}`);
    console.log(`✅ Visualizador HTML salvo em: ${htmlPath}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('❌ Erro ao executar agregações:', err);
  process.exit(1);
});
