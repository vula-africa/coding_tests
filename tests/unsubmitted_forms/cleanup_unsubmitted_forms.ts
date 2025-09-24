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
    // ISSUE 1: Incorrect date calculation and filtering
    // ORIGINAL: Only targets tokens created exactly 7 days ago (24-hour window)
    // PROBLEM: Misses tokens older than 7 days, only gets exact 7-day-old tokens
    // FIX: Find ALL tokens older than 7 days
    
    // ORIGINAL (flawed):
    // const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60);
    // const sevenDaysAgoPlusOneDay = new Date(sevenDaysAgo.getTime() + 24 * 60 * 60 * 1000);
    
    // FIXED: Calculate 7 days ago correctly (include milliseconds)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const expiredTokens = await prisma.publicFormsTokens.findMany({
      where: {
        createdAt: {
          // ORIGINAL (flawed): gte: sevenDaysAgo, lt: sevenDaysAgoPlusOneDay
          // PROBLEM: This creates a 24-hour window for exactly 7-day-old tokens only
          // FIXED: Use 'lt' to get ALL tokens older than 7 days
          lt: sevenDaysAgo, // LESS THAN 7 days ago (includes all older tokens)
        },
      },
    });

    for (const token of expiredTokens) {
      // ISSUE 2: Limited status checking
      // ORIGINAL: Only checks for "new" status
      // PROBLEM: Misses forms with other incomplete statuses like "draft", "in_progress"
      // FIX: Check for all possible incomplete statuses
      
      const relationship = await prisma.relationship.findFirst({
        where: {
          product_id: token.productId,
          // ORIGINAL (flawed): status: "new",
          // FIXED: Include all incomplete form statuses
          status: { in: ["new", "draft", "in_progress"] },
        },
      });

      if (relationship) {
        // ISSUE 3: Incorrect deletion order (potential foreign key constraints)
        // ORIGINAL ORDER: relationship → token → corpus → entity
        // PROBLEM: May violate foreign key constraints if entities are deleted before dependencies
        // FIX: Delete in reverse dependency order (dependencies first, parent records last)
        
        await prisma.$transaction([
          // FIXED ORDER 1: Delete corpus items first (dependencies of entity)
          prisma.new_corpus.deleteMany({
            where: {
              entity_id: token.entityId || "",
            },
          }),
          // FIXED ORDER 2: Delete relationship (depends on product_id and entity)
          prisma.relationship.delete({
            where: { id: relationship.id },
          }),
          // FIXED ORDER 3: Delete the token (depends on productId and entityId)
          prisma.publicFormsTokens.delete({
            where: { token: token.token },
          }),
          // FIXED ORDER 4: Delete entity last (parent record)
          prisma.entity.delete({
            where: { id: token.entityId || "" },
          }),
        ]);
        
        // ISSUE 4: Missing logging for debugging and monitoring
        // ORIGINAL: No progress logging
        // FIX: Add informative logging
        console.log(`✅ Cleaned up unsubmitted form for entity: ${token.entityId}`);
      } else {
        // ORIGINAL: No logging for skipped tokens
        // FIX: Add logging for transparency
        console.log(`➖ No incomplete relationship found for token: ${token.token}`);
      }
    }

    // ISSUE 5: Missing overall progress logging
    // ORIGINAL: No job progress indication
    // FIX: Add start and completion logging
    console.log(`🎉 Cleanup job completed. Processed ${expiredTokens.length} tokens.`);
    await update_job_status(job.id, "completed");
    
  } catch (error) {
    // ISSUE 6: Basic error handling could be improved
    // ORIGINAL: Generic error logging
    // FIX: More descriptive error context
    console.error(`❌ Cleanup job failed for job ID: ${job.id}`, error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};