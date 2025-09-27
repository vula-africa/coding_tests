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

const CLEANUP_BATCH_SIZE = 50;
const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;
const TOKEN_EXPIRATION_DAYS = 7


export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue) => {
  try {
    //Find forms that were created 7 days ago and have not been submitted
    const startTime = new Date(Date.now())
    const sevenDaysAgo = new Date(startTime.getTime() - TOKEN_EXPIRATION_DAYS * MILLISECONDS_IN_DAY);


    console.info(`[cleanup] Starting cleanup job (id=${job.id}) at ${startTime.toISOString()}`);
    let hasMoreRecords = true;
    let batch = 1;
    while (hasMoreRecords){

      console.info(`[cleanup] Processing batch ${batch}...`);

      const expiredTokens = await prisma.publicFormsTokens.findMany({
        where: {
          createdAt: {
            lt: sevenDaysAgo, // days older than a week ago
          },
        },
        select: {
          token: true,
          entityId: true,
          productId: true
        },
        orderBy: {
          createdAt: 'asc', // Process oldest first
        },
        take: CLEANUP_BATCH_SIZE,
      });

      if (expiredTokens.length === 0){
        console.info(`[cleanup] No more expired tokens found. Stopping at batch ${batch}.`);
        hasMoreRecords = false;
        break;
      }

      const entityIds = expiredTokens.map(expiredToken => expiredToken.entityId).filter(entityId => entityId != null);
      const productIds = expiredTokens.map(expiredToken => expiredToken.productId).filter(productId => productId != null);
      const tokens = expiredTokens.map(expiredToken => expiredToken.token).filter(token => token != null);


      const relationships = await prisma.relationship.findMany({
        where: {
          product_id: {
            in : productIds
          },
          status: "new"
        },
        select: {
          id: true,
        }
      })
      const relationshipIds = relationships.map(relationship => relationship.id)

      console.info( `[cleanup] Batch ${batch} prepared: ${entityIds.length} entities , ${productIds.length} products,  ${tokens.length} tokens and 
                ${relationshipIds.length} relationships to delete
            ` );

      await prisma.$transaction([
        // Delete relationships
        prisma.relationship.deleteMany({
          where: {
            id: {
              in: relationshipIds,
            }
          },
        }),
        // Delete tokens
        prisma.publicFormsTokens.deleteMany({
          where: {
            token: {
              in: tokens
            }
          }
        }),
        // Delete all corpus items associated with the entity
        prisma.new_corpus.deleteMany({
          where: {
            entity_id: {
              in: entityIds
            }
          }
        }),

        // Delete the entity (company)
        prisma.entity.deleteMany({
          where: {
            id: {
              in: entityIds
            }
          }
        })
      ])

      console.info( `[cleanup] Batch ${batch} deleted: ${entityIds.length} entities , ${productIds.length} products,  ${tokens.length} tokens and 
                ${relationshipIds.length} relationships.
            ` );

      batch++;
    }

    const endTime = new Date();
    console.info( `[cleanup] Job ${job.id} completed successfully at ${endTime.toISOString()} (duration it take for the cleanup to finish: ${ (endTime.getTime() - startTime.getTime()) / 1000 }s)` );
    await update_job_status(job.id, "completed");
  } catch (error) {
    console.error(`[cleanup] Job ${job.id} failed at ${new Date().toISOString()}: `, error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};
