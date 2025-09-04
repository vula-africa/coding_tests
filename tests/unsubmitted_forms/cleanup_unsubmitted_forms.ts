import type { JobScheduleQueue } from "@prisma/client";
import { prisma } from "../endpoints/middleware/prisma";
import { update_job_status as updateJobStatus } from "./generic_scheduler"; 

type RelationshipStatus = "new" | "submitted";
type JobStatus = "completed" | "failed";

const BATCH_SIZE = 20
const EXPIRATION_DAYS = 7

/**
 * Cleans up expired unsubmitted public form tokens and all associated data.
 *
 * This scheduled job runs in batches and performs deletions:
 *   1. Deletes all corpus items linked to the entities
 *   2. Deletes all relationships linked to the batch of tokens
 *   3. Deletes all expired tokens in the batch
 *   4. Deletes all associated entities
 *
 * The function uses absolute date calculation (midnight 7 days ago) to avoid missing tokens
 * if the job is delayed or re-queued. Batches reduce database load by minimizing repeated
 * opening and closing of connections, while still ensuring correctness.
 *
 * @param {JobScheduleQueue} job - The scheduled job object containing job metadata.
 * @throws Will throw an error if any database operation fails, updating the job status to 'failed'.
 */
export const cleanupUnsubmittedForms = async (job: JobScheduleQueue) => {
  try {
    // Calculate absolute EXPIRATION_DAYS day-old date (midnight EXPIRATION_DAYS days ago)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today.getTime() - EXPIRATION_DAYS * 24 * 60 * 60 * 1000);

    while (true) {
      const expiredTokens = await prisma.publicFormsTokens.findMany({
        where: { createdAt: { lt: sevenDaysAgo } },
        take: BATCH_SIZE,
      });

      if (expiredTokens.length === 0) break; // exit when no more expired tokens

      const entityIds = expiredTokens
        .map((t) => t.entityId)
        .filter(Boolean) as string[];
      const tokenValues = expiredTokens.map((t) => t.token);

      const relationships = await prisma.relationship.findMany({
        where: {
          product_id: { in: expiredTokens.map((t) => t.productId) },
          status: "new" as RelationshipStatus,
        },
      });

      await prisma.$transaction([
        prisma.new_corpus.deleteMany({ where: { entity_id: { in: entityIds } } }),
        prisma.relationship.deleteMany({ where: { id: { in: relationships.map((r) => r.id) } } }),
        prisma.publicFormsTokens.deleteMany({ where: { token: { in: tokenValues } } }),
        prisma.entity.deleteMany({ where: { id: { in: entityIds } } }),
      ]);
    }

    await updateJobStatus(job.id, "completed" as JobStatus);
  } catch (error) {
    console.error("Error cleaning up unsubmitted forms:", error);
    await updateJobStatus(job.id, "failed" as JobStatus);
    throw error;
  }
};
