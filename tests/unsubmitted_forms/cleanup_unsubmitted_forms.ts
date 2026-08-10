/* Context: 
 This is a scheduled job that runs every day at midnight to clean up forms that users started filling in but didn't submit which are older than 7 days. 
 When a user visits a public form, a token is generated and stored in the database.
 This token is used to identify the user and link the answers to the entity.
 An entity is the owner of data in the database, separated as it could be a business or an individual but has been decoupled from a login/user.
 This entity is a profile within Vula which it will match funding opportunities and send then alerts about their business profile.
 If the user does not submit the form, the token and the entity should be deleted after 7 days.
 This is to prevent the database from being cluttered with unused tokens and entities.
 */

/* The Goal:
┌──────────────────────────────────────┐
│ Scheduled job                        │
│                                      │
│ 1. Calculate cleanup cutoff           │
│ 2. Fetch a batch of eligible tokens  │
│ 3. Clean each token                  │
│ 4. Track failures                    │
│ 5. Update scheduler status           │
└──────────────────────────────────────┘
                    │
                    ▼
        cleanupUnsubmittedForm()
                    │
                    ▼
             Prisma transaction
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   relationship   corpus      token
                                │
                                ▼
                              entity
 */

// For the purpose of this test you can ignore that the imports are not working.
import type { JobScheduleQueue } from "@prisma/client";
import { prisma } from "../endpoints/middleware/prisma";
import { update_job_status } from "./generic_scheduler";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 500;

type PublicFormToken = Awaited<
  ReturnType<typeof prisma.publicFormsTokens.findMany>
>[number];

/**
 * Removes all data created for an abandoned public form.
 *
 * The cleanup is atomic so we don't leave an entity with only some
 * of its temporary data removed.
 */
const cleanupUnsubmittedForm = async (token: PublicFormToken) => {
  await prisma.$transaction([
    // Remove the relationship created for this form.
    ...(token.entityId
      ? [
        prisma.relationship.deleteMany({
          where: {
            product_id: token.productId,
            entity_id: token.entityId,
            status: "new",
          },
        }),

        // Remove data collected while building the entity.
        prisma.new_corpus.deleteMany({
          where: {
            entity_id: token.entityId,
          },
        }),
      ]
      : []),

    // The token itself is no longer needed.
    prisma.publicFormsTokens.delete({
      where: {
        token: token.token,
      },
    }),

    // Remove the temporary entity after its dependent data.
    ...(token.entityId
      ? [
        prisma.entity.deleteMany({
          where: {
            id: token.entityId,
          },
        }),
      ]
      : []),
  ]);
};

export const cleanup_unsubmitted_forms = async (
  job: JobScheduleQueue,
) => {
  const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);

  let deletedCount = 0;

  /*
   * Tokens that failed to delete are excluded from subsequent pages.
   * Without this, a permanently failing token would be re-fetched and
   * retried on every iteration, inflating the failure count.
   */
  const failedTokens = new Set<string>();

  try {
    while (true) {
      const expiredTokens =
        await prisma.publicFormsTokens.findMany({
          where: {
            createdAt: {
              lt: cutoff,
            },
            submittedAt: null,
            token: {
              notIn: [...failedTokens],
            },
          },
          take: BATCH_SIZE,
        });

      /*
       * The query always starts from the first page because successful
       * records are deleted from the result set and failed ones are
       * excluded, so an empty page means the backlog is fully drained.
       */
      if (expiredTokens.length === 0) {
        break;
      }

      for (const token of expiredTokens) {
        try {
          await cleanupUnsubmittedForm(token);

          deletedCount++;
        } catch (error) {
          failedTokens.add(token.token);

          console.error(
            `Failed to clean up unsubmitted form token ${token.token} ` +
            `(entity ${token.entityId}):`,
            error,
          );
        }
      }
    }

    const failedCount = failedTokens.size;

    console.log(
      `cleanup_unsubmitted_forms: deleted ${deletedCount}, ` +
      `failed ${failedCount}`,
    );

    await update_job_status(
      job.id,
      failedCount > 0 ? "failed" : "completed",
    );
  } catch (error) {
    console.error(
      "Error cleaning up unsubmitted forms:",
      error,
    );

    await update_job_status(job.id, "failed");

    throw error;
  }
};
