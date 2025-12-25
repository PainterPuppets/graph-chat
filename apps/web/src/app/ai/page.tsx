"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import Link from "next/link";
import { Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AIPage() {
  const [input, setInput] = useState("");
  const [zepUserId, setZepUserId] = useState("");
  const [zepThreadId, setZepThreadId] = useState("");
  const [zepGraphId, setZepGraphId] = useState("");
  const [zepTemplateId, setZepTemplateId] = useState("");

  useEffect(() => {
    const storedUserId = localStorage.getItem("zepUserId");
    const storedThreadId = localStorage.getItem("zepThreadId");
    const storedGraphId = localStorage.getItem("zepGraphId");
    const storedTemplateId = localStorage.getItem("zepTemplateId");

    const userId = storedUserId ?? crypto.randomUUID();
    const threadId = storedThreadId ?? crypto.randomUUID();

    setZepUserId(userId);
    setZepThreadId(threadId);
    setZepGraphId(storedGraphId ?? "");
    setZepTemplateId(storedTemplateId ?? "");

    localStorage.setItem("zepUserId", userId);
    localStorage.setItem("zepThreadId", threadId);
  }, []);

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

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai",
        body: {
          userId: zepUserId,
          threadId: zepThreadId,
          graphId: zepGraphId,
          templateId: zepTemplateId,
        },
      }),
    [zepUserId, zepThreadId, zepGraphId, zepTemplateId]
  );

  const { messages, sendMessage, status } = useChat({ transport });

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    <div className="grid grid-rows-[auto_1fr_auto] overflow-hidden w-full mx-auto p-4 gap-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Zep 已连接：{zepUserId ? "已加载本地设置" : "未配置"}
        </div>
        <Link href={"/zep"} className="shrink-0">
          <Button variant="outline" size="sm">Zep 设置与上传</Button>
        </Link>
      </div>

      <div className="overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground mt-8">
            Ask me anything to get started!
          </div>
        ) : (
          messages.map((message, index) => {
            const rawText =
              message.parts?.map((part) => (part.type === "text" ? part.text : "")).join("") ??
              "";
            const isLatest = index === messages.length - 1;
            const isStreamingMessage = status === "streaming" && message.role === "assistant" && isLatest;
            const displayText = getDisplayText(rawText, message.role, isStreamingMessage);

            return (
            <div
              key={message.id}
              className={`p-3 rounded-lg ${
                message.role === "user" ? "bg-primary/10 ml-8" : "bg-secondary/20 mr-8"
              }`}
            >
              <p className="text-sm font-semibold mb-1">
                {message.role === "user" ? "You" : "AI Assistant"}
              </p>
              <Streamdown isAnimating={isStreamingMessage}>{displayText}</Streamdown>
            </div>
          )})
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="w-full flex items-center space-x-2 pt-2 border-t">
        <Input
          name="prompt"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1"
          autoComplete="off"
          autoFocus
        />
        <Button type="submit" size="icon">
          <Send size={18} />
        </Button>
      </form>
    </div>
  );
}

function getDisplayText(rawText: string, role: string, isStreaming: boolean) {
  if (isStreaming && role === "assistant") {
    return "生成中...";
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
