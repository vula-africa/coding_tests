import type { JobScheduleQueue } from "@prisma/client";
import { prisma } from "../endpoints/middleware/prisma";
import { update_job_status } from "./generic_scheduler";

export const cleanup_unsubmitted_forms = async (
  job: JobScheduleQueue
) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const expiredTokens = await prisma.publicFormsTokens.findMany({
      where: {
        createdAt: { lt: sevenDaysAgo },
      },
      select: { token: true, entityId: true },
    });

    const entityIds = expiredTokens
      .map((token) => token.entityId)
      .filter((id): id is string => Boolean(id));

    for (const token of expiredTokens) {
      if (token.entityId) {
        await prisma.relationship.deleteMany({
          where: {
            entity_id: token.entityId,
            status: "new",
          },
        });

        await prisma.new_corpus.deleteMany({
          where: {
            entity_id: token.entityId,
          },
        });

        await prisma.entity.deleteMany({
          where: {
            id: token.entityId,
          },
        });
      }

      await prisma.publicFormsTokens.delete({
        where: { token: token.token },
      });
    }

    await update_job_status(job.id, "completed");
  } catch (error) {
    await update_job_status(job.id, "failed");
    throw error;
  }
};
