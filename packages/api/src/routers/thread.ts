import { z } from "zod";
import { publicProcedure, router } from "../index";
import { getZepClient, ensureUser } from "../zep";

export const threadRouter = router({
  list: publicProcedure
    .input(
      z.object({
        pageNumber: z.number().optional(),
        pageSize: z.number().optional(),
        orderBy: z.string().optional(),
        asc: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const zep = getZepClient();
      const response = await zep.thread.listAll({
        pageNumber: input?.pageNumber ?? 1,
        pageSize: input?.pageSize ?? 100,
        orderBy: input?.orderBy ?? "created_at",
        asc: input?.asc ?? false,
      });

      return (response.threads ?? []).map((thread) => ({
        threadId: thread.threadId ?? "",
        userId: thread.userId ?? "",
        createdAt: thread.createdAt ?? "",
      }));
    }),

  create: publicProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      const zep = getZepClient();
      await ensureUser(input.userId);

      const threadId = crypto.randomUUID();
      await zep.thread.create({ threadId, userId: input.userId });

      return {
        threadId,
        userId: input.userId,
        createdAt: new Date().toISOString(),
      };
    }),

  delete: publicProcedure
    .input(z.object({ threadId: z.string() }))
    .mutation(async ({ input }) => {
      const zep = getZepClient();
      await zep.thread.delete(input.threadId);
      return { success: true };
    }),
});
