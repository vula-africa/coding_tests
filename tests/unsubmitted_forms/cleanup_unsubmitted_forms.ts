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
import type { JobScheduleQueue, Prisma } from "@prisma/client";
import { prisma } from "../endpoints/middleware/prisma";
import { update_job_status } from "./generic_scheduler";

// Process cleanup in manageable chunks to reduce DB load and memory footprint
const BATCH_SIZE = 500;

export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue) => {
  const jobStartTime = new Date();
  let totalDeletedTokens = 0;
  let totalFailedChunks = 0;

  try {
    await update_job_status(job.id, "in_progress");
    // Use UTC midnight cutoff 7 days ago to avoid drift when the job runs late
    const cutoff = new Date();
    cutoff.setUTCHours(0, 0, 0, 0);
    cutoff.setUTCDate(cutoff.getUTCDate() - 7);

    console.log(`[Cleanup Job ${job.id}] Starting. Deleting tokens created before (UTC cutoff) ${cutoff.toISOString()}`);

    let lastCreatedAt: Date | undefined = undefined;
    let lastToken: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const expiredTokensPage = await prisma.publicFormsTokens.findMany({
        where: {
          // Only records strictly older than the UTC cutoff
          createdAt: { lt: cutoff },
          // Composite-cursor style pagination: (createdAt, token)
          ...(lastCreatedAt
            ? {
                OR: [
                  { createdAt: { gt: lastCreatedAt } },
                  { AND: [{ createdAt: lastCreatedAt }, { token: { gt: lastToken as string } }] },
                ],
              }
            : {}),
        },
        select: {
          token: true,
          entityId: true,
          productId: true,
          createdAt: true,
        },
        orderBy: [
          { createdAt: "asc" },
          { token: "asc" },
        ],
        take: BATCH_SIZE,
      });

      if (expiredTokensPage.length === 0) {
        hasMore = false;
        break;
      }

      const tokenIdsInBatch = expiredTokensPage.map((t) => t.token);
      const entityIdsInBatch = [
        ...new Set(expiredTokensPage.map((t) => t.entityId).filter(Boolean) as string[]),
      ];

      // retry the same page on transient failures without advancing the cursor
      let attempts = 0;
      const MAX_RETRIES = 3;
      while (true) {
        try {
        // Determine which entities are safe to delete (no other unexpired tokens reference them)
        let entityIdsSafeToDelete: string[] = [];
        if (entityIdsInBatch.length > 0) {
          const entitiesWithOtherTokens = await prisma.publicFormsTokens.findMany({
            where: {
              entityId: { in: entityIdsInBatch },
              token: { notIn: tokenIdsInBatch },
              // Keep entity if ANY other token exists (expired or not) to avoid FK issues/orphans
            },
            select: { entityId: true },
            distinct: ["entityId"],
          });
          const toKeep = new Set(entitiesWithOtherTokens.map((e) => e.entityId!).filter(Boolean));
          entityIdsSafeToDelete = entityIdsInBatch.filter((id) => !toKeep.has(id));
        }

        const ops: Prisma.PrismaPromise<unknown>[] = [];
        // Delete dependent data first
        if (entityIdsSafeToDelete.length > 0) {
          ops.push(
            prisma.new_corpus.deleteMany({ where: { entity_id: { in: entityIdsSafeToDelete } } })
          );
        }
        // Delete tokens in batch
        ops.push(
          prisma.publicFormsTokens.deleteMany({ where: { token: { in: tokenIdsInBatch } } })
        );
        // Delete entities that are safe to delete
        if (entityIdsSafeToDelete.length > 0) {
          ops.push(prisma.entity.deleteMany({ where: { id: { in: entityIdsSafeToDelete } } }));
        }
        // Optional: clean up relationships with status "new" tied to these entities or products
        const productIdsInBatch = [
          ...new Set(expiredTokensPage.map((t) => t.productId).filter(Boolean) as string[]),
        ];
        if (productIdsInBatch.length > 0) {
          ops.push(
            prisma.relationship.deleteMany({
              where: {
                product_id: { in: productIdsInBatch },
                status: "new",
                // Scope by entity where schema supports it to avoid over-deleting
                entity_id: { in: entityIdsSafeToDelete },
              },
            })
          );
        }
        await prisma.$transaction(ops);
        totalDeletedTokens += tokenIdsInBatch.length;
        console.log(
          `[Cleanup Job ${job.id}] Deleted ${tokenIdsInBatch.length} tokens. Deleted entities: ${entityIdsSafeToDelete.length}.`
        );
        // advance cursor only after a successful commit
        const last = expiredTokensPage[expiredTokensPage.length - 1];
        lastCreatedAt = last.createdAt;
        lastToken = last.token;
        break; // exit retry loop on success
      } catch (batchError) {
        attempts += 1;
        totalFailedChunks += 1;
        console.error(
          `[Cleanup Job ${job.id}] Failed batch (attempt ${attempts}/${MAX_RETRIES}) for tokens: ${tokenIdsInBatch.join(", ")}`,
          batchError
        );
        if (attempts < MAX_RETRIES) {
          // retry same page without advancing cursor
          continue;
        }
        // Exhausted retries; bail out to avoid infinite loop on deterministic errors
        throw batchError;
      }
      }
    }

    await update_job_status(job.id, "completed");
    console.log(
      `[Cleanup Job ${job.id}] Completed in ${new Date().getTime() - jobStartTime.getTime()}ms. Deleted tokens: ${totalDeletedTokens}. Failed chunks: ${totalFailedChunks}.`
    );
  } catch (error) {
    console.error("Error cleaning up unsubmitted forms:", error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};
