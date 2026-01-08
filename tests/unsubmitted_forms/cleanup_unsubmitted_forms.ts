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
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const expiredTokens = await prisma.publicFormsTokens.findMany({
      where: {
        createdAt: {
          lt: cutoffDate, // but less than 7 days ago + 1 day
        },
      },
    });

    for (const token of expiredTokens) {
      const relationship = await prisma.relationship.findFirst({
        where: {
          product_id: token.productId,
          status: "new",
        },
      });

      if (relationship) {
        try {
          await prisma.$transaction([
        // Delete relationship first
        prisma.relationship.delete({
          where: { id: relationship.id },
        }),
        // Delete all corpus items associated with the entity
        prisma.new_corpus.deleteMany({
          where: {
            entity_id: token.entityId,
          },
        }),
        // Delete the entity
        prisma.entity.delete({
          where: { id: token.entityId },
        }),
        // Delete the token last
        prisma.publicFormsTokens.delete({
          where: { token: token.token },
        }),
          ]);
        } catch (transactionError) {
          console.error(`Failed to delete expired token ${token.token}:`, transactionError);
          // Continue with next token instead of failing entire job
          continue;
        }
      } else {
        // If no relationship found, still delete the token and entity
        try {
          await prisma.$transaction([
        // Delete all corpus items associated with the entity
        prisma.new_corpus.deleteMany({
          where: {
            entity_id: token.entityId,
          },
        }),
        // Delete the entity
        prisma.entity.delete({
          where: { id: token.entityId },
        }),
        // Delete the token last
        prisma.publicFormsTokens.delete({
          where: { token: token.token },
        }),
          ]);
        } catch (transactionError) {
          console.error(`Failed to delete expired token ${token.token}:`, transactionError);
          // Continue with next token instead of failing entire job
          continue;
        }
      }
    }

    await update_job_status(job.id, "completed");
  } catch (error) {
    console.error("Error cleaning up unsubmitted forms:", error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};
