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
    // Find forms older than 7 days that have not been submitted
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const expiredTokens = await prisma.publicFormsTokens.findMany({
      where: {
        createdAt: {
          lt: sevenDaysAgo,
        },
      },
    });

    const BATCH_SIZE = 100;
    let failureCount = 0;

    for (let i = 0; i < expiredTokens.length; i += BATCH_SIZE) {
      const batch = expiredTokens.slice(i, i + BATCH_SIZE);
      const tokensWithEntity = batch.filter((token) => token.entityId);

      const relationships =
        tokensWithEntity.length > 0
          ? await prisma.relationship.findMany({
              where: {
                status: "new",
                product_id: {
                  in: tokensWithEntity.map((token) => token.productId),
                },
                entity_id: {
                  in: tokensWithEntity.map((token) => token.entityId as string),
                },
              },
            })
          : [];

      const relationshipByKey = new Map(
        relationships.map((relationship) => [
          `${relationship.product_id}:${relationship.entity_id}`,
          relationship,
        ]),
      );

      for (const token of batch) {
        try {
          if (!token.entityId) {
            await prisma.publicFormsTokens.delete({
              where: { token: token.token },
            });
            continue;
          }

          const relationship = relationshipByKey.get(
            `${token.productId}:${token.entityId}`,
          );

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
                  entity_id: token.entityId,
                },
              }),
              // Delete the entity (company)
              prisma.entity.delete({
                where: { id: token.entityId },
              }),
            ]);
          } else {
            // No matching unsubmitted relationship — still remove the expired token
            // and any entity/corpus left behind from an abandoned form
            await prisma.$transaction([
              prisma.publicFormsTokens.delete({
                where: { token: token.token },
              }),
              prisma.new_corpus.deleteMany({
                where: {
                  entity_id: token.entityId,
                },
              }),
              prisma.entity.delete({
                where: { id: token.entityId },
              }),
            ]);
          }
        } catch (tokenError) {
          failureCount += 1;
          console.error(
            `Error cleaning up unsubmitted form token ${token.token}:`,
            tokenError,
          );
        }
      }
    }

    await update_job_status(
      job.id,
      failureCount > 0 ? "failed" : "completed",
    );
  } catch (error) {
    console.error("Error cleaning up unsubmitted forms:", error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};
