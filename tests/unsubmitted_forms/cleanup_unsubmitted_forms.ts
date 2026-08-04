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
    let lastToken: string | undefined;

    while (true) {
      const expiredTokens = await prisma.publicFormsTokens.findMany({
        where: {
          createdAt: {
            lt: UNSUBMITTED_FORM_CUTOFF,
          },
          submittedAt: null,
          ...(lastToken !== undefined
            ? { token: { gt: lastToken } }
            : {}),
        },
        take: BATCH_SIZE,
        // Token is unique and provides a stable keyset for bounded paging.
        orderBy: { token: "asc" },
      });

      if (expiredTokens.length === 0) {
        break;
      }

      for (const token of expiredTokens) {
        if (!token.entityId) {
          console.warn(
            `Token ${token.token} missing entityId — skipping cleanup`
          );
          failed++;
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
          } else {
            skipped++;
          }
        } catch (err) {
          failed++;
          console.error(`Failed cleaning up token ${token.token}:`, err);
        }
      }

      // Advance regardless of whether records cleaned successfully. This
      // leaves failures in the database for a later scheduled retry without
      // selecting them again during this run.
      lastToken = expiredTokens[expiredTokens.length - 1].token;
      if (expiredTokens.length < BATCH_SIZE) {
        break;
      }
    }

    console.log(
      `Cleanup summary: processed=${processed}, skipped=${skipped}, failed=${failed}`
    );
    // The scheduler supports completed and failed statuses. A run with
    // unresolved records is not fully successful, so report it as failed.
    await update_job_status(job.id, failed > 0 ? "failed" : "completed");
  } catch (error) {
    console.error("Error cleaning up unsubmitted forms:", error);
    try {
      await update_job_status(job.id, "failed");
    } catch (statusError) {
      // Do not replace the original job-level error with a status-update
      // failure. The original error is the actionable failure to the caller.
      console.error("Failed to update cleanup job status:", statusError);
    }
    throw error;
  }
};
