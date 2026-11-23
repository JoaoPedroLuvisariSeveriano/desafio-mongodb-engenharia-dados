const { ObjectId } = require('mongodb');

/**
 * Executa um checkout atômico ACID envolvendo products, users e orders.
 * Qualquer erro ou violação de regra dispara session.abortTransaction().
 */
async function realizarCheckout(client, { userId, productId, quantity, simularErroAposEstoque = false }) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Quantidade inválida. Informe um número inteiro positivo.');
  }

  const db = client.db('marketplace');
  const productsCol = db.collection('products');
  const usersCol = db.collection('users');
  const ordersCol = db.collection('orders');

  const session = client.startSession();
  const prodObjId = typeof productId === 'string' ? new ObjectId(productId) : productId;
  const userObjId = typeof userId === 'string' ? new ObjectId(userId) : userId;

  try {
    session.startTransaction();

    // Passo 1: Verificar produto e estoque suficiente dentro da sessão
    const product = await productsCol.findOne({ _id: prodObjId }, { session });
    if (!product) {
      throw new Error(`Produto ${prodObjId} não encontrado.`);
    }
    if (product.stock < quantity) {
      throw new Error(
        `Estoque insuficiente para ${product.sku}: disponível ${product.stock}, solicitado ${quantity}.`
      );
    }

    const totalAmount = Number((product.price * quantity).toFixed(2));

    // Passo 2: Verificar usuário e saldo suficiente dentro da sessão
    const user = await usersCol.findOne({ _id: userObjId }, { session });
    if (!user) {
      throw new Error(`Usuário ${userObjId} não encontrado.`);
    }
    if (user.walletBalance < totalAmount) {
      throw new Error(
        `Saldo insuficiente para ${user.name}: disponível R$ ${user.walletBalance.toFixed(2)}, necessário R$ ${totalAmount.toFixed(2)}.`
      );
    }

    // Passo 3: Debitar estoque com guarda condicional
    const estoqueRes = await productsCol.updateOne(
      { _id: product._id, stock: { $gte: quantity } },
      { $inc: { stock: -quantity } },
      { session }
    );
    if (estoqueRes.modifiedCount !== 1) {
      throw new Error('Falha de concorrência ao debitar estoque do produto.');
    }

    // Gancho determinístico para comprovação de rollback ACID no Cenário 3
    if (simularErroAposEstoque) {
      throw new Error(
        'ERRO SIMULADO NO MEIO DA TRANSAÇÃO: falha inesperada após debitar estoque e antes de debitar a carteira!'
      );
    }

    // Passo 4: Debitar carteira do usuário com guarda condicional
    const saldoRes = await usersCol.updateOne(
      { _id: user._id, walletBalance: { $gte: totalAmount } },
      { $inc: { walletBalance: -totalAmount } },
      { session }
    );
    if (saldoRes.modifiedCount !== 1) {
      throw new Error('Falha de concorrência ao debitar saldo da carteira do usuário.');
    }

    // Passo 5: Inserir novo pedido com status PAID e statusHistory auditável
    const agora = new Date();
    const novoPedido = {
      _id: new ObjectId(),
      userId: user._id,
      shippingCity: user.city,
      status: 'PAID',
      items: [
        {
          productId: product._id,
          sku: product.sku,
          category: product.category,
          unitPrice: product.price,
          quantity
        }
      ],
      totalAmount,
      createdAt: agora,
      statusHistory: [
        {
          status: 'PAID',
          changedAt: agora,
          changedBy: {
            userId: user._id,
            role: 'CUSTOMER',
            name: user.name
          }
        }
      ]
    };

    await ordersCol.insertOne(novoPedido, { session });

    await session.commitTransaction();
    return {
      ok: true,
      orderId: novoPedido._id,
      totalAmount,
      order: novoPedido
    };
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

module.exports = { realizarCheckout };
