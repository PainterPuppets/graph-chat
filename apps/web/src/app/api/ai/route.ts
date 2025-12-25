import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type UIMessage, convertToModelMessages } from "ai";

import {
  applyWorldUpdates,
  parseWorldUpdatePayload,
} from "@/lib/world-updates";
import {
  addThreadMessages,
  ensureThread,
  ensureUser,
  getUserContext,
  searchGraph,
  formatGraphContextForLLM,
} from "@/lib/zep";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
    userId: incomingUserId,
    threadId: incomingThreadId,
    graphId: incomingGraphId,
    templateId: incomingTemplateId,
  }: {
    messages: UIMessage[];
    userId?: string;
    threadId?: string;
    graphId?: string;
    templateId?: string;
  } = await req.json();

  const zepEnabled = Boolean(process.env.ZEP_API_KEY);
  const userId = incomingUserId ?? process.env.ZEP_USER_ID ?? "demo-user";
  const threadId = incomingThreadId;
  const graphId = incomingGraphId;
  const templateId = incomingTemplateId;

  // Extract user's latest message text
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");
  const userText = latestUserMessage ? extractText(latestUserMessage) : "";

  let zepContext = "";
  let graphContext = "";
  
  // Only fetch context if we have a valid threadId
  console.log("ensureThread", zepEnabled, threadId, userText);
  if (zepEnabled && threadId && userText) {
    await ensureUser(userId);
    await ensureThread(threadId, userId);

    // Get thread context (conversation memory) - do NOT add message yet
    const contextResponse = await getUserContext(threadId, {
      templateId,
      mode: "basic",
    });
    zepContext = contextResponse.context ?? "";

    // Search graph for relevant knowledge if graphId is provided
    if (graphId) {
      const graphSearchResults = await searchGraph({
        query: userText,
        graphId,
        limit: 20,
      });
      graphContext = formatGraphContextForLLM(graphSearchResults);
    }
  }

  const modelMessages = await buildModelMessages(messages, zepContext, graphContext);

  console.log("modelMessages", modelMessages);
  const result = streamText({
    model: openai.chat(process.env.MODEL_NAME ?? "gpt-4o-mini"),
    messages: modelMessages,
    onFinish: async (event) => {
      // Only save to Zep if we have valid threadId and userText
      console.log("onFinish", zepEnabled, threadId, userText);
      if (!zepEnabled || !threadId || !userText) return;
      
      const assistantText = event.text?.trim();
      if (!assistantText) return;
      
      const parsed = parseWorldUpdatePayload(assistantText);
      const assistantContent = parsed?.assistant_reply ?? assistantText;
      
      // Add both user message and assistant message together after LLM responds
      await addThreadMessages(threadId, [
        { role: "user", content: userText },
        {
          role: "assistant",
          content: assistantContent,
          ...(parsed && {
            metadata: {
              world_updates: parsed.world_updates,
              raw_json: assistantText,
            },
          }),
        },
      ]);
      
      // Apply world updates if parsed
      if (parsed) {
        await applyWorldUpdates({ updates: parsed, userId, graphId });
      }
    },
  });

  return result.toUIMessageStreamResponse();
}

function extractText(message: UIMessage) {
  if (message.parts?.length) {
    return message.parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("");
  }
  return "";
}

async function buildModelMessages(
  messages: UIMessage[],
  zepContext: string,
  graphContext: string
) {
  const modelMessages = await convertToModelMessages(messages);

  const contextParts: string[] = [];

  if (graphContext) {
    contextParts.push("# KNOWLEDGE GRAPH (知识图谱)");
    contextParts.push("以下是从知识图谱中检索到的相关实体和事实：");
    contextParts.push(graphContext);

    console.log("以下是从知识图谱中检索到的相关实体和事实：", graphContext);
  }

  if (zepContext) {
    contextParts.push("# CONVERSATION CONTEXT (对话记忆)");
    contextParts.push(zepContext);

    console.log("对话记忆:", zepContext);
  }

  const fullContext =
    contextParts.length > 0 ? contextParts.join("\n\n") : "(empty)";

  return [
    {
      role: "system" as const,
      content: [
        "你是一个世界模拟引擎中的「导演」。",
        "你必须遵守以下规则：",
        "1) 世界状态由知识图谱表示，包含角色、派系、地点、物品、事件和抽象概念。",
        "2) 你收到的 WORLD CONTEXT 是当前世界的真实状态，不能随意否定其中事实。",
        "3) 玩家可自由行动，你需要基于上下文给出回应。",
        "4) 每轮输出必须是严格 JSON，包含 assistant_reply 与 world_updates。",
        "5) world_updates 若无变化，字段必须为空数组。",
        "6) 对世界更新请尽量提供 entity_name / from_entity_name / to_entity_name / location_name，方便写回图谱。",
        "7) 实体 type 仅使用 Character/Faction/Location/Item/Event/Concept/WorldFact。",
        "8) 关系 type 仅使用 REL_CHARACTER_CHARACTER/REL_CHARACTER_FACTION/REL_CHARACTER_LOCATION/REL_FACTION_FACTION/REL_ITEM_CHARACTER/REL_ITEM_LOCATION/REL_EVENT_PARTICIPANT/REL_EVENT_LOCATION/REL_EVENT_EVENT/REL_CONCEPT_RELATED_TO。",
        "",
        "输出格式：",
        "{",
        '  "assistant_reply": "...",',
        '  "world_updates": {',
        '    "new_entities": [],',
        '    "updated_entities": [],',
        '    "new_relationships": [],',
        '    "updated_relationships": [],',
        '    "new_events": [],',
        '    "world_facts": []',
        "  }",
        "}",
        "",
        "WORLD CONTEXT:",
        fullContext,
      ].join("\n"),
    },
    ...modelMessages,
  ];
}
