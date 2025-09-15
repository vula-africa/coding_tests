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


// I am setting the number of miliseconds in a day
const no_of_ms = 24 * 60 * 60 * 1000;


export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue) => {
  try {
    // I am setting a cut off date for the tokens that are older than 7 days
    const cutoff_date = new Date(Date.now() - 7 * no_of_ms);

    // here i am checking where the tokens are older than 7 days and not submitted
    const expiredTokens = await prisma.publicFormsTokens.findMany({
      where: {
        createdAt: { lt: cutoff_date },
        submittedAt: null,
      },
    });

    for (const token of expiredTokens) {
      // here i am checking if the token is orphaned without an entity
      if (!token.entityId) {
        await prisma.publicFormsTokens.delete({ where: { token: token.token } });
        continue;
      }

      const entityId = token.entityId;

      // i am determining if the entity is safe to delete and has no submitted tokens and no non-"new" relationships
      const [submittedTokenCount, nonNewRelCount] = await Promise.all([
        prisma.publicFormsTokens.count({
          where: {
            entityId,
            submittedAt: { not: null },
          },
        }),
        prisma.relationship.count({
          where: {
            entity_id: entityId,
            NOT: { status: "new" }, // anything other than 'new' blocks deletion
          },
        }),
      ]);

      const safeToDeleteEntity = submittedTokenCount === 0 && nonNewRelCount === 0;

      // i have decided to trasnsactionally delete the things in the correct order
      await prisma.$transaction(async (tx) => {
        // // Delete the token
        await tx.publicFormsTokens.delete({
          where: { token: token.token },
        });

        if (safeToDeleteEntity) {
          // remove new relationships tied to this entity
          await tx.relationship.deleteMany({
            where: {
              entity_id: entityId,
              status: "new",
            },
          });

          // Delete all corpus items associated with the entity
          await tx.new_corpus.deleteMany({
            where: { entity_id: entityId },
          });

          // Delete the entity (company)
          await tx.entity.delete({
            where: { id: entityId },
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
