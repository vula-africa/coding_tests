import type { JobScheduleQueue } from "@prisma/client";
import { prisma } from "../endpoints/middleware/prisma";
import { update_job_status } from "./generic_scheduler";

// Constants for better readability and maintainability
const DAYS_TO_EXPIRE = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Scheduled job to clean up unsubmitted form tokens and their associated entities
 * that are older than 7 days. Deletes tokens, relationships, corpus items, and entities
 * using batch fetches and per-token transactions for partial success and efficiency.
 * @param job - The scheduled job details
 */
export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue) => {
  try {
    // Calculate the cutoff date for tokens older than 7 days
    const cutoffDate = new Date(Date.now() - DAYS_TO_EXPIRE * MS_PER_DAY);

    // Fetch all tokens older than 7 days (no relationship filter here to allow bulk check)
    const expiredTokens = await prisma.publicFormsTokens.findMany({
      where: {
        createdAt: {
          lte: cutoffDate, // Less than or equal to 7 days ago
        },
      },
      select: {
        token: true,
        entityId: true,
        productId: true,
      },
    });

    if (expiredTokens.length === 0) {
      console.log("No expired tokens found for cleanup.");
      await update_job_status(job.id, "completed");
      return;
    }

    // Collect unique product IDs for bulk relationship fetch
    const productIds = [...new Set(expiredTokens.map((token) => token.productId))];

    // Bulk fetch all 'new' relationships for these product IDs
    const relationships = await prisma.relationship.findMany({
      where: {
        product_id: { in: productIds },
        status: "new",
      },
    });

    // Create in-memory lookup map for quick O(1) checks (productId -> true if has 'new' relationship)
    const lookup = new Map(relationships.map((rel) => [rel.product_id, true]));

    // Track success/failure for logging
    let successfulCleanups = 0;
    const failedTokens = [];
    const skippedTokens = []; // For tokens without 'new' relationships

    for (const token of expiredTokens) {
      if (!lookup.has(token.productId)) {
        // Skip tokens without unsubmitted ('new') relationships, but log for monitoring
        skippedTokens.push(token.token);
        continue;
      }

      try {
        await prisma.$transaction([
          // Delete all 'new' relationships for this product (handles multiples)
          prisma.relationship.deleteMany({
            where: {
              product_id: token.productId,
              status: "new",
            },
          }),
          // Delete the token
          prisma.publicFormsTokens.delete({
            where: { token: token.token },
          }),
          // Delete corpus items if entityId exists
          ...(token.entityId
            ? [
                prisma.new_corpus.deleteMany({
                  where: { entity_id: token.entityId },
                }),
              ]
            : []),
          // Delete entity if entityId exists and no other dependencies (Prisma will error on constraints)
          ...(token.entityId
            ? [
                prisma.entity.delete({
                  where: { id: token.entityId },
                }),
              ]
            : []),
        ]);
        successfulCleanups++;
      } catch (error) {
        console.error(`Failed to clean up token ${token.token}:`, error);
        failedTokens.push(token.token);
      }
    }

    // Enhanced logging for observability for successful, failed, and skipped instances
    console.log(
      `Cleanup summary: ${successfulCleanups} successful, ${failedTokens.length} failed, ${skippedTokens.length} skipped (no unsubmitted relationship).`
    );

    // Mark job as completed even with partial failures (tradeoff: progress over perfection)
    await update_job_status(job.id, "completed");
  } catch (error) {
    console.error("Error cleaning up unsubmitted forms:", error);
    await update_job_status(job.id, "failed");
  }
};
