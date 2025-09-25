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
    console.log("🚀 Starting cleanup of unsubmitted forms...");
    
    // FIX: Correct date filtering - find ALL tokens older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    console.log(`📅 Looking for tokens older than: ${sevenDaysAgo}`);

    // FIX: Select only needed fields to reduce payload
    const expiredTokens = await prisma.publicFormsTokens.findMany({
      where: {
        createdAt: {
          lt: sevenDaysAgo,
        },
      },
      select: { token: true, entityId: true, productId: true }, // CODE RABBIT FIX: Reduce payload
    });

    console.log(`🔍 Found ${expiredTokens.length} expired tokens`);

    // CODE RABBIT FIX: Isolate per-token failures so one bad record doesn't abort entire job
    for (const token of expiredTokens) {
      try {
        // CODE RABBIT FIX: Guard against missing entityId
        if (!token.entityId) {
          console.log(`⚠️ Token ${token.token} has no entityId, deleting token only`);
          await prisma.publicFormsTokens.delete({ where: { token: token.token } });
          continue;
        }

        // FIX: Expanded status checking + CODE RABBIT FIX: Add entity_id constraint
        const relationship = await prisma.relationship.findFirst({
          where: {
            product_id: token.productId,
            entity_id: token.entityId, // CODE RABBIT FIX: Prevent cross-entity deletions
            status: { in: ["new", "draft", "in_progress"] },
          },
        });

        if (relationship) {
          console.log(`🗑️ Found relationship to delete: ${relationship.id}`);
          
          // CODE RABBIT FIX: Use interactive transaction for safety
          await prisma.$transaction(async (tx) => {
            const INCOMPLETE = ["new", "draft", "in_progress"] as const;

            // 1) Delete corpus tied to the entity
            await tx.new_corpus.deleteMany({
              where: { entity_id: token.entityId }, // CODE RABBIT FIX: Remove empty-string fallback
            });

            // 2) Delete ALL incomplete relationships for this entity
            await tx.relationship.deleteMany({
              where: {
                entity_id: token.entityId,
                status: { in: INCOMPLETE },
              },
            });

            // 3) Delete ALL tokens for this entity to avoid FK issues
            await tx.publicFormsTokens.deleteMany({
              where: { entityId: token.entityId },
            });

            // 4) Delete entity only if no relationships remain
            const remaining = await tx.relationship.count({
              where: { entity_id: token.entityId },
            });
            if (remaining === 0) {
              await tx.entity.delete({
                where: { id: token.entityId },
              });
            }
          });

          console.log(`✅ Cleaned up unsubmitted form for entity: ${token.entityId}`);
        } else {
          // CODE RABBIT FIX: Always delete stale token even if no relationship exists
          await prisma.publicFormsTokens.delete({ where: { token: token.token } });
          console.log(`➖ No incomplete relationship found; deleted stale token: ${token.token}`);
        }
      } catch (error) {
        // CODE RABBIT FIX: Isolate per-token failures
        console.error(`⚠️ Failed to clean token ${token.token}`, error);
        // Continue with next token instead of aborting entire job
      }
    }

    console.log(`🎉 Cleanup job completed. Processed ${expiredTokens.length} tokens.`);
    await update_job_status(job.id, "completed");
    
  } catch (error) {
    console.error(`❌ Cleanup job failed for job ID: ${job.id}`, error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};