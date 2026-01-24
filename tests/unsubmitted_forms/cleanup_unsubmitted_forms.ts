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
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days in ms

    // fetch only the fields we need to build our delete queries
    const expiredTokens = await prisma.publicFormsTokens.findMany({
      where: {
        createdAt: { lt: sevenDaysAgo },
      },
      select: { token: true, entityId: true, productId: true },
    });

    // nothing to clean up
    if (expiredTokens.length === 0) {
      await update_job_status(job.id, "completed");
      return;
    }

    // collect ids for batch deletion - filter out nulls
    const tokenStrings = expiredTokens.map((t) => t.token);
    const entityIds = expiredTokens
      .map((t) => t.entityId)
      .filter((id): id is string => id !== null && id !== undefined);
    const productIds = expiredTokens
      .map((t) => t.productId)
      .filter((id): id is string => id !== null && id !== undefined);

    // batch delete in a single transaction - order matters for FK constraints
    await prisma.$transaction([
      // delete relationships tied to these products that are still "new" (unsubmitted)
      prisma.relationship.deleteMany({
        where: {
          product_id: { in: productIds },
          status: "new",
        },
      }),
      // delete corpus items before entities (they reference entity_id)
      prisma.new_corpus.deleteMany({
        where: { entity_id: { in: entityIds } },
      }),
      // delete the entities
      prisma.entity.deleteMany({
        where: { id: { in: entityIds } },
      }),
      // finally delete the tokens
      prisma.publicFormsTokens.deleteMany({
        where: { token: { in: tokenStrings } },
      }),
    ]);

    await update_job_status(job.id, "completed");
  } catch (error) {
    console.error("Error cleaning up unsubmitted forms:", error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};
