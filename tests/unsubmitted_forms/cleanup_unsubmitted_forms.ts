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

const CHUNK_SIZE = 2000;

export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue) => {
  try {
    // Find forms that were created more than 7 days ago and have not been submitted
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    while (true) {
      // I assume publicFormsTokens holds a one-to-one relationship between a product(form) and a token generated for the entity when filling in the form.
      // for exeample table can hold three tokens each for three forms(a one-to-one) all for one entity
      const expiredTokens = await prisma.publicFormsTokens.findMany({
        where: {
          createdAt: {
            lt: sevenDaysAgo, // older than 7 days
          },
        },
        select: {
          token: true,
          productId: true,
          entityId: true,
        },
        take: CHUNK_SIZE
      });

      // When no records are found or loop has finished all chunks
      if (expiredTokens.length === 0) {
        await update_job_status(job.id, "completed");
        break
      }

      // Now I have an array of expired tokens
      // I assume this is the sample of expiredTokens:
      // [
      //   {
      //     productId: "123", --> id ofthe form being filled in by the entity
      //     entityId: "456",
      //     token: "789",
      //     createdAt: "2026-01-01",
      //   }
      // ]

      // I assume a product is the form being filled in by the entity.
      // I assume relationship table holds a one-to-many relationship between an entity and products(forms filled) and has a status - essentially an entity can partially fill multiple forms.
      // [
      //   {
      //     id: "123",
      //     productId: "123",
      //     entityId: "456",
      //     status: "new",
      //   }
      // ]

      // I assume a new_corpus holds a one-to-many relationship between an entity and answers they already entered into a form.
      // [
      //   {
      //     id: "123",
      //     productId: "123",
      //     entityId: "456",
      //     type: "form",
      //     data: { answers: [
      //       { // like a JSONB of answers entered into the form
        //       name: "John Doe",
        //       email: "john.doe@example.com",
        //       phone: "1234567890",
        //     }]},
      //     createdAt: "2026-01-01",
      //   }
      // ]
      // Now I need to delete the relationship, the token, and all corpus items associated with the entity.

      // Get product ids and remove duplicates
      const productsToDelete = [...new Set(expiredTokens.map((t: any) => t.productId))]

      // Get token ids and remove duplicates
      const tokensToDelete = [...new Set(expiredTokens.map((t: any) => t.token))]

      // Get entityIds and remove duplicates
      const entityIdToDelete = [
        ...new Set(
          expiredTokens
        .map((e: any)=> e.entityId)
        .filter((id: any): id is string => Boolean(id)) // filter out falsy values
      )]

      // find relationships that are still new
      const relationshipsToDelete = await prisma.relationship.findMany({
        where: {
          product_id: { in: productsToDelete },
          status: "new"
        },
        select: { id: true },
      })

      if (relationshipsToDelete.length === 0) {
        // then end the job
        await update_job_status(job.id, "completed");
        return;
      }

      const relationshipsIdsToDelete = relationshipsToDelete.map((r: any) => r.id)

      // I need to use a transaction to ensure that the operations are atomic.
      await prisma.$transaction([
        // Delete relationship
        prisma.relationship.deleteMany({
          where: {
            id: {
              in: relationshipsIdsToDelete
            }
          },
        }),

        // Delete corpus
        prisma.new_corpus.deleteMany({
          where: {
            entity_id: {
              in: entityIdToDelete
            }
          }
        }),

        // Delete the token
        prisma.publicFormsTokens.deleteMany({
          where: {
            token: {
              in: tokensToDelete
            }
          }
        }),

        // Delete entities
        prisma.entity.deleteMany({
          where: {
            id: {
              in: entityIdToDelete
            }
          }
        })
      ])
    }

    await update_job_status(job.id, "completed");
  } catch (error) {
    console.error("Error cleaning up unsubmitted forms:", error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};
