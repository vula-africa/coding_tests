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

/**
 * Cleanup job that runs daily at midnight to remove:
 * - Unsubmitted form tokens older than 7 days
 * - Associated entities, relationships, and corpus items
 *
 * This prevents database clutter from abandoned form submissions.
 */

interface ExpiredToken {
  token: string;
  entityId: string | null;
  productId: string | null;
}

export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue): Promise<void> => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    // Fetch only the fields needed for deletion
    const expiredTokens: ExpiredToken[] = await prisma.publicFormsTokens.findMany({
      where: {
        createdAt: { lt: sevenDaysAgo },
        submitted: false,
      },
      select: {
        token: true,
        entityId: true,
        productId: true,
      },
    });

    if (expiredTokens.length === 0) {
      console.log("Cleanup: No expired tokens found");
      await update_job_status(job.id, "completed");
      return;
    }

    // Extract and deduplicate IDs
    const tokens: string[] = expiredTokens.map((t) => t.token);
    const entityIds: string[] = [
      ...new Set(
        expiredTokens
          .map((t) => t.entityId)
          .filter((id): id is string => id !== null)
      ),
    ];
    const productIds: string[] = [
      ...new Set(
        expiredTokens
          .map((t) => t.productId)
          .filter((id): id is string => id !== null)
      ),
    ];

    // Single atomic transaction with bulk operations
    // Order: children before parents (respects foreign key constraints)
    await prisma.$transaction([
      // 1. Delete relationships (references entity)
      prisma.relationship.deleteMany({
        where: {
          status: "new",
          product_id: { in: productIds },
          entity_id: { in: entityIds },
        },
      }),

      // 2. Delete corpus items (references entity)
      prisma.new_corpus.deleteMany({
        where: { entity_id: { in: entityIds } },
      }),

      // 3. Delete tokens (references entity)
      prisma.publicFormsTokens.deleteMany({
        where: { token: { in: tokens } },
      }),

      // 4. Delete entities last (parent record)
      prisma.entity.deleteMany({
        where: { id: { in: entityIds } },
      }),
    ]);

    console.log(
      `Cleanup completed: ${tokens.length} tokens, ${entityIds.length} entities removed`
    );
    await update_job_status(job.id, "completed");
  } catch (error) {
    console.error("Error cleaning up unsubmitted forms:", error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};

