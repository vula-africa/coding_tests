// For the purpose of this test you can ignore that the imports are not working.
import type { JobScheduleQueue } from "@prisma/client";
import { prisma } from "../endpoints/middleware/prisma";
import { update_job_status } from "./generic_scheduler";

export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue) => {
  try {
    // Calculate the date 7 days ago at midnight for accurate "older than 7 days" filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of current day
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Find all tokens older than 7 days (createdAt < sevenDaysAgo)
    const expiredTokens = await prisma.publicFormsTokens.findMany({
      where: {
        createdAt: {
          lt: sevenDaysAgo,
        },
      },
    });

    if (expiredTokens.length === 0) {
      await update_job_status(job.id, "completed");
      return;
    }

    // Collect productIds to batch query relationships
    const productIds = expiredTokens.map((token) => token.productId);
    const relationships = await prisma.relationship.findMany({
      where: {
        product_id: {
          in: productIds,
        },
        status: "new",
      },
    });

    // Map tokens by productId for quick lookup
    const tokenMap = new Map(expiredTokens.map((token) => [token.productId, token]));

    // Collect IDs for batch deletion (only for unsubmitted forms with matching relationships)
    const relIds: string[] = [];
    const tokenValues: string[] = [];
    const entityIds: string[] = [];

    for (const rel of relationships) {
      const token = tokenMap.get(rel.product_id);
      if (token) {
        relIds.push(rel.id);
        tokenValues.push(token.token);
        if (token.entityId) {
          entityIds.push(token.entityId);
        }
      }
    }

    // Perform batch deletes in a single transaction if there are items to delete
    if (relIds.length > 0) {
      await prisma.$transaction([
        // Delete relationships
        prisma.relationship.deleteMany({
          where: { id: { in: relIds } },
        }),
        // Delete tokens
        prisma.publicFormsTokens.deleteMany({
          where: { token: { in: tokenValues } },
        }),
        // Delete all corpus items associated with the entities
        prisma.new_corpus.deleteMany({
          where: { entity_id: { in: entityIds } },
        }),
        // Delete the entities
        prisma.entity.deleteMany({
          where: { id: { in: entityIds } },
        }),
      ]);
    }

    await update_job_status(job.id, "completed");
  } catch (error) {
    console.error("Error cleaning up unsubmitted forms:", error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};