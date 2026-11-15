import { ApiError } from './errors';

const ITEM_OPERATIONS: Readonly<Record<string, readonly string[]>> = {
  PATCH: [
    'medications',
    'appointments',
    'members',
    'tasks',
    'alerts',
    'documents',
    'handovers',
    'summaries',
  ],
  DELETE: ['medications', 'members'],
  POST: ['doses'],
};

/** Prisma ignores undefined filters. Never pass an absent item ID to a mutation. */
export function assertItemRoute(resource: string, method: string, id: string | undefined) {
  if (ITEM_OPERATIONS[method]?.includes(resource) && !id) throw new ApiError(400, 'invalidInput');
}
