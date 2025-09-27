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
        createdAt: {
          lt: sevenDaysAgo, // days older than a week ago
        },
      },
      select: {
        token: true,
        entityId: true,
        productId: true
      }
    });

    const entityIds = expiredTokens.map(expiredToken => expiredToken.entityId).filter(entityId => entityId != null);
    const productIds = expiredTokens.map(expiredToken => expiredToken.productId).filter(productId => productId != null);
    const tokens = expiredTokens.map(expiredToken => expiredToken.token).filter(token => token != null);


    const relationships = await prisma.relationship.findMany({
      where: {
        product_id: productIds,
        status: "new"
      },
      select: {
        id: true,
      }
    })
    const relationshipIds = relationships.map(relationship => relationship.id)

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
          id: {
            in: tokens
          }
        }
      }),
      // Delete all corpus items associated with the entity
      prisma.new_corpus.deleteMany({
        where: {
          id: {
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

    await update_job_status(job.id, "completed");
  } catch (error) {
    console.error("Error cleaning up unsubmitted forms:", error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};
