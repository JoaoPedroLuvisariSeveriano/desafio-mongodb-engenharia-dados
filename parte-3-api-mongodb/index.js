require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/marketplace';

app.use(express.json());

const usuarioSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  tipo: { type: String, enum: ['vendedor', 'comprador'], required: true }
}, { versionKey: false });

const produtoSchema = new mongoose.Schema({
  vendedorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  nome: { type: String, required: true, trim: true },
  preco: { type: Number, required: true, min: 0 },
  estoque: { type: Number, required: true, min: 0 }
}, { versionKey: false });

const pedidoSchema = new mongoose.Schema({
  compradorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  produtoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Produto', required: true },
  quantidade: { type: Number, required: true, min: 1 },
  valorTotal: { type: Number, required: true, min: 0 },
  data: { type: Date, default: Date.now }
}, { versionKey: false });

const Usuario = mongoose.model('Usuario', usuarioSchema, 'usuarios');
const Produto = mongoose.model('Produto', produtoSchema, 'produtos');
const Pedido = mongoose.model('Pedido', pedidoSchema, 'pedidos');

app.post('/usuarios', async (req, res) => {
  try {
    const { nome, tipo } = req.body;
    if (!nome || typeof nome !== 'string' || !['vendedor', 'comprador'].includes(tipo)) {
      return res.status(400).json({
        erro: "Dados inválidos. Informe 'nome' e 'tipo' ('vendedor' ou 'comprador')."
      });
    }
    const novoUsuario = await Usuario.create({ nome: nome.trim(), tipo });
    return res.status(201).json(novoUsuario);
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});

app.post('/produtos', async (req, res) => {
  try {
    const { vendedorId, nome, preco, estoque } = req.body;
    if (!mongoose.Types.ObjectId.isValid(vendedorId)) {
      return res.status(403).json({ erro: 'vendedorId inválido ou não autorizado.' });
    }

    const vendedor = await Usuario.findOne({ _id: vendedorId, tipo: 'vendedor' });
    if (!vendedor) {
      return res.status(403).json({
        erro: 'Apenas vendedores cadastrados podem anunciar produtos.'
      });
    }

    const precoNum = Number(preco);
    const estoqueNum = Number(estoque);
    if (!nome || Number.isNaN(precoNum) || Number.isNaN(estoqueNum) || precoNum < 0 || estoqueNum < 0) {
      return res.status(400).json({ erro: 'Dados de produto inválidos.' });
    }

    const novoProduto = await Produto.create({
      vendedorId: vendedor._id,
      nome: String(nome).trim(),
      preco: precoNum,
      estoque: estoqueNum
    });

    return res.status(201).json(novoProduto);
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});

app.get('/produtos', async (req, res) => {
  try {
    const disponiveis = await Produto.find({ estoque: { $gt: 0 } })
      .populate('vendedorId', 'nome')
      .lean();
    return res.status(200).json(disponiveis);
  } catch (err) {
    return res.status(500).json({ erro: err.message });
  }
});

app.post('/pedidos', async (req, res) => {
  try {
    const { compradorId, produtoId, quantidade } = req.body;
    if (!mongoose.Types.ObjectId.isValid(compradorId)) {
      return res.status(403).json({ erro: 'compradorId inválido ou não autorizado.' });
    }

    const comprador = await Usuario.findOne({ _id: compradorId, tipo: 'comprador' });
    if (!comprador) {
      return res.status(403).json({
        erro: 'Apenas compradores cadastrados podem realizar pedidos.'
      });
    }

    const quantidadeNum = Number(quantidade);
    if (!mongoose.Types.ObjectId.isValid(produtoId) || !Number.isInteger(quantidadeNum) || quantidadeNum <= 0) {
      return res.status(400).json({ erro: 'produtoId ou quantidade inválidos.' });
    }

    const produto = await Produto.findById(produtoId);
    if (!produto || produto.estoque < quantidadeNum) {
      return res.status(400).json({
        erro: 'Produto inexistente ou estoque insuficiente para a quantidade solicitada.'
      });
    }

    produto.estoque -= quantidadeNum;
    await produto.save();

    const valorTotal = Number((produto.preco * quantidadeNum).toFixed(2));
    const novoPedido = await Pedido.create({
      compradorId: comprador._id,
      produtoId: produto._id,
      quantidade: quantidadeNum,
      valorTotal
    });

    return res.status(201).json(novoPedido);
  } catch (err) {
    return res.status(400).json({ erro: err.message });
  }
});

async function iniciar() {
  await mongoose.connect(MONGO_URI);
  console.log('Conectado ao MongoDB via Mongoose.');
  app.listen(PORT, () => {
    console.log(`API Marketplace (MongoDB) rodando em http://localhost:${PORT}`);
  });
}

iniciar().catch((err) => {
  console.error('Erro ao iniciar servidor MongoDB:', err);
  process.exit(1);
});
