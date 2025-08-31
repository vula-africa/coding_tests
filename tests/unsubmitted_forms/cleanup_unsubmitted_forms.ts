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


/**
 * Pseudo Code Implemenations:
 * 
 */

// For the purpose of this test you can ignore that the imports are not working.
import type { JobScheduleQueue } from "@prisma/client";
import { prisma } from "../endpoints/middleware/prisma";
import { update_job_status } from "./generic_scheduler";


/**
 * 
 * currentPseudocode:
 * function cleanup_unsubmitted_forms(job):
 *    - TRY
 *      - SET sevendaysAgo to new Date(Date.now() - 7 * 24 * 60 * 60); 
 *      - SET sevendaysAgoPlusOneDay to new Date(sevendaysAgo.getTime() + 24 * 60 * 60 * 1000);
 *      - SET expiredTokens to await prisma.publicFormsTokens.findMany({
 *        where: {
 *          createdAt: {
 *            gte: sevendaysAgo,  
 *            lt: sevendaysAgoPlusOneDay,
 *          },
 *        },
 *      });
 *      - FOR each expiredToken in expiredTokens
 *        - SET relationship to await prisma.relationship.findFirst({
 *          where: {
 *            product_id: expiredToken.productId,
 *            status: "new",
 *          },
 *        });
 *        - IF relationship exists
 *          - await prisma.$transaction([
 *            - DELETE relationship
 *            - DELETE the token
 *            - DELETE all corpus items associated with the entity
 *            - DELETE the entity (company)
 *      - ELSE
 *        - DO NOTHING
 *    - CATCH error
 *      - LOG error
 * 
 */

// CONSIDER: Move this to a constants file
const DAYS_AGO = 7;
export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue) => {
  try {
    console.log("Initializing cleanup submitted forms function")
    // Find forms that were created 7 days ago and have not been submitted
    // CRITICAL BUG FIX: Ensure we are considering millisecond calculation
    const cutOffDate = new Date(Date.now() - DAYS_AGO * 24 * 60 * 60 * 1000);
    const expiredTokens = await prisma.publicFormsTokens.findMany({
      where: {
        createdAt: {
          lt: cutOffDate
        },
      },
    });

    if (expiredTokens.length) {
      console.log(`No expired tokens present. Exiting.`)
      await update_job_status(job.id, "completed");
    };

    console.log(`Expired tokens present. Current count at ${expiredTokens.length}.`)

    // PERFORMANCE FIX
    // Use in memory store instead of O(n) time complexity calls to the database
    const productIds = expiredTokens.map(token => token.productId);
    const allNewrelationships = await prisma.relationship.findMany({
      where: {
        product_id: { in: productIds },
        status: 'new',
      },
    });

    // Create relationships look up. O(1) complexity in time
    // TRADE OFF: More memory used and complexity of space
    let relationshipsLookup = {};
    allNewrelationships.forEach(rel => {
      relationshipsLookup[rel.product_id] = rel
    });

    for (const token of expiredTokens) {
      const relationship = relationshipsLookup[token.productId]

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
