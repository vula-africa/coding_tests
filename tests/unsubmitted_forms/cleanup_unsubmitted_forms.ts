/* Context:
 This is a scheduled job that runs every day at midnight to clean up forms that users started filling in but didn't submit which are older than 7 days.
 When a user visits a public form, a token is generated and stored in the database.
 This token is used to identify the user and link the answers to the entity.
 An entity is the owner of data in the database, separated as it could be a business or an individual but has been decoupled from a login/user.
 This entity is a profile within Vula which it will match funding opportunities and send then alerts about their business profile.
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

const EXPIRY_DAYS = 7;
const BATCH_SIZE = 500;
const LOG_PREFIX = "cleanup_unsubmitted_forms";

type ExpiredToken = {
  token: string;
  entityId: string | null;
  productId: string;
};

type BatchResult = {
  entitiesDeleted: Set<string>;
  entitiesKept: Set<string>;
  handled: number;
  failed: number;
};

export const expiry_cutoff = (now: Date = new Date()): Date =>
  new Date(now.getTime() - EXPIRY_DAYS * 24 * 60 * 60 * 1000);

// No lower bound, so a missed run is picked up by the next one. Deleted rows
// stop matching, so taking the first N each time walks the whole set.
const findExpiredTokens = (cutoff: Date): Promise<ExpiredToken[]> =>
  prisma.publicFormsTokens.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { token: true, entityId: true, productId: true },
    take: BATCH_SIZE,
  });

// deleteMany so a token that has already gone is not an error.
const deleteTokenOnly = (token: string) =>
  prisma.publicFormsTokens.deleteMany({ where: { token } });

// In use means an unexpired token points at it, or a relationship has moved
// past "new". One pair of queries per batch.
const findEntitiesInUse = async (entityIds: string[], cutoff: Date) => {
  if (entityIds.length === 0) return new Set<string>();

  const [live, finished] = await Promise.all([
    prisma.publicFormsTokens.findMany({
      where: { entityId: { in: entityIds }, createdAt: { gte: cutoff } },
      select: { entityId: true },
    }),
    prisma.relationship.findMany({
      where: { entity_id: { in: entityIds }, status: { not: "new" } },
      select: { entity_id: true },
    }),
  ]);

  return new Set<string>([
    ...live.map((t) => t.entityId).filter((id): id is string => !!id),
    ...finished.map((r) => r.entity_id),
  ]);
};

// The bulk check is a few seconds old by now, so ask again before deleting.
// Someone submitting in that window is the case we cannot get wrong.
// Returns false if the entity turns out to be in use.
const deleteEntityIfUnused = (
  entityId: string,
  productId: string,
  cutoff: Date,
) =>
  prisma.$transaction(async (tx) => {
    const [live, finished] = await Promise.all([
      tx.publicFormsTokens.count({
        where: { entityId, createdAt: { gte: cutoff } },
      }),
      tx.relationship.count({
        where: { entity_id: entityId, status: { not: "new" } },
      }),
    ]);

    if (live > 0 || finished > 0) return false;

    await tx.relationship.deleteMany({
      where: { entity_id: entityId, product_id: productId, status: "new" },
    });
    // All of this entity's tokens, or the next pass would try to delete an
    // entity that has already gone.
    await tx.publicFormsTokens.deleteMany({ where: { entityId } });
    await tx.new_corpus.deleteMany({ where: { entity_id: entityId } });
    await tx.entity.delete({ where: { id: entityId } });

    return true;
  });

// The token always goes. The entity only goes if nothing else needs it.
// Returns true if the entity was removed.
const cleanUpToken = async (
  { token, entityId, productId }: ExpiredToken,
  entitiesInUse: Set<string>,
  cutoff: Date,
): Promise<boolean> => {
  if (entityId && !entitiesInUse.has(entityId)) {
    const removed = await deleteEntityIfUnused(entityId, productId, cutoff);
    if (removed) return true;
  }

  await deleteTokenOnly(token);
  return false;
};

const cleanUpBatch = async (
  tokens: ExpiredToken[],
  cutoff: Date,
): Promise<BatchResult> => {
  const entityIds = [
    ...new Set(
      tokens.map((t) => t.entityId).filter((id): id is string => !!id),
    ),
  ];
  const entitiesInUse = await findEntitiesInUse(entityIds, cutoff);

  const result: BatchResult = {
    entitiesDeleted: new Set(),
    entitiesKept: new Set(),
    handled: 0,
    failed: 0,
  };

  for (const token of tokens) {
    // Deleting an entity takes its other tokens with it.
    if (token.entityId && result.entitiesDeleted.has(token.entityId)) continue;

    try {
      const entityRemoved = await cleanUpToken(token, entitiesInUse, cutoff);

      if (token.entityId) {
        const bucket = entityRemoved
          ? result.entitiesDeleted
          : result.entitiesKept;
        bucket.add(token.entityId);
      }
      result.handled++;
    } catch (error) {
      result.failed++;
      console.error(`${LOG_PREFIX}: ${token.token} failed`, error);
    }
  }

  return result;
};

export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue) => {
  try {
    const cutoff = expiry_cutoff();

    let scanned = 0;
    let failed = 0;
    // Sets, because one entity can own several tokens across several batches.
    const deleted = new Set<string>();
    const kept = new Set<string>();

    while (true) {
      const tokens = await findExpiredTokens(cutoff);
      if (tokens.length === 0) break;

      scanned += tokens.length;
      const batch = await cleanUpBatch(tokens, cutoff);

      for (const id of batch.entitiesDeleted) deleted.add(id);
      for (const id of batch.entitiesKept) kept.add(id);
      failed += batch.failed;

      // Every row in this batch failed, so the next pass would fetch the same
      // ones again.
      if (batch.handled === 0) {
        console.warn(`${LOG_PREFIX}: no progress, stopping`);
        break;
      }
    }

    console.log(
      `${LOG_PREFIX}: ${scanned} tokens, ${deleted.size} entities deleted, ` +
        `${kept.size} kept, ${failed} failed`,
    );

    // Only fail the run if nothing worked. One bad row shouldn't hide a run
    // that did most of its job.
    await update_job_status(
      job.id,
      deleted.size === 0 && failed > 0 ? "failed" : "completed",
    );
  } catch (error) {
    console.error("Error cleaning up unsubmitted forms:", error);
    await update_job_status(job.id, "failed");
    throw error;
  }
};
