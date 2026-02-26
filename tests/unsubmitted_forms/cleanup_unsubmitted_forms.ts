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

export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue) => {
  try {
    // Bug 1 fixed: Date.now() is in milliseconds so we must multiply by 1000.
    // The original code used 7 * 24 * 60 * 60 (seconds) instead of 7 * 24 * 60 * 60 * 1000 (milliseconds),
    // causing sevenDaysAgo to be only ~7 seconds in the past rather than 7 days.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Bug 2 fixed: The original query used a narrow window (gte sevenDaysAgo, lt sevenDaysAgo + 1 day),
    // which only targeted tokens created in a 1-day band around 7 days ago.
    // The correct intent is to find ALL tokens older than 7 days, i.e. createdAt <= sevenDaysAgo.
    const expiredTokens = await prisma.publicFormsTokens.findMany({
      where: {
        createdAt: {
          lte: sevenDaysAgo, // older than or equal to 7 days ago
        },
      },
    });

    for (const token of expiredTokens) {
      // Bug 3 fixed: the original lookup used product_id: token.productId, which is unrelated
      // to this token. The relationship to clean up is the one linked to the entity, so we
      // filter by entity_id: token.entityId instead.
      //
      // Bug 4 fixed: Skip tokens with no entityId rather than falling back to an empty string,
      // which could match unintended records or cause a DB error on delete.
      if (!token.entityId) {
        // Always delete the orphaned token even if there is no entity to clean up.
        await prisma.publicFormsTokens.delete({
          where: { token: token.token },
        });
        continue;
      }

      const relationship = await prisma.relationship.findFirst({
        where: {
          entity_id: token.entityId,
          status: "new",
        },
      });

      // Bug 5 fixed: The original code skipped deletion of the token and entity when no
      // relationship was found. Tokens and entities that were never linked to a relationship
      // must still be cleaned up. We now always delete the token and entity, and only
      // additionally delete the relationship record when one exists.
      await prisma.$transaction([
        // Delete relationship only if one was found
        ...(relationship
          ? [
              prisma.relationship.delete({
                where: { id: relationship.id },
              }),
            ]
          : []),
        // Delete the token
        prisma.publicFormsTokens.delete({
          where: { token: token.token },
        }),
        // Delete all corpus items associated with the entity
        prisma.new_corpus.deleteMany({
          where: {
            entity_id: token.entityId,
          },
        }),
        // Delete the entity (company)
        prisma.entity.delete({
          where: { id: token.entityId },
        }),
      ]);
    }

    await update_job_status(job.id, "completed");
  } catch (error) {
    console.error("Error cleaning up unsubmitted forms:", error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};
