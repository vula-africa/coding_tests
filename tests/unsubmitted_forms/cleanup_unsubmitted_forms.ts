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

// Constants for clarity
const DAYS_TO_EXPIRE = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue) => {
  try {
    const cutoffDate = new Date(Date.now() - DAYS_TO_EXPIRE * MS_PER_DAY);

    // Find expired tokens (older than 7 days, unsubmitted)
    const expiredTokens = await prisma.publicFormsTokens.findMany({
      where: {
        createdAt: { lt: cutoffDate },
        submitted: false, // assuming there's a 'submitted' field to check if the form was submitted
      },
    });
    if (expiredTokens.length === 0) {
      console.log("No expired tokens found. Cleanup skipped.");
      await update_job_status(job.id, "completed");
      return;
    }
    // Collect IDs for batch deletion
    const tokenIds = expiredTokens.map((t) => t.token);
    const productIds = expiredTokens.map((t) => t.productId);
    const entityIds = expiredTokens
      .map((t) => t.entityId)
      .filter((id): id is string => id !== null && id !== undefined);
    try {
      await prisma.$transaction(async (tx) => {
        // Delete relationships with status "new" for the affected products
        await tx.relationship.deleteMany({
          where: {
            product_id: { in: productIds },
            status: "new",
          },
        });

        // Delete the expired tokens
        await tx.publicFormsTokens.deleteMany({
          where: { token: { in: tokenIds } },
        });

        // Delete corpus entries for the entities (if any exist)
        if (entityIds.length > 0) {
          await tx.new_corpus.deleteMany({
            where: { entity_id: { in: entityIds } },
          });
        }

        // Delete the entities themselves (if any exist)
        if (entityIds.length > 0) {
          await tx.entity.deleteMany({
            where: { id: { in: entityIds } },
          });
        }
      });

      console.log(
        `Cleanup job success: removed ${expiredTokens.length} tokens, ${entityIds.length} entities.`
      );
    } catch (txError) {
      // Catch transaction failure but don't crash the whole job runner
      console.error("Transaction failed during cleanup:", txError);
    }


    await update_job_status(job.id, "completed");
  } catch (error) {
    console.error("Error cleaning up unsubmitted forms:", error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};
