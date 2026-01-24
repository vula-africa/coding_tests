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

export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue) => {
  try {
    // Find forms that were created more than 7 days ago and have not been submitted
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days in ms

    // get all tokens older than 7 days, not just ones from exactly 7 days ago
    const expiredTokens = await prisma.publicFormsTokens.findMany({
      where: {
        createdAt: {
          lt: sevenDaysAgo,
        },
      },
    });

    for (const token of expiredTokens) {
      const relationship = await prisma.relationship.findFirst({
        where: {
          product_id: token.productId,
          status: "new",
        },
      });

      // build transaction array - delete in order that respects FK constraints
      const deleteOperations = [
        // delete token first
        prisma.publicFormsTokens.delete({
          where: { token: token.token },
        }),
        // delete corpus items before entity (they reference entity_id)
        prisma.new_corpus.deleteMany({
          where: {
            entity_id: token.entityId || "",
          },
        }),
        // delete entity last since other things reference it
        prisma.entity.delete({
          where: { id: token.entityId || "" },
        }),
      ];

      // only delete relationship if one exists
      if (relationship) {
        deleteOperations.unshift(
          prisma.relationship.delete({
            where: { id: relationship.id },
          }),
        );
      }

      await prisma.$transaction(deleteOperations);
    }

    await update_job_status(job.id, "completed");
  } catch (error) {
    console.error("Error cleaning up unsubmitted forms:", error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};
