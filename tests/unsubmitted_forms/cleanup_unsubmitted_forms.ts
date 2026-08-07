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

const EXPIRY_IN_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// A form that was started but never submitted leaves its relationship in this state.
const UNSUBMITTED_STATUS = "new";

// Tokens are read a page at a time so a backlog never lands in memory as one array.
const BATCH_SIZE = 500;
// A nightly job should not run for hours. Anything past this drains on the following nights.
const MAX_TOKENS_PER_RUN = 10_000;

type ExpiredToken = { token: string; entityId: string | null };
type EntityRelationship = { id: string; entity_id: string; status: string };

export const cleanup_unsubmitted_forms = async (job: JobScheduleQueue) => {
    try {
        // Native Date is enough here: one UTC instant compared against a column, no parsing or formatting.
        const expiryThreshold = new Date(Date.now() - EXPIRY_IN_DAYS * MS_PER_DAY);

        let cursor: string | undefined;
        let processed = 0;
        let deletedEntities = 0;
        let failedCount = 0;

        while (processed < MAX_TOKENS_PER_RUN) {
            const take = Math.min(BATCH_SIZE, MAX_TOKENS_PER_RUN - processed);

            const expiredTokens = await prisma.publicFormsTokens.findMany({
                // Anything older than the threshold — a fixed one-day window would skip tokens whenever a run is missed.
                where: { createdAt: { lt: expiryThreshold } },
                // Only the fields the cleanup actually reads; the full row carries the form payload.
                select: { token: true, entityId: true },
                // The unique token gives the cursor a total order. Ordering by createdAt would not:
                // ties make the page boundary ambiguous and rows can be skipped or repeated.
                orderBy: { token: "asc" },
                take,
                ...(cursor ? { cursor: { token: cursor }, skip: 1 } : {}),
            });

            if (!expiredTokens.length) break;

            // Advance before doing any work. A token we deliberately keep, or one whose transaction
            // fails, is still in the table on the next page — without this the loop never terminates.
            cursor = expiredTokens[expiredTokens.length - 1].token;
            processed += expiredTokens.length;

            const batch = await cleanup_batch(expiredTokens, expiryThreshold);
            failedCount += batch.failed;
            deletedEntities += batch.deletedEntities;

            if (expiredTokens.length < take) break;
        }

        if (processed >= MAX_TOKENS_PER_RUN) {
            // Say so rather than truncating silently — a capped run looks identical to a clean one otherwise.
            console.warn(
                `Unsubmitted form cleanup hit the ${MAX_TOKENS_PER_RUN} token cap; any remaining expired tokens are left for the next run.`,
            );
        }

        console.info(
            `Unsubmitted form cleanup: ${processed} expired tokens processed, ${deletedEntities} entities removed, ${failedCount} failed.`,
        );

        await update_job_status(job.id, failedCount === 0 ? "completed" : "failed");
    } catch (error) {
        console.error("Error cleaning up unsubmitted forms:", error);
        // Never let a status write blow up in place of the real error — the scheduler needs to see that one.
        await update_job_status(job.id, "failed").catch((statusError: unknown) =>
            console.error("Error marking cleanup job as failed:", statusError),
        );
        throw error;
    }
};

/**
 * Deletes one page of expired tokens, and the entity behind each token where nothing else needs it.
 * Every token in the page is deleted on exactly one path, so the job converges instead of
 * re-reading the same rows every night.
 */
const cleanup_batch = async (tokens: ExpiredToken[], expiryThreshold: Date) => {
    const entityIds = [
        ...new Set(
            tokens
                .map((token) => token.entityId)
                .filter((entityId): entityId is string => !!entityId),
        ),
    ];

    // Two queries for the whole page instead of a findFirst per token.
    const [relationships, liveTokens] = entityIds.length
        ? await Promise.all([
              // Every relationship, not only the unsubmitted ones: a relationship past "new" is
              // exactly what tells us this entity holds real answers and has to survive.
              prisma.relationship.findMany({
                  where: { entity_id: { in: entityIds } },
                  select: { id: true, entity_id: true, status: true },
              }) as Promise<EntityRelationship[]>,
              // An entity is still in use if a token pointing at it has not expired yet.
              prisma.publicFormsTokens.findMany({
                  where: {
                      entityId: { in: entityIds },
                      createdAt: { gte: expiryThreshold },
                  },
                  select: { entityId: true },
              }) as Promise<{ entityId: string | null }[]>,
          ])
        : [[] as EntityRelationship[], [] as { entityId: string | null }[]];

    // Grouped per entity rather than one relationship per key: an entity can hold several, and
    // keeping only the last one would leave the rest orphaned against a deleted entity.
    const relationshipsByEntity = new Map<string, EntityRelationship[]>();
    for (const relationship of relationships) {
        const existing = relationshipsByEntity.get(relationship.entity_id);
        if (existing) existing.push(relationship);
        else relationshipsByEntity.set(relationship.entity_id, [relationship]);
    }

    const entitiesWithLiveTokens = new Set(liveTokens.map((token) => token.entityId));

    const entitiesDeleted = new Set<string>();
    let failed = 0;

    for (const token of tokens) {
        const entityId = token.entityId;
        const entityRelationships = entityId
            ? relationshipsByEntity.get(entityId) ?? []
            : [];

        // The entity stays if a live session still points at it, or if any of its relationships
        // moved past "new" — that is a submitted form, and its answers hang off the entity.
        // The expired token is dead weight either way, so it always goes.
        const entityStillInUse =
            !entityId ||
            entitiesWithLiveTokens.has(entityId) ||
            entityRelationships.some(
                (relationship) => relationship.status !== UNSUBMITTED_STATUS,
            );

        // deleteMany rather than delete throughout: a concurrent run, or an earlier token sharing
        // this entity, may already have removed the row and delete would throw P2025 and roll back.
        const deletions = [
            prisma.publicFormsTokens.deleteMany({ where: { token: token.token } }),
        ];

        if (entityId && !entityStillInUse) {
            if (entityRelationships.length) {
                deletions.push(
                    prisma.relationship.deleteMany({
                        where: { id: { in: entityRelationships.map((r) => r.id) } },
                    }),
                );
            }
            // Children before the parent, so the entity is never deleted out from under a row.
            deletions.push(
                prisma.new_corpus.deleteMany({ where: { entity_id: entityId } }),
                prisma.entity.deleteMany({ where: { id: entityId } }),
            );
        }

        try {
            await prisma.$transaction(deletions);
            if (entityId && !entityStillInUse) entitiesDeleted.add(entityId);
        } catch (error) {
            failed++;
            // One token failing should not stop the rest of the batch; this could be as simple as
            // a row deleted by a concurrent run.
            console.error(
                `Error cleaning up unsubmitted form for token ${token.token}:`,
                error,
            );
        }
    }

    return { failed, deletedEntities: entitiesDeleted.size };
};
