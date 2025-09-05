import type { JobScheduleQueue } from "@prisma/client";
import { prisma } from "../endpoints/middleware/prisma";
import { update_job_status } from "./generic_scheduler";

export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue) => {
  try {
    // Calculate cutoff date for tokens older than 7 days
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const expiredTokens = await prisma.publicFormsTokens.findMany({
      where: {
        createdAt: {
          lte: cutoffDate, // Tokens older than or equal to 7 days
        },
        status: "unsubmitted", // Ensure only unsubmitted forms are targeted (schema confirmation needed)
      },
    });

    for (const token of expiredTokens) {
      const relationship = await prisma.relationship.findFirst({
        where: {
          product_id: token.productId,
          status: "new",
        },
      });

      if (relationship) {
        await prisma.$transaction([
          // Delete relationship
          prisma.relationship.delete({
            where: { id: relationship.id },
          }),
          // Delete the token
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