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
    //Find forms that were created 7 days ago and have not been submitted
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const expiredTokens = await prisma.publicFormsTokens.findMany({
      where: {
        createdAt: { lt: sevenDaysAgo },
      },
      select: {
        token: true,
        entityId: true,
        productId: true,
      },
    });

    for (const token of expiredTokens) {
      await prisma.$transaction(async (tx) => {
          
        const relationships = await tx.relationship.findMany({
          where: {
            product_id: token.productId,
            status: "new",
          },
        });

        if (relationships.length > 0) {
          
          await tx.relationship.deleteMany({
            where: { id: { in: relationships.map((r) => r.id) } },
          });
        }

    
        await tx.publicFormsTokens.delete({
          where: { token: token.token },
        });

        if (token.entityId) {
          
          await tx.new_corpus.deleteMany({
            where: { entity_id: token.entityId },
          });

          await tx.entity.delete({
            where: { id: token.entityId },
          });
        }
      });
    }

    await update_job_status(job.id, "completed");
  } catch (error) {
    console.error("Error cleaning up unsubmitted forms:", error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};
