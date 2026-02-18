/* Context: 
 This is a scheduled job that runs every day at midnight to clean up forms that users started filling in but didn't submit which are older than 7 days. 
 When a user visits a public form, a token is generated and stored in the database.
 This token is used to identify the user and link the answers to the entity.
 An entity is the owner of data in the database, separated as it could be a business or an individual but has been decoupled from a login/user.
 If the user does not submit the form, the token and the entity should be deleted after 7 days.
 This is to prevent the database from being cluttered with unused tokens and entities.
 */

/* Task Instructions:
 * 1. Read and understand the code below
 * 2. Identify ALL issues in the code (there are multiple)
 * 3. Fix the issues and create a working solution
 * 4. Create a PR with clear commit messages
 * 5. Record a 3-5 minute Loom video explaining:
 *    - What issues you found
 *    - How you fixed them
 *    - Any trade-offs you considered
 *
 * Focus on: correctness, performance, error handling, and code clarity
 * Expected time: 45-60 minutes
 */

// For the purpose of this test you can ignore that the imports are not working.
import type { JobScheduleQueue } from "@prisma/client";
import { prisma } from "../endpoints/middleware/prisma";
import { update_job_status } from "./generic_scheduler";

const BATCH_SIZE = 100;

export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue) => {
  const stats = {
    tokensFound: 0,
    tokensDeleted: 0,
    errors: 0,
    skipped: 0,
  };

  try {
    // Find tokens created more than 7 days ago (older than 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let skip = 0;

    while (true) {
      const expiredTokens = await prisma.publicFormsTokens.findMany({
        where: {
          createdAt: {
            lte: sevenDaysAgo, // tokens older than or equal to 7 days
          },
        },
        skip: skip,
        take: BATCH_SIZE,
      });

      if (expiredTokens.length === 0) break;

      stats.tokensFound += expiredTokens.length;

      // Filter out tokens without entityId upfront
      const validTokens = expiredTokens.filter((t) => t.entityId);
      stats.skipped += expiredTokens.length - validTokens.length;

      if (validTokens.length === 0) {
        skip += BATCH_SIZE;
        continue;
      }

      // Get unique productIds and entityIds for batch query
      const productIds = [
        ...new Set(validTokens.map((t) => t.productId).filter(Boolean)),
      ];
      const entityIds = [
        ...new Set(validTokens.map((t) => t.entityId).filter(Boolean)),
      ];

      // Fetch relationships matching BOTH product_id AND entity_id with status "new"
      const relationships = await prisma.relationship.findMany({
        where: {
          product_id: { in: productIds },
          entity_id: { in: entityIds }, // Critical: must match entity_id too
          status: "new", // Only unsubmitted forms
        },
      });

      // Map by both product_id and entity_id to ensure correct matching
      const relationshipMap = new Map(
        relationships.map((r) => [`${r.product_id}:${r.entity_id}`, r])
      );

      for (const token of validTokens) {
        try {
          // Find relationship for this specific token's product and entity
          const relationship = relationshipMap.get(
            `${token.productId}:${token.entityId}`
          );

          // Only delete if relationship exists with "new" status (unsubmitted)
          if (!relationship) {
            stats.skipped++;
            continue;
          }

          await prisma.$transaction(async (tx) => {
            // Delete in correct order to avoid foreign key constraints:
            // 1. Delete corpus items (depend on entity)
            await tx.new_corpus.deleteMany({
              where: {
                entity_id: token.entityId!,
              },
            });

            // 2. Delete relationship (depends on entity)
            await tx.relationship.delete({
              where: { id: relationship.id },
            });

            // 3. Delete the token
            await tx.publicFormsTokens.delete({
              where: { token: token.token },
            });

            // 4. Delete the entity (last, as others depend on it)
            await tx.entity.delete({
              where: { id: token.entityId! },
            });
          });

          stats.tokensDeleted++;
        } catch (error) {
          stats.errors++;
          console.error(
            `Error processing token ${token.token}:`,
            error instanceof Error ? error.message : error
          );
          // Continue processing other tokens even if one fails
        }
      }

      skip += BATCH_SIZE;
    }

    console.log(
      `Cleanup complete: ${stats.tokensDeleted} deleted, ${stats.skipped} skipped, ${stats.errors} errors`
    );

    await update_job_status(job.id, "completed");
  } catch (error) {
    console.error("Cleanup failed:", error, stats);
    await update_job_status(job.id, "failed");
    throw error;
  }
};
