const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/?replicaSet=rs0';
const DB_NAME = 'marketplace';

const CATEGORIAS = ['Eletrônicos', 'Livros', 'Casa e Cozinha', 'Esportes', 'Moda'];
const CIDADES = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre', 'Recife'];
const STATUS_LIST = ['PAID', 'PENDING', 'SHIPPED', 'DELIVERED', 'CANCELED'];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDateWithinDays(days) {
  const now = Date.now();
  const offset = Math.random() * days * 86400000;
  return new Date(now - offset);
}

async function seed() {
  const client = new MongoClient(MONGO_URI);
  const inicio = Date.now();

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    console.log(`Conectado ao MongoDB (${DB_NAME}). Executando dropDatabase()...`);
    await db.dropDatabase();

    // 1. Gerar 1.000 produtos
    const products = [];
    for (let i = 1; i <= 1000; i++) {
      products.push({
        _id: new ObjectId(),
        sku: `SKU-${String(i).padStart(5, '0')}`,
        name: `Produto Exemplo ${i}`,
        category: CATEGORIAS[randomInt(0, CATEGORIAS.length - 1)],
        price: Number((20 + Math.random() * 500).toFixed(2)),
        stock: randomInt(10, 500),
        sellerId: `SELLER-${randomInt(1, 50)}`,
        active: Math.random() < 0.9
      });
    }
    await db.collection('products').insertMany(products);
    console.log(`✅ Inseridos ${products.length} documentos em 'products'.`);

    // 2. Gerar 5.000 usuários
    const users = [];
    for (let i = 1; i <= 5000; i++) {
      users.push({
        _id: new ObjectId(),
        name: `Cliente ${i}`,
        email: `cliente${i}@exemplo.com`,
        city: CIDADES[randomInt(0, CIDADES.length - 1)],
        walletBalance: Number((100 + Math.random() * 2000).toFixed(2)),
        createdAt: randomDateWithinDays(365)
      });
    }
    await db.collection('users').insertMany(users);
    console.log(`✅ Inseridos ${users.length} documentos em 'users'.`);

    // 3. Gerar 100.000 pedidos em lotes de 10.000 (SEM índices secundários)
    const TOTAL_ORDERS = 100000;
    const BATCH_SIZE = 10000;
    const ordersCol = db.collection('orders');

    for (let offset = 0; offset < TOTAL_ORDERS; offset += BATCH_SIZE) {
      const batch = [];
      for (let j = 0; j < BATCH_SIZE; j++) {
        const user = users[randomInt(0, users.length - 1)];
        const itemCount = randomInt(1, 4);
        const items = [];
        let totalAmount = 0;

        for (let k = 0; k < itemCount; k++) {
          const prod = products[randomInt(0, products.length - 1)];
          const quantity = randomInt(1, 3);
          totalAmount += prod.price * quantity;
          items.push({
            productId: prod._id,
            sku: prod.sku,
            category: prod.category,
            unitPrice: prod.price,
            quantity
          });
        }

        batch.push({
          _id: new ObjectId(),
          userId: user._id,
          shippingCity: user.city,
          status: STATUS_LIST[randomInt(0, STATUS_LIST.length - 1)],
          items,
          totalAmount: Number(totalAmount.toFixed(2)),
          createdAt: randomDateWithinDays(180)
        });
      }
      await ordersCol.insertMany(batch, { ordered: false });
      console.log(`   -> Lote inserido: ${offset + BATCH_SIZE}/${TOTAL_ORDERS} pedidos`);
    }

    const elapsedSec = ((Date.now() - inicio) / 1000).toFixed(2);
    console.log(`\n🎉 Seed finalizado com sucesso em ${elapsedSec}s (nenhum índice secundário criado).`);
  } finally {
    await client.close();
  }
}

seed().catch((err) => {
  console.error('❌ Erro ao executar seed:', err);
  process.exit(1);
});
