interface JobScheduleQueue {
  id: string;
  status: string;
}

interface PublicFormToken {
  token: string;
  entityId: string | null;
  productId: string;
  status: 'pending' | 'submitted';
  createdAt: Date;
}

export const cleanupUnsubmittedForms = async (job: JobScheduleQueue) => {
  const BATCH_SIZE = 500;
  const logger = createLogger('cleanup-forms');

  try {
    logger.info('Starting cleanup of unsubmitted forms');
    
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const expiredTokens = await prisma.publicFormsTokens.findMany({
      where: {
        createdAt: {
          lt: sevenDaysAgo,
        },
        status: 'pending',
      },
      select: {
        token: true,
        entityId: true,
        productId: true,
      },
      take: BATCH_SIZE,
    });

    logger.info(`Found ${expiredTokens.length} expired tokens to process`);

    for (const token of expiredTokens) {
      if (!token.entityId) {
        logger.warn(`Token ${token.token} has no entityId, skipping`);
        continue;
      }

      try {
        await prisma.$transaction(async (tx) => {
          const relationship = await tx.relationship.findFirst({
            where: {
              product_id: token.productId,
              status: 'new',
            },
          });

          if (!relationship) {
            logger.info(`No relationship found for token ${token.token}, skipping`);
            return;
          }

          
          await Promise.all([
            tx.relationship.delete({
              where: { id: relationship.id },
            }),
            tx.publicFormsTokens.delete({
              where: { token: token.token },
            }),
            tx.new_corpus.deleteMany({
              where: { entity_id: token.entityId },
            }),
            tx.entity.delete({
              where: { id: token.entityId },
            }),
          ]);

          logger.info(`Successfully cleaned up data for token ${token.token}`);
        });
      } catch (txError) {
        logger.error('Transaction failed for token cleanup', {
          token: token.token,
          error: txError,
        });
       
      }
    }

    await updateJobStatus(job.id, 'completed');
    logger.info('Cleanup job completed successfully');
  } catch (error) {
    logger.error('Fatal error in cleanup job', { error });
    await updateJobStatus(job.id, 'failed');
    throw error;
  }
};