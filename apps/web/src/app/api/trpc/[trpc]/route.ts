import { createContext } from "@graph-chat/api/context";
import { appRouter } from "@graph-chat/api/routers/index";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { NextRequest } from "next/server";

import { validateApiKey } from "@/lib/auth";

function handler(req: NextRequest) {
  const authError = validateApiKey(req);
  if (authError) return authError;

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req),
  });
}
export { handler as GET, handler as POST };
