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

    for (const token of expiredTokens) {
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
