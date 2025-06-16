/* Context: 
 This is a scheduled job that runs every day at midnight to clean up unsubmitted forms that are older than 7 days. 
 When a user visits a public form (not an internal form where the user has already made an account), a token is generated and stored in the database.
-This allows any answers given can be linked to the entity, and allows the users to directly apply to the product without creating an account.
+This allows any form answers to be linked to the entity, and allows the users to directly apply to the product without creating an account.
 If the user does not submit the form, the token and the entity should be deleted after 7 days.
 This is to prevent the database from being cluttered with unused tokens and entities.
 */
 
-// For the code test you can ignore that the imports are not working.
+// For the purpose of this test you can ignore that the imports are not working.
import type { JobScheduleQueue } from "@prisma/client";
import { prisma } from "../endpoints/middleware/prisma";
import { update_job_status } from "./generic_scheduler";

export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue) => {
  try {
    //Find forms that were created 7 days ago and have not been submitted
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
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
