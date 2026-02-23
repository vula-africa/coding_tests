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
    //Find forms that were created 7 days ago and have not been submitted
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // fixed milliseconds conversion here

    const expiredTokens = await prisma.publicFormsTokens.findMany({
      where: {
        createdAt: { lt: sevenDaysAgo }, // everything older than 7 days
          submitted: false,                // never touch submitted forms
      },
    });

    // If there are no expired tokens, we can mark the job as completed and exit early
    if (expiredTokens.length === 0) {
      await update_job_status(job.id, "completed");
      return;
    }

    //Batch fetching the relationship isn't the best approach because of the possibility of multiple tokens sharing the same product ID.
    for (const token of expiredTokens) {
      await prisma.$transaction(async (tx) => {

        // Delete all relationships associated with this token's product ID that are still in "new" status (i.e., they haven't been submitted yet).
        await tx.relationship.deleteMany({
          where: {
            product_id: token.productId,
            entity_id: token.entityId, // added this condition to ensure we only delete relationships associated with this token's entity
            status: "new",
          },
        });

        // This is a bit of a hack, but we want to make sure we clean up any entities that were created for this form, but only if they aren't associated with any other relationships (which is why we check for the "new" status above).
        if (token.entityId) {
          const activeRelationshipCount = await tx.relationship.count({
            where: {
              entity_id: token.entityId,
            },
          });

          if (activeRelationshipCount === 0) {
            await tx.new_corpus.deleteMany({
              where: { entity_id: token.entityId },
            });

            await tx.entity.deleteMany({
              where: { id: token.entityId },
            });
          }
        }

        // Finally, delete the token itself.
        await tx.publicFormsTokens.delete({
          where: { token: token.token },
        });

      });
    }

    await update_job_status(job.id, "completed");
  } catch (error) {
    console.error("Error cleaning up unsubmitted forms:", error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};