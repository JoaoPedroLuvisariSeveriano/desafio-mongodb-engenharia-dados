/**
 * Operações de referência da Tarefa 1 (Modelagem e Evolução de Schema)
 * Demonstra atualização atômica de Reviews (Computed + Subset Pattern)
 * e Auditoria de Pedidos (Embedding com Bounded Array).
 */

async function registrarNovaAvaliacao(db, { productId, userId, authorName, rating, comment }) {
  const { ObjectId } = require('mongodb');
  const reviewDoc = {
    _id: new ObjectId(),
    productId,
    userId,
    authorName,
    rating,
    comment,
    createdAt: new Date()
  };

  // 1. Referencing: persiste histórico completo e ilimitado na coleção 'reviews'
  await db.collection('reviews').insertOne(reviewDoc);

  // 2. Computed + Subset Pattern: atualiza métricas e mantém apenas as 10 mais recentes em 'products'
  const produtoAtualizado = await db.collection('products').findOneAndUpdate(
    { _id: productId },
    [
      {
        $set: {
          'reviewStats.totalReviews': { $add: [{ $ifNull: ['$reviewStats.totalReviews', 0] }, 1] },
          'reviewStats.ratingSum': { $add: [{ $ifNull: ['$reviewStats.ratingSum', 0] }, rating] },
          recentReviews: {
            $slice: [
              {
                $sortArray: {
                  input: {
                    $concatArrays: [
                      { $ifNull: ['$recentReviews', []] },
                      [{
                        _id: reviewDoc._id,
                        userId: reviewDoc.userId,
                        authorName: reviewDoc.authorName,
                        rating: reviewDoc.rating,
                        comment: reviewDoc.comment,
                        createdAt: reviewDoc.createdAt
                      }]
                    ]
                  },
                  sortBy: { createdAt: -1 }
                }
              },
              10
            ]
          }
        }
      },
      {
        $set: {
          'reviewStats.averageRating': {
            $round: [{ $divide: ['$reviewStats.ratingSum', '$reviewStats.totalReviews'] }, 2]
          }
        }
      }
    ],
    { returnDocument: 'after' }
  );

  // Alternativa clássica usando operadores padrão de atualização ($inc + $push/$sort/$slice: 10):
  // await db.collection('products').updateOne(
  //   { _id: productId },
  //   {
  //     $inc: { 'reviewStats.totalReviews': 1, 'reviewStats.ratingSum': rating },
  //     $push: {
  //       recentReviews: {
  //         $each: [{ _id: reviewDoc._id, userId, authorName, rating, comment, createdAt: reviewDoc.createdAt }],
  //         $sort: { createdAt: -1 },
  //         $slice: 10
  //       }
  //     }
  //   }
  // );

  return produtoAtualizado;
}

async function registrarTransicaoStatus(db, { orderId, novoStatus, changedBy }) {
  // Embedding (Bounded Array): ciclo de vida do pedido tem cardinalidade pequena e fixa
  return db.collection('orders').updateOne(
    { _id: orderId },
    {
      $set: { status: novoStatus },
      $push: {
        statusHistory: {
          status: novoStatus,
          changedAt: new Date(),
          changedBy
        }
      }
    }
  );
}

module.exports = { registrarNovaAvaliacao, registrarTransicaoStatus };
