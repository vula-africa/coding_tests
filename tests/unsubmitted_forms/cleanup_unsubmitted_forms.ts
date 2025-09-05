import type { JobScheduleQueue } from "@prisma/client";
import { prisma } from "../endpoints/middleware/prisma";
import { update_job_status } from "./generic_scheduler";
import { metrics } from "../monitoring/metrics"; // Hypothetical metrics client (e.g., Prometheus)

// Configuration for flexibility and team maintainability
const BATCH_SIZE = parseInt(process.env.CLEANUP_BATCH_SIZE || "100");
const CLEANUP_DAYS = parseInt(process.env.CLEANUP_DAYS || "7");

export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue) => {
  try {
    // Calculate cutoff date for tokens older than CLEANUP_DAYS
    const cutoffDate = new Date(Date.now() - CLEANUP_DAYS * 24 * 60 * 60 * 1000);
    let cursor: string | undefined = undefined;
    let hasMore = true;
    let totalDeleted = 0; // Track for metrics and monitoring
    const errors: string[] = []; // Track errors for reporting

    while (hasMore) {
      const expiredTokens = await prisma.publicFormsTokens.findMany({
        where: {
          createdAt: {
            lte: cutoffDate, // Tokens older than or equal to 7 days
          },
          status: "unsubmitted", // Ensure only unsubmitted forms are targeted (schema confirmation needed)
        },
        include: {
          relationship: {
            where: { status: "new" },
          },
        },
        take: BATCH_SIZE,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { token: cursor } : undefined,
      });

      if (expiredTokens.length === 0) {
        hasMore = false;
        break;
      }

      for (const token of expiredTokens) {
        if (!token.entityId) {
          console.warn(`Skipping token ${token.token}: Missing entityId`);
          errors.push(`Token ${token.token}: Missing entityId`);
          continue;
        }

        if (!token.relationship) {
          console.log(`Skipping token ${token.token}: No associated relationship`);
          continue;
        }

        try {
          await prisma.$transaction([
            // Delete relationship
            prisma.relationship.delete({
              where: { id: token.relationship.id },
            }),
            // Delete the token
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

          totalDeleted++;
          console.log(
            `Deleted token ${token.token}, relationship ${token.relationship.id}, entity ${token.entityId}`
          );
        } catch (txError) {
          console.error(`Failed to delete token ${token.token}:`, txError);
          errors.push(`Token ${token.token}: ${txError instanceof Error ? txError.message : "Unknown error"}`);
        }
      }

      cursor = expiredTokens[expiredTokens.length - 1].token;
      hasMore = expiredTokens.length === BATCH_SIZE;
    }

    // Record metrics for observability (e.g., Prometheus)
    metrics.increment("cleanup_unsubmitted_forms_deleted", totalDeleted);
    if (errors.length > 0) {
      metrics.increment("cleanup_unsubmitted_forms_errors", errors.length);
      console.warn(`Encountered ${errors.length} errors during cleanup:`, errors);
    }

    console.log(`Cleanup job ${job.id} completed. Deleted ${totalDeleted} form(s).`);
    await update_job_status(job.id, "completed");
  } catch (error) {
    console.error(`Cleanup job ${job.id} failed:`, error);
    await update_job_status(job.id, "failed");
    metrics.increment("cleanup_unsubmitted_forms_failed", 1);
    if (error instanceof Error) {
      console.error(`Error details: ${error.message}`);
    }
  }
};