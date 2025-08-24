/* Context: 
 This is a scheduled job that runs every day at midnight to clean up forms that users started filling in but didn't submit which are older than 7 days. 
 When a user visits a public form, a token is generated and stored in the database.
 This token is used to identify the user and link the answers to the entity.
 An entity is the owner of data in the database, separated as it could be a business or an individual but has been decoupled from a login/user.
 If the user does not submit the form, the token and the entity should be deleted after 7 days.
 This is to prevent the database from being cluttered with unused tokens and entities.
 */

/* Task:
 1. Read the code below and understand what it does.
 2. Identify the issues in the code.
 3. Fix the issues and make a PR with the changes.
 4. Explain the changes you made in the PR description *and* in a screen recording / loom video.
*/

// For the purpose of this test you can ignore that the imports are not working.
import type { JobScheduleQueue } from "@prisma/client";
import { prisma } from "../endpoints/middleware/prisma";
import { update_job_status } from "./generic_scheduler";

export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue) => {
  try {
    //Find forms that were created 7 days ago and have not been submitted
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60);
    const sevenDaysAgoPlusOneDay = new Date(
      sevenDaysAgo.getTime() + 24 * 60 * 60 * 1000
    );

    const expiredTokens = await prisma.publicFormsTokens.findMany({
      where: {
        createdAt: {
          gte: sevenDaysAgo, // greater than or equal to 7 days ago
          lt: sevenDaysAgoPlusOneDay, // but less than 7 days ago + 1 day
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
        await prisma.$transaction([
          // Delete relationship
          prisma.relationship.delete({
            where: { id: relationship.id },
          }),
          // // Delete the token
          prisma.publicFormsTokens.delete({
            where: { token: token.token },
          }),
          // Delete all corpus items associated with the entity
          prisma.new_corpus.deleteMany({
            where: {
              entity_id: token.entityId || "",
            },
          }),
          // Delete the entity (company)
          prisma.entity.delete({
            where: { id: token.entityId || "" },
          }),
        ]);
      }
    }

    await update_job_status(job.id, "completed");
  } catch (error) {
    console.error("Error cleaning up unsubmitted forms:", error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};
