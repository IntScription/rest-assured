/**
 * A reusable fake Supabase client for screen smoke tests.
 *
 * Every query-builder method (select/eq/order/...) returns the same
 * chainable object, and the object itself is thenable so `await` resolves
 * it directly — matching how supabase-js's PostgrestFilterBuilder works.
 * Register per-table responses via `setTableResponse`; anything
 * unregistered resolves to `{ data: [], error: null }`.
 */

type QueryResult = { data: unknown; error: unknown };

const CHAIN_METHODS = [
  "select",
  "insert",
  "update",
  "upsert",
  "delete",
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "like",
  "ilike",
  "is",
  "in",
  "not",
  "or",
  "order",
  "limit",
  "range",
  "filter",
  "match",
] as const;

function createChainable(result: QueryResult) {
  const chain: any = {};

  for (const method of CHAIN_METHODS) {
    chain[method] = jest.fn(() => chain);
  }

  chain.single = jest.fn(() => Promise.resolve(result));
  chain.maybeSingle = jest.fn(() => Promise.resolve(result));
  chain.then = (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
  chain.catch = (reject: (reason: unknown) => unknown) => Promise.resolve(result).catch(reject);

  return chain;
}

export function createMockSupabase() {
  const tableResponses = new Map<string, QueryResult>();
  const defaultResult: QueryResult = { data: [], error: null };

  const setTableResponse = (table: string, result: Partial<QueryResult>) => {
    tableResponses.set(table, { data: null, error: null, ...result });
  };

  const from = jest.fn((table: string) => createChainable(tableResponses.get(table) ?? defaultResult));

  const auth = {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
    signInWithPassword: jest.fn(() => Promise.resolve({ data: {}, error: null })),
    signInWithOAuth: jest.fn(() => Promise.resolve({ data: { url: null }, error: null })),
    signInWithIdToken: jest.fn(() => Promise.resolve({ data: {}, error: null })),
  };

  const channel = jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
    unsubscribe: jest.fn(),
  }));

  const functions = {
    invoke: jest.fn(() => Promise.resolve({ data: null, error: null })),
  };

  const removeChannel = jest.fn();

  return { from, auth, channel, removeChannel, functions, setTableResponse, tableResponses };
}
