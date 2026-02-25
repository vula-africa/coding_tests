import type { JobScheduleQueue } from "@prisma/client";
import { prisma } from "../endpoints/middleware/prisma";
import { update_job_status } from "./generic_scheduler";

export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue) => {
  let processedCount = 0;
  let deletedCount = 0;
  let errorCount = 0;

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const expiredTokens = await prisma.publicFormsTokens.findMany({
      where: {
        createdAt: {
          lt: sevenDaysAgo,
        },
      },
    });

    console.log(`Found ${expiredTokens.length} expired tokens to process`);

    // Batch fetch all relationships to avoid N+1 queries
    const productIds = expiredTokens.map((t) => t.productId);
    const relationships = await prisma.relationship.findMany({
      where: {
        product_id: { in: productIds },
        status: "new",
      },
    });

    const relationshipMap = new Map(
      relationships.map((r) => [r.product_id, r])
    );

    for (const token of expiredTokens) {
      processedCount++;

      try {
        const relationship = relationshipMap.get(token.productId);

        // Only proceed if relationship exists (form not submitted) and entityId is valid
        if (relationship && token.entityId) {
          const relationshipId = relationship.id;
          const entityId = token.entityId;

          await prisma.$transaction(async (tx) => {
            await tx.relationship.delete({
              where: { id: relationshipId },
            });

            await tx.new_corpus.deleteMany({
              where: {
                entity_id: entityId,
              },
            });

            await tx.publicFormsTokens.delete({
              where: { token: token.token },
            });

            await tx.entity.delete({
              where: { id: entityId },
            });
          });

          deletedCount++;
        } else if (!token.entityId) {
          console.warn(`Skipping token ${token.token}: missing entityId`);
        }
      } catch (transactionError) {
        errorCount++;
        console.error(
          `Error deleting token ${token.token}:`,
          transactionError
        );
      }
    }

    console.log(
      `Cleanup completed: processed ${processedCount} tokens, deleted ${deletedCount} unsubmitted forms, ${errorCount} errors`
    );

    await update_job_status(job.id, "completed");
  } catch (error) {
    console.error("Error cleaning up unsubmitted forms:", error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};
