import type { JobScheduleQueue } from "@prisma/client";
import { prisma } from "../endpoints/middleware/prisma";
import { update_job_status } from "./generic_scheduler";


export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue) => {
  try {
    // FIX 1: Date Logic.
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // FIX 2: Fetch only necessary fields (Performance)
    const potentialTokens = await prisma.publicFormsTokens.findMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
      select: {
        token: true,
        productId: true,
        entityId: true,
      },
      take: 1000,
    });

    if (potentialTokens.length === 0) {
      await update_job_status(job.id, "completed");
      return;
    }

    // FIX 3: Bulk Relationship Check (Avoid N+1)
    const productIds = potentialTokens
      .map((t) => t.productId)
      .filter((id): id is string => !!id);

    const unsubmittedRelationships = await prisma.relationship.findMany({
      where: {
        product_id: { in: productIds },
        status: "new",
      },
      select: {
        id: true,
        product_id: true,
      },
    });

    const unsubmittedProductIds = new Set(
      unsubmittedRelationships.map((r) => r.product_id)
    );

    // Filter tokens that match the unsubmitted criteria
    const tokensToDelete = potentialTokens.filter(
      (t) => t.productId && unsubmittedProductIds.has(t.productId)
    );

    if (tokensToDelete.length === 0) {
      await update_job_status(job.id, "completed");
      return;
    }

    const entityIds = tokensToDelete
      .map((t) => t.entityId)
      .filter((id): id is string => !!id);
      
    const tokenStrings = tokensToDelete.map((t) => t.token);
    
    const relationshipIds = unsubmittedRelationships
      .filter(r => productIds.includes(r.product_id || '')) 
      .map(r => r.id);

    
    // FIX 4: Transactional Bulk Delete (Performance)
    await prisma.$transaction([
      // 1. Delete Corpus items (Child of Entity)
      prisma.new_corpus.deleteMany({
        where: {
          entity_id: { in: entityIds },
        },
      }),

      // 2. Delete Relationships
      prisma.relationship.deleteMany({
        where: {
          id: { in: relationshipIds },
        },
      }),

      // 3. Delete Tokens
      prisma.publicFormsTokens.deleteMany({
        where: {
          token: { in: tokenStrings },
        },
      }),

      // 4. Delete Entities (Parent)
      prisma.entity.deleteMany({
        where: {
          id: { in: entityIds },
        },
      }),
    ]);

    console.log(`Successfully cleaned up ${tokensToDelete.length} unsubmitted forms.`);
    await update_job_status(job.id, "completed");

  } catch (error) {
    console.error("Error cleaning up unsubmitted forms:", error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};