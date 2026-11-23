const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

const usuarios = [];
const produtos = [];
const pedidos = [];

app.post('/usuarios', (req, res) => {
  const { nome, tipo } = req.body;

  if (!nome || typeof nome !== 'string' || !['vendedor', 'comprador'].includes(tipo)) {
    return res.status(400).json({
      erro: "Dados inválidos. Informe 'nome' e 'tipo' ('vendedor' ou 'comprador')."
    });
  }

  const novoUsuario = {
    id: usuarios.length + 1,
    nome: nome.trim(),
    tipo
  };

  usuarios.push(novoUsuario);
  return res.status(201).json(novoUsuario);
});

app.post('/produtos', (req, res) => {
  const { vendedorId, nome, preco, estoque } = req.body;
  const vendedorIdNum = Number(vendedorId);

  const vendedor = usuarios.find(
    (u) => u.id === vendedorIdNum && u.tipo === 'vendedor'
  );

  if (!vendedor) {
    return res.status(403).json({
      erro: 'Apenas vendedores cadastrados podem anunciar produtos.'
    });
  }

  const precoNum = Number(preco);
  const estoqueNum = Number(estoque);

  if (!nome || Number.isNaN(precoNum) || Number.isNaN(estoqueNum) || precoNum < 0 || estoqueNum < 0) {
    return res.status(400).json({
      erro: 'Dados de produto inválidos.'
    });
  }

  const novoProduto = {
    id: produtos.length + 1,
    vendedorId: vendedorIdNum,
    nome: String(nome).trim(),
    preco: precoNum,
    estoque: estoqueNum
  };

  produtos.push(novoProduto);
  return res.status(201).json(novoProduto);
});

app.get('/produtos', (req, res) => {
  const disponiveis = produtos.filter((p) => p.estoque > 0);
  return res.status(200).json(disponiveis);
});

app.post('/pedidos', (req, res) => {
  const { compradorId, produtoId, quantidade } = req.body;
  const compradorIdNum = Number(compradorId);
  const produtoIdNum = Number(produtoId);
  const quantidadeNum = Number(quantidade);

  const comprador = usuarios.find(
    (u) => u.id === compradorIdNum && u.tipo === 'comprador'
  );

  if (!comprador) {
    return res.status(403).json({
      erro: 'Apenas compradores cadastrados podem realizar pedidos.'
    });
  }

  const produto = produtos.find((p) => p.id === produtoIdNum);

  if (!produto || !Number.isInteger(quantidadeNum) || quantidadeNum <= 0 || produto.estoque < quantidadeNum) {
    return res.status(400).json({
      erro: 'Produto inexistente ou estoque insuficiente para a quantidade solicitada.'
    });
  }

  produto.estoque -= quantidadeNum;
  const valorTotal = Number((produto.preco * quantidadeNum).toFixed(2));

  const novoPedido = {
    id: pedidos.length + 1,
    compradorId: compradorIdNum,
    produtoId: produtoIdNum,
    quantidade: quantidadeNum,
    valorTotal,
    data: new Date().toISOString()
  };

  pedidos.push(novoPedido);
  return res.status(201).json(novoPedido);
});

app.listen(PORT, () => {
  console.log(`API Marketplace (Memória) rodando em http://localhost:${PORT}`);
});
