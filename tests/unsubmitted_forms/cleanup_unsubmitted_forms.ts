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
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // I added * 1000 to convert days to milliseconds
    // I changed the query to find tokens older than 7 days (lt instead of gte/lt range)
    const expiredTokens = await prisma.publicFormsTokens.findMany({
      where: {
        createdAt: {
          lt: sevenDaysAgo, // I used the lt operator to find tokens that were created before 7 days ago
        },
      },
    });

    // I fixed the N+1 query problem - fetch all relationships in one query instead of per token
    const productIds = expiredTokens.map(t => t.productId).filter((id): id is string => id != null);
    const entityIds = expiredTokens.map(t => t.entityId).filter((id): id is string => id != null);
    // I added entity_id filter to prevent deleting relationships from other entities in shared-product scenarios
    const relationships = await prisma.relationship.findMany({
      where: {
        product_id: { in: productIds },
        entity_id: { in: entityIds },
        status: "new",
      },
    });
    // I created a lookup map for O(1) access using composite key (productId + entityId)
    const relationshipMap = new Map(relationships.map(r => [`${r.product_id}:${r.entity_id}`, r]));

    for (const token of expiredTokens) {
      const relationship = relationshipMap.get(`${token.productId || ""}:${token.entityId || ""}`);

      // I fixed the issue of deleting tokens and entities even if no relationship exists (unsubmitted forms may not have relationships)
      if (relationship) {
        // I used an interactive transaction for proper error handling and atomicity
        await prisma.$transaction(async (tx) => {
          // Delete relationship
          await tx.relationship.delete({
            where: { id: relationship.id },
          });
          // Delete the token
          await tx.publicFormsTokens.delete({
            where: { token: token.token },
          });
          // Delete all corpus items associated with the entity
          await tx.new_corpus.deleteMany({
            where: {
              entity_id: token.entityId || "",
            },
          });
          // Delete the entity (company)
          await tx.entity.delete({
            where: { id: token.entityId || "" },
          });
        });
      } else {
        // I fixed the issue of deleting tokens and entities even if no relationship exists (unsubmitted forms may not have relationships)
        await prisma.$transaction(async (tx) => {
          // Delete the token
          await tx.publicFormsTokens.delete({
            where: { token: token.token },
          });
          // Delete all corpus items associated with the entity
          await tx.new_corpus.deleteMany({
            where: {
              entity_id: token.entityId || "",
            },
          });
          // Delete the entity (company)
          await tx.entity.delete({
            where: { id: token.entityId || "" },
          });
        });
      }
    }

    await update_job_status(job.id, "completed");
  } catch (error) {
    console.error("Error cleaning up unsubmitted forms:", error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};
