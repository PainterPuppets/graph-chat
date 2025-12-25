"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Send, Settings2, MessageCircle, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getApiKeyHeader } from "@/components/api-key-provider";
import { trpc } from "@/utils/trpc";

type GraphInfo = {
  graphId: string;
  name?: string;
};

type ThreadInfo = {
  threadId: string;
  userId: string;
  createdAt: string;
};

type ChatConfig = {
  userId: string;
  threadId: string;
  graphId: string;
  templateId: string;
};

// Separate chat component that uses useChat - will remount when key changes
function ChatArea({ config, selectedGraph }: { config: ChatConfig; selectedGraph?: GraphInfo }) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Create transport with current config
  const transport = new DefaultChatTransport({
    api: "/api/ai",
    headers: getApiKeyHeader(),
    body: {
      userId: config.userId,
      threadId: config.threadId,
      graphId: config.graphId,
      templateId: config.templateId,
    },
  });

  const { messages, sendMessage, status } = useChat({ transport });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    sendMessage({ text });
    setInput("");
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageCircle className="mx-auto mb-4 h-16 w-16 opacity-30" />
              <p className="text-lg font-medium">开始对话</p>
              <p className="text-sm">
                {!config.threadId ? (
                  "请先新建一个对话"
                ) : selectedGraph ? (
                  `基于 "${selectedGraph.name || selectedGraph.graphId}" 知识图谱进行对话`
                ) : (
                  "选择一个 Graph 以获得更好的上下文回答"
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {messages.map((message, index) => {
              const rawText =
                message.parts?.map((part) => (part.type === "text" ? part.text : "")).join("") ??
                "";
              const isLatest = index === messages.length - 1;
              const isStreamingMessage = status === "streaming" && message.role === "assistant" && isLatest;
              const displayText = getDisplayText(rawText, message.role, isStreamingMessage);

              return (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        AI 助手
                      </p>
                    )}
                    {isStreamingMessage && !displayText ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">思考中...</span>
                      </div>
                    ) : (
                      <Streamdown isAnimating={isStreamingMessage}>{displayText}</Streamdown>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input
            name="prompt"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入消息..."
            className="flex-1"
            autoComplete="off"
            autoFocus
          />
          <Button type="submit" size="icon" disabled={status === "streaming" || !config.threadId}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

function getDisplayText(rawText: string, role: string, isStreaming: boolean) {
  if (isStreaming && role === "assistant" && !rawText) {
    return "";
  }
  if (role !== "assistant") return rawText;
  try {
    const parsed = JSON.parse(rawText);
    if (parsed && typeof parsed.assistant_reply === "string") {
      return parsed.assistant_reply;
    }
  } catch {
    return rawText;
  }
  return rawText;
}

export default function ChatPage() {
  const [zepUserId, setZepUserId] = useState("");
  const [zepThreadId, setZepThreadId] = useState("");
  const [zepGraphId, setZepGraphId] = useState("");
  const [zepTemplateId, setZepTemplateId] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // tRPC queries
  const graphsQuery = useQuery(trpc.graph.list.queryOptions());
  const threadsQuery = useQuery({
    ...trpc.thread.list.queryOptions(),
    enabled: isInitialized,
  });
  const createThreadMutation = useMutation(trpc.thread.create.mutationOptions());

  const graphs = graphsQuery.data ?? [];
  const threads = threadsQuery.data ?? [];
  const isLoadingGraphs = graphsQuery.isLoading;
  const isLoadingThreads = threadsQuery.isLoading;
  const isCreatingThread = createThreadMutation.isPending;

  // Load initial settings from localStorage
  useEffect(() => {
    const storedUserId = localStorage.getItem("zepUserId");
    const storedThreadId = localStorage.getItem("zepThreadId");
    const storedGraphId = localStorage.getItem("zepGraphId");
    const storedTemplateId = localStorage.getItem("zepTemplateId");

    const userId = storedUserId ?? crypto.randomUUID();

    setZepUserId(userId);
    setZepThreadId(storedThreadId ?? "");
    setZepGraphId(storedGraphId ?? "");
    setZepTemplateId(storedTemplateId ?? "");

    localStorage.setItem("zepUserId", userId);
    setIsInitialized(true);
  }, []);

  // Auto-select the first thread if none selected
  useEffect(() => {
    if (!zepThreadId && threads.length > 0) {
      const firstThread = threads[0];
      setZepThreadId(firstThread.threadId);
      localStorage.setItem("zepThreadId", firstThread.threadId);
    }
  }, [threads, zepThreadId]);

  // Save settings to localStorage
  useEffect(() => {
    if (zepUserId) localStorage.setItem("zepUserId", zepUserId);
  }, [zepUserId]);

  useEffect(() => {
    if (zepThreadId) localStorage.setItem("zepThreadId", zepThreadId);
  }, [zepThreadId]);

  useEffect(() => {
    localStorage.setItem("zepGraphId", zepGraphId);
  }, [zepGraphId]);

  useEffect(() => {
    localStorage.setItem("zepTemplateId", zepTemplateId);
  }, [zepTemplateId]);

  const selectedGraph = graphs.find(g => g.graphId === zepGraphId);
  const selectedThread = threads.find(t => t.threadId === zepThreadId);

  const handleNewThread = async () => {
    if (!zepUserId || isCreatingThread) return;
    try {
      const newThread = await createThreadMutation.mutateAsync({ userId: zepUserId });
      threadsQuery.refetch();
      setZepThreadId(newThread.threadId);
      localStorage.setItem("zepThreadId", newThread.threadId);
    } catch (error) {
      console.error("Failed to create thread:", error);
    }
  };

  // Create a stable key for ChatArea - changes when thread changes
  const chatKey = `${zepUserId}-${zepThreadId}`;
  const chatConfig: ChatConfig = {
    userId: zepUserId,
    threadId: zepThreadId,
    graphId: zepGraphId,
    templateId: zepTemplateId,
  };

  // Don't render chat until initialized
  if (!isInitialized) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Settings Sidebar */}
      <div className={`border-r bg-muted/30 transition-all duration-300 ${showSettings ? 'w-80' : 'w-0'} overflow-hidden`}>
        <div className="w-80 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">聊天设置</h2>
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)}>
              ×
            </Button>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>选择 Graph</Label>
              <select
                value={zepGraphId}
                onChange={(e) => setZepGraphId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={isLoadingGraphs}
              >
                {isLoadingGraphs ? (
                  <option value="">加载中...</option>
                ) : (
                  <>
                    <option value="">不使用 Graph</option>
                    {graphs.map((graph) => (
                      <option key={graph.graphId} value={graph.graphId}>
                        {graph.name || graph.graphId}
                      </option>
                    ))}
                  </>
                )}
              </select>
              <p className="text-xs text-muted-foreground">
                选择一个知识图谱作为对话的上下文来源
              </p>
            </div>

            <div className="space-y-2">
              <Label>选择对话</Label>
              <div className="flex gap-2">
                <select
                  value={zepThreadId}
                  onChange={(e) => setZepThreadId(e.target.value)}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={isLoadingThreads}
                >
                  {isLoadingThreads ? (
                    <option value="">加载中...</option>
                  ) : threads.length === 0 ? (
                    <option value="">暂无对话，请新建</option>
                  ) : (
                    threads.map((thread) => (
                      <option key={thread.threadId} value={thread.threadId}>
                        {new Date(thread.createdAt).toLocaleString("zh-CN")}
                      </option>
                    ))
                  )}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNewThread}
                  disabled={isCreatingThread || !zepUserId}
                >
                  {isCreatingThread ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "新建"
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                每个对话独立保存上下文记忆
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-id">User ID</Label>
              <Input
                id="user-id"
                value={zepUserId}
                onChange={(e) => setZepUserId(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-id">Template ID（可选）</Label>
              <Input
                id="template-id"
                value={zepTemplateId}
                onChange={(e) => setZepTemplateId(e.target.value)}
                placeholder="上下文模板 ID"
                className="font-mono text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings2 className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold">AI 对话</h1>
              <div className="flex items-center gap-2">
                {selectedThread ? (
                  <Badge variant="outline" className="text-xs">
                    {new Date(selectedThread.createdAt).toLocaleString("zh-CN")}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">未选择对话</span>
                )}
                {selectedGraph && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedGraph.name || selectedGraph.graphId}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Chat Area - uses key to remount when thread changes */}
        <ChatArea key={chatKey} config={chatConfig} selectedGraph={selectedGraph} />
      </div>
    </div>
  );
}

