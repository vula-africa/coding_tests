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
import { Prisma, type JobScheduleQueue } from "@prisma/client";
import { prisma } from "../endpoints/middleware/prisma";
import { update_job_status } from "./generic_scheduler";

const FORM_EXPIRY_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 500;

export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue) => {
  try {
    // Capture one cutoff for the whole run. There is intentionally no lower
    // bound: every unsubmitted form older than seven days is eligible.
    const UNSUBMITTED_FORM_CUTOFF = new Date(
      Date.now() - FORM_EXPIRY_AGE_MS
    );

    let processed = 0;
    let skipped = 0;
    let failed = 0;
    let hasMore = true;
    const failedTokens = new Set<string>();

    while (hasMore) {
      const expiredTokens = await prisma.publicFormsTokens.findMany({
        where: {
          createdAt: {
            lt: UNSUBMITTED_FORM_CUTOFF,
          },
          submittedAt: null,
          ...(failedTokens.size > 0
            ? { token: { notIn: [...failedTokens] } }
            : {}),
        },
        take: BATCH_SIZE,
        orderBy: [{ createdAt: "asc" }, { token: "asc" }],
      });

      if (expiredTokens.length === 0) {
        break;
      }

      let cleanedInBatch = 0;

      for (const token of expiredTokens) {
        if (!token.entityId) {
          console.warn(
            `Token ${token.token} missing entityId — skipping cleanup`
          );
          failed++;
          failedTokens.add(token.token);
          console.error(
            `Cannot atomically clean up token ${token.token} without an entityId`
          );
          continue;
        }

        try {
          const result = await prisma.$transaction(
            async (tx) => {
              // Re-check eligibility inside the transaction. If the form was
              // submitted after the batch query, nothing is deleted.
              const tokenResult = await tx.publicFormsTokens.deleteMany({
                where: {
                  token: token.token,
                  createdAt: { lt: UNSUBMITTED_FORM_CUTOFF },
                  submittedAt: null,
                },
              });

              if (tokenResult.count === 0) {
                return "skipped" as const;
              }

              await tx.relationship.deleteMany({
                where: {
                  product_id: token.productId,
                  entity_id: token.entityId,
                  status: "new",
                },
              });
              await tx.new_corpus.deleteMany({
                where: { entity_id: token.entityId },
              });
              await tx.entity.delete({ where: { id: token.entityId } });
              return "cleaned" as const;
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
          );

          if (result === "cleaned") {
            processed++;
            cleanedInBatch++;
          } else {
            skipped++;
          }
        } catch (err) {
          failed++;
          failedTokens.add(token.token);
          console.error(`Failed cleaning up token ${token.token}:`, err);
        }
      }

      // Failed records are excluded from later batches. The no-progress guard
      // also protects against records that remain eligible after a race or a
      // database-specific transaction outcome.
      if (cleanedInBatch === 0 || expiredTokens.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    console.log(
      `Cleanup: ${processed} cleaned, ${skipped} skipped, ${failed} failed`
    );
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
