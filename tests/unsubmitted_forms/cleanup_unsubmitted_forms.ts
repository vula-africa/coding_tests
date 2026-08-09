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

const EXPIRY_DAYS = 7;
const BATCH_SIZE = 500;

type ExpiredToken = {
  token: string;
  entityId: string | null;
  productId: string;
};

export const expiry_cutoff = (now: Date = new Date()): Date =>
  new Date(now.getTime() - EXPIRY_DAYS * 24 * 60 * 60 * 1000);

// No lower bound, so a missed run is picked up by the next one. Deleted rows
// stop matching, so taking the first N each time walks the whole set.
const findExpiredTokens = (cutoff: Date): Promise<ExpiredToken[]> =>
  prisma.publicFormsTokens.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { token: true, entityId: true, productId: true },
    take: BATCH_SIZE,
  });

export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue) => {
  try {
    const cutoff = expiry_cutoff();

    while (true) {
      const expiredTokens = await findExpiredTokens(cutoff);
      if (expiredTokens.length === 0) break;

      let removed = 0;

      for (const token of expiredTokens) {
        const relationship = await prisma.relationship.findFirst({
          where: {
            entity_id: token.entityId,
            product_id: token.productId,
            status: "new",
          },
        });

        if (relationship) {
          await prisma.$transaction([
            // This entity's own unfinished relationships for this product.
            prisma.relationship.deleteMany({
              where: {
                entity_id: token.entityId,
                product_id: token.productId,
                status: "new",
              },
            }),
            // Delete the token
            prisma.publicFormsTokens.delete({
              where: { token: token.token },
            }),
            // Delete all corpus items associated with the entity
            prisma.new_corpus.deleteMany({
              where: { entity_id: token.entityId || "" },
            }),
            // Delete the entity (company)
            prisma.entity.delete({
              where: { id: token.entityId || "" },
            }),
          ]);
          removed++;
        }
      }

      // A batch that removes nothing would be fetched again next time round.
      if (removed === 0) {
        console.warn("cleanup_unsubmitted_forms: no progress, stopping");
        break;
      }
    }

    await update_job_status(job.id, "completed");
  } catch (error) {
    console.error("Error cleaning up unsubmitted forms:", error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};
