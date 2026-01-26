/* Context: 
 This is a scheduled job that runs every day at midnight to clean up forms that users started filling in but didn't submit which are older than 7 days. 
 When a user visits a public form, a token is generated and stored in the database.
 This token is used to identify the user and link the answers to the entity.
 An entity is the owner of data in the database, separated as it could be a business or an individual but has been decoupled from a login/user.
 If the user does not submit the form, the token and the entity should be deleted after 7 days.
 This is to prevent the database from being cluttered with unused tokens and entities.
 */

// For the purpose of this test you can ignore that the imports are not working.
import type { JobScheduleQueue } from "@prisma/client";
import { prisma } from "../endpoints/middleware/prisma";
import { update_job_status } from "./generic_scheduler";

const BATCH_SIZE = 1000;
const RETENTION_DAYS = 7;

export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue) => {
  try {
    const cutoffDate = new Date(
      Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    let totalTokensDeleted = 0;
    let totalEntitiesDeleted = 0;
    let totalRelationshipsDeleted = 0;
    let totalCorpusDeleted = 0;

    // Process in batches to handle large datasets without memory issues
    while (true) {
      const expiredTokens = await prisma.publicFormsTokens.findMany({
        where: {
          createdAt: { lt: cutoffDate },
          submittedAt: null,
        },
        select: {
          token: true,
          entityId: true,
          productId: true,
        },
        take: BATCH_SIZE,
      });

      if (expiredTokens.length === 0) {
        break;
      }

      // Deduplicate identifiers for batch operations
      const tokenStrings = [...new Set(expiredTokens.map((t) => t.token))];

      const entityIds = [
        ...new Set(
          expiredTokens
            .map((t) => t.entityId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      const productIds = [
        ...new Set(
          expiredTokens
            .map((t) => t.productId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      // Find only relationships that belong to these specific expired tokens
      // This prevents accidentally deleting relationships for non-expired tokens
      // that may share the same product_id
      const relationshipsToDelete = await prisma.relationship.findMany({
        where: {
          product_id: { in: productIds },
          status: "new",
          // Ensure we only delete relationships tied to expired entities
          entity_id: { in: entityIds },
        },
        select: { id: true },
      });

      const relationshipIds = relationshipsToDelete.map((r) => r.id);

      // Execute all deletions in a single atomic transaction
      // Order respects foreign key constraints: children before parents
      const results = await prisma.$transaction([
        prisma.relationship.deleteMany({
          where: { id: { in: relationshipIds } },
        }),

        prisma.new_corpus.deleteMany({
          where: { entity_id: { in: entityIds } },
        }),

        prisma.publicFormsTokens.deleteMany({
          where: { token: { in: tokenStrings } },
        }),

        prisma.entity.deleteMany({
          where: { id: { in: entityIds } },
        }),
      ]);

      totalRelationshipsDeleted += results[0].count;
      totalCorpusDeleted += results[1].count;
      totalTokensDeleted += results[2].count;
      totalEntitiesDeleted += results[3].count;

      // If we got fewer than BATCH_SIZE, we've processed everything
      if (expiredTokens.length < BATCH_SIZE) {
        break;
      }
    }

    console.log(
      `Cleanup complete: ${totalTokensDeleted} tokens, ${totalEntitiesDeleted} entities, ` +
        `${totalRelationshipsDeleted} relationships, ${totalCorpusDeleted} corpus items deleted`,
    );

    await update_job_status(job.id, "completed");
  } catch (error) {
    console.error("Error cleaning up unsubmitted forms:", error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};
