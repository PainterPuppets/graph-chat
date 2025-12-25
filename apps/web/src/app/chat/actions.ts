"use server";

import {
  listThreads as listThreadsFromZep,
  createThread as createThreadInZep,
  deleteThread as deleteThreadFromZep,
  ensureUser,
} from "@/lib/zep";

export type ThreadInfo = {
  threadId: string;
  userId: string;
  createdAt: string;
};

export async function listThreads(): Promise<ThreadInfo[]> {
  const { threads } = await listThreadsFromZep({
    pageSize: 100,
    orderBy: "created_at",
    asc: false,
  });

  return threads.map((thread) => ({
    threadId: thread.threadId ?? "",
    userId: thread.userId ?? "",
    createdAt: thread.createdAt ?? "",
  }));
}

export async function createThread(userId: string): Promise<ThreadInfo> {
  await ensureUser(userId);
  const threadId = crypto.randomUUID();
  await createThreadInZep(threadId, userId);
  return {
    threadId,
    userId,
    createdAt: new Date().toISOString(),
  };
}

export async function deleteThread(threadId: string): Promise<void> {
  await deleteThreadFromZep(threadId);
}

