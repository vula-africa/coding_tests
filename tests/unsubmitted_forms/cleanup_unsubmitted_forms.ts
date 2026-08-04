/* Context: 
 This is a scheduled job that runs every day at midnight to clean up forms that users started filling in but didn't submit which are older than 7 days. 
 When a user visits a public form, a token is generated and stored in the database.
 This token is used to identify the user and link the answers to the entity.
 An entity is the owner of data in the database, separated as it could be a business or an individual but has been decoupled from a login/user.
 This entity is a profile within Vula which it will match funding opportunities and send then alerts about their business profile.
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

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 500;

export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue) => {
  try {
    //Find forms that were created more than 7 days ago and have not been submitted
    const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);

    let processed = 0;
    let failed = 0;
    let hasMore = true;

    while (hasMore) {
      const expiredTokens = await prisma.publicFormsTokens.findMany({
        where: {
          createdAt: {
            lt: cutoff,
          },
          submittedAt: null,
        },
        take: BATCH_SIZE,
      });

      if (expiredTokens.length === 0) {
        break;
      }

      let cleanedInBatch = 0;

      for (const token of expiredTokens) {
        if (!token.entityId) {
          console.warn(
            `Token ${token.token} missing entityId — deleting token only`
          );
          try {
            await prisma.publicFormsTokens.delete({
              where: { token: token.token },
            });
            processed++;
            cleanedInBatch++;
          } catch (err) {
            failed++;
            console.error(`Failed deleting token ${token.token}:`, err);
          }
          continue;
        }

        try {
          await prisma.$transaction([
            prisma.relationship.deleteMany({
              where: { product_id: token.productId, status: "new" },
            }),
            prisma.publicFormsTokens.delete({
              where: { token: token.token },
            }),
            prisma.new_corpus.deleteMany({
              where: { entity_id: token.entityId },
            }),
            prisma.entity.delete({ where: { id: token.entityId } }),
          ]);
          processed++;
          cleanedInBatch++;
        } catch (err) {
          failed++;
          console.error(`Failed cleaning up token ${token.token}:`, err);
        }
      }

      // Failed records remain eligible for cleanup. Stop if this batch did not
      // delete anything, otherwise the same full batch would be selected
      // forever and the job would never update its status.
      if (cleanedInBatch === 0 || expiredTokens.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    console.log(`Cleanup: ${processed} processed, ${failed} failed`);
    await update_job_status(
      job.id,
      failed > 0 ? "completed_with_errors" : "completed"
    );
  } catch (error) {
    console.error("Error cleaning up unsubmitted forms:", error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};
