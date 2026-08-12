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
import { logger } from "../utils/logger";

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 500;

export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue) => {
  try {
    // The old version used a one-day window (gte X, lt X+1day), so any token
    // missed by a late or failed run was never picked up again, leaving
    // orphaned tokens and entities. It also forgot to convert to milliseconds,
    // so the cutoff was ~10 minutes rather than 7 days, and the comparison was
    // inverted. We now delete everything strictly older than the cutoff, which
    // is self-healing: a missed run is caught by the next one.
    const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS);

    let deleted = 0;
    let failed = 0;

    // this guarntees failed tokens never gets retried
    const failedTokens = new Set();

    // Paginated so the first run does not load the entire historical backlog
    // at once. No cursor: each pass deletes the rows it reads, so the next
    // query returns the following batch.
    // this loop will always break, it only attempts to delete each row only once
    for (;;) {
      const expiredTokens = await prisma.publicFormsTokens.findMany({
        where: { 
            createdAt: { lt: sevenDaysAgo },
            token: failedTokens.size ? { notIn: [...failedTokens] } : undefined,
        },
        take: BATCH_SIZE,
        // Prefetching the relationships turns an N+1 into a single round trip.
        include: {
          product: {
            include: {
              relationships: { where: { status: "new" } },
            },
          },
        },
      });

      if (expiredTokens.length === 0) break;

      for (const token of expiredTokens) {
        // Prefetched via include, so no query here. Empty array when the
        // product has no "new" relationship, which is fine: the token still
        // gets deleted.
        const related = token.product?.relationships ?? [];

        try {
          await prisma.$transaction(async (transaction) => {
            // deleteMany over the prefetched IDs. The original deleted a single
            // relationship from findFirst, which silently dropped any others.
            if (related.length) {
              await transaction.relationship.deleteMany({
                where: { id: { in: related.map((r) => r.id) } },
              });
            }

            // Corpus before entity: children first, or the FK constraint
            // blocks the parent delete. The original had these reversed.
            if (token.entityId) {
              await transaction.new_corpus.deleteMany({
                where: { entity_id: token.entityId },
              });
            }

            await transaction.publicFormsTokens.delete({
              where: { token: token.token },
            });

            // deleteMany, not delete. delete() throws P2025 when the row is
            // already gone and rolls back everything, so the token survives
            // and comes back tomorrow. deleteMany is a no-op on zero matches.
            if (token.entityId) {
              await transaction.entity.deleteMany({
                where: { id: token.entityId },
              });
            }
          });

          deleted += 1;
        } catch (error) {
          failed += 1;
          failedTokens.add(token.token)
          // Per-token transaction: one bad row fails alone instead of taking
          // the rest of the batch with it. Log the error, not just the row.
          logger.error("Failed to clean up form token", {
            token: token.token,
            entityId: token.entityId,
            error,
          });
        }
      }
    }

    logger.info("cleanup_unsubmitted_forms finished", { deleted, failed });
    await update_job_status(job.id, failed ? "failed" : "completed");
  } catch (error) {
    logger.error("Error cleaning up unsubmitted forms:", error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};