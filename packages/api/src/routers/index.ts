import { publicProcedure, router } from "../index";
import { graphRouter } from "./graph";
import { threadRouter } from "./thread";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  graph: graphRouter,
  thread: threadRouter,
});

export type AppRouter = typeof appRouter;
