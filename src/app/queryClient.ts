import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { captureException } from "@/shared/lib/monitoring";

function serializeKey(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      captureException(error, {
        tags: {
          scope: "react-query",
          operation: "query",
        },
        extra: {
          queryKey: serializeKey(query.queryKey),
        },
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, variables, _context, mutation) => {
      captureException(error, {
        tags: {
          scope: "react-query",
          operation: "mutation",
        },
        extra: {
          mutationKey: serializeKey(mutation.options.mutationKey),
          variables,
        },
      });
    },
  }),
})
