import type { JobScheduleQueue } from "@prisma/client";
import { prisma } from "../endpoints/middleware/prisma";
import { update_job_status } from "./generic_scheduler";

export const cleanup_unsubmitted_forms = async (
  job: JobScheduleQueue
) => {
  const BATCH_SIZE = 1000;

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    console.log("[Cleanup Job] Starting cleanup for tokens older than:", sevenDaysAgo);
    const expiredTokens = await prisma.publicFormsTokens.findMany({
      where: {
        createdAt: { lt: sevenDaysAgo },
      },
      select: { token: true, entityId: true },
      take: BATCH_SIZE,
    });

    if (expiredTokens.length === 0) {
      console.log("[Cleanup Job] No expired tokens found.");
      await update_job_status(job.id, "completed");
      return;
    }

    const entityIds = expiredTokens
      .map((token) => token.entityId)
      .filter((id): id is string => Boolean(id));

    const tokens = expiredTokens.map((token) => token.token);

    await prisma.$transaction(async (tx) => {
      if (entityIds.length > 0) {
        await tx.relationship.deleteMany({
          where: {
            entity_id: { in: entityIds },
            status: "new",
          },
        });

        await tx.new_corpus.deleteMany({
          where: {
            entity_id: { in: entityIds },
          },
        });

        await tx.entity.deleteMany({
          where: {
            id: { in: entityIds },
          },
        });
      }

      await tx.publicFormsTokens.deleteMany({
        where: {
          token: { in: tokens },
        },
      });
    });

    console.log(
      `[Cleanup Job] Deleted ${tokens.length} tokens and ${entityIds.length} entities`
    );

    await update_job_status(job.id, "completed");
  } catch (error) {
    console.error("[Cleanup Job] Error:", error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};
