import { ZepClient, ZepError, entityFields, type EdgeType, type EntityType, type Zep } from "@getzep/zep-cloud";

type RoleType = Zep.RoleType;

type OntologyTargets = {
  userId?: string;
  graphId?: string;
};

const cachedOntologyTargets = new Set<string>();

const zepClient = new ZepClient({
  apiKey: process.env.ZEP_API_KEY,
  ...(process.env.ZEP_API_BASE_URL ? { baseUrl: process.env.ZEP_API_BASE_URL } : {}),
});

const worldEntityTypes: Record<string, EntityType> = {
  Character: {
    description: "World characters, creatures, or agents.",
    fields: {
      aliases: entityFields.text("Aliases or alternative names"),
      kind: entityFields.text("Species or type"),
      role: entityFields.text("Role or occupation"),
      factions: entityFields.text("Faction identifiers or names"),
      personality_tags: entityFields.text("Personality tags"),
      goals: entityFields.text("Goals or motivations"),
      secrets: entityFields.text("Hidden information"),
      status: entityFields.text("Status such as alive/dead/missing"),
      location_id: entityFields.text("Current location identifier"),
      notes: entityFields.text("Additional notes"),
    },
  },
  Faction: {
    description: "Organizations, factions, nations, or groups.",
    fields: {
      kind: entityFields.text("Faction type"),
      ideology: entityFields.text("Ideology or belief"),
      goals: entityFields.text("Goals"),
      strength: entityFields.text("Strength estimate"),
      notes: entityFields.text("Additional notes"),
    },
  },
  Location: {
    description: "Places in the world.",
    fields: {
      kind: entityFields.text("Location type"),
      parent_location_id: entityFields.text("Parent location identifier"),
      description: entityFields.text("Description"),
      tags: entityFields.text("Tags"),
    },
  },
  Item: {
    description: "Items, artifacts, devices, or relics.",
    fields: {
      kind: entityFields.text("Item type"),
      properties: entityFields.text("Properties or traits"),
      current_owner_id: entityFields.text("Current owner identifier"),
      location_id: entityFields.text("Location identifier if not owned"),
      notes: entityFields.text("Additional notes"),
    },
  },
  Event: {
    description: "Important events.",
    fields: {
      summary_text: entityFields.text("Event summary"),
      time: entityFields.text("World time"),
      importance: entityFields.integer("Importance 1-5"),
      status: entityFields.text("Event status"),
      notes: entityFields.text("Additional notes"),
    },
  },
  Concept: {
    description: "Abstract concepts, rules, or myths.",
    fields: {
      kind: entityFields.text("Concept type"),
      summary_text: entityFields.text("Summary"),
      notes: entityFields.text("Additional notes"),
    },
  },
  WorldFact: {
    description: "Key-value style world facts.",
    fields: {
      key: entityFields.text("Fact key"),
      value: entityFields.text("Fact value"),
      notes: entityFields.text("Additional notes"),
    },
  },
};

const worldEdgeTypes: Record<string, EdgeType> = {
  REL_CHARACTER_CHARACTER: {
    description: "Relations between characters.",
    fields: {
      relation: entityFields.text("Relation type"),
      notes: entityFields.text("Notes"),
    },
    sourceTargets: [{ source: "Character", target: "Character" }],
  },
  REL_CHARACTER_FACTION: {
    description: "Relations between characters and factions.",
    fields: {
      relation: entityFields.text("Relation type"),
      notes: entityFields.text("Notes"),
    },
    sourceTargets: [{ source: "Character", target: "Faction" }],
  },
  REL_CHARACTER_LOCATION: {
    description: "Relations between characters and locations.",
    fields: {
      relation: entityFields.text("Relation type"),
      notes: entityFields.text("Notes"),
    },
    sourceTargets: [{ source: "Character", target: "Location" }],
  },
  REL_FACTION_FACTION: {
    description: "Relations between factions.",
    fields: {
      relation: entityFields.text("Relation type"),
      notes: entityFields.text("Notes"),
    },
    sourceTargets: [{ source: "Faction", target: "Faction" }],
  },
  REL_ITEM_CHARACTER: {
    description: "Relations between items and characters.",
    fields: {
      relation: entityFields.text("Relation type"),
      notes: entityFields.text("Notes"),
    },
    sourceTargets: [{ source: "Item", target: "Character" }],
  },
  REL_ITEM_LOCATION: {
    description: "Relations between items and locations.",
    fields: {
      relation: entityFields.text("Relation type"),
      notes: entityFields.text("Notes"),
    },
    sourceTargets: [{ source: "Item", target: "Location" }],
  },
  REL_EVENT_PARTICIPANT: {
    description: "Event participants and their roles.",
    fields: {
      role: entityFields.text("Role in event"),
      notes: entityFields.text("Notes"),
    },
    sourceTargets: [
      { source: "Character", target: "Event" },
      { source: "Faction", target: "Event" },
    ],
  },
  REL_EVENT_LOCATION: {
    description: "Event location relation.",
    fields: {
      relation: entityFields.text("Relation type"),
      notes: entityFields.text("Notes"),
    },
    sourceTargets: [{ source: "Event", target: "Location" }],
  },
  REL_EVENT_EVENT: {
    description: "Causal relations between events.",
    fields: {
      relation: entityFields.text("Relation type"),
      notes: entityFields.text("Notes"),
    },
    sourceTargets: [{ source: "Event", target: "Event" }],
  },
  REL_CONCEPT_RELATED_TO: {
    description: "Relations involving concepts.",
    fields: {
      relation: entityFields.text("Relation type"),
      notes: entityFields.text("Notes"),
    },
    sourceTargets: [
      { source: "Concept", target: "Character" },
      { source: "Concept", target: "Faction" },
      { source: "Concept", target: "Event" },
      { source: "Concept", target: "Concept" },
    ],
  },
};

function ensureApiKey() {
  if (!process.env.ZEP_API_KEY) {
    throw new Error("Missing ZEP_API_KEY");
  }
}

function isAlreadyExistsError(error: unknown) {
  return error instanceof ZepError && (error.statusCode === 400 || error.statusCode === 409);
}

function resolveGraphTarget(input: { userId?: string; graphId?: string }) {
  if (input.graphId) {
    return { graphId: input.graphId };
  }
  if (input.userId) {
    return { userId: input.userId };
  }
  return {};
}

export function getZepClient() {
  ensureApiKey();
  return zepClient;
}

export async function ensureUser(userId: string) {
  const client = getZepClient();
  try {
    await client.user.add({ userId });
  } catch (error) {
    if (isAlreadyExistsError(error)) return;
    throw error;
  }
}

export async function ensureThread(threadId: string, userId: string) {
  const client = getZepClient();
  try {
    await client.thread.create({ threadId, userId });
  } catch (error) {
    if (isAlreadyExistsError(error)) return;
    throw error;
  }
}

export async function listThreads(options?: {
  pageNumber?: number;
  pageSize?: number;
  orderBy?: string;
  asc?: boolean;
}) {
  const client = getZepClient();
  const response = await client.thread.listAll({
    pageNumber: options?.pageNumber ?? 1,
    pageSize: options?.pageSize ?? 50,
    orderBy: options?.orderBy ?? "created_at",
    asc: options?.asc ?? false,
  });
  return {
    threads: response.threads ?? [],
    totalCount: response.totalCount ?? 0,
  };
}

export async function createThread(threadId: string, userId: string) {
  const client = getZepClient();
  await client.thread.create({ threadId, userId });
  return { threadId, userId };
}

export async function getThread(threadId: string) {
  const client = getZepClient();
  const response = await client.thread.get(threadId);
  return response;
}

export async function deleteThread(threadId: string) {
  const client = getZepClient();
  await client.thread.delete(threadId);
}

export async function ensureGraph(graphId?: string) {
  if (!graphId) return;
  const client = getZepClient();
  try {
    await client.graph.create({ graphId, name: graphId });
  } catch (error) {
    if (isAlreadyExistsError(error)) return;
    throw error;
  }
}

export async function ensureWorldOntology(targets: OntologyTargets) {
  const client = getZepClient();
  const cacheKey = targets.graphId ? `graph:${targets.graphId}` : `user:${targets.userId}`;
  if (cacheKey && cachedOntologyTargets.has(cacheKey)) return;

  if (!targets.graphId && !targets.userId) {
    throw new Error("Missing userId or graphId for ontology");
  }

  const targetParams = targets.graphId
    ? { graphIds: [targets.graphId] }
    : { userIds: [targets.userId as string] };

  await client.graph.setEntityTypes(worldEntityTypes, worldEdgeTypes, targetParams);
  if (cacheKey) cachedOntologyTargets.add(cacheKey);
}

export async function addThreadMessages(
  threadId: string,
  messages: { role: RoleType; content: string; metadata?: Record<string, unknown>; name?: string }[],
  options?: { returnContext?: boolean; ignoreRoles?: string[] }
) {
  const client = getZepClient();
  console.log("addThreadMessages", threadId, messages);
  return client.thread.addMessages(threadId, {
    messages,
    returnContext: options?.returnContext,
    ignoreRoles: options?.ignoreRoles as RoleType[] | undefined,
  });
}

export async function getUserContext(
  threadId: string,
  options?: { templateId?: string; minRating?: number; mode?: "basic" | "summary" }
) {
  const client = getZepClient();
  return client.thread.getUserContext(threadId, {
    templateId: options?.templateId,
    minRating: options?.minRating,
    mode: options?.mode,
  });
}

export async function addGraphData(input: {
  data: string;
  type?: "text" | "json" | "message";
  graphId?: string;
  userId?: string;
  sourceDescription?: string;
  createdAt?: string;
}) {
  const client = getZepClient();
  const target = resolveGraphTarget({ graphId: input.graphId, userId: input.userId });
  if (!target.graphId && !target.userId) {
    throw new Error("Missing userId or graphId for graph add");
  }
  return client.graph.add({
    data: input.data,
    type: input.type ?? "text",
    graphId: target.graphId,
    userId: target.userId,
    sourceDescription: input.sourceDescription,
    createdAt: input.createdAt,
  });
}

export async function addGraphDataBatch(input: {
  episodes: { data: string; type: "text" | "json" | "message"; sourceDescription?: string; createdAt?: string }[];
  graphId?: string;
  userId?: string;
}) {
  const client = getZepClient();
  const target = resolveGraphTarget({ graphId: input.graphId, userId: input.userId });
  if (!target.graphId && !target.userId) {
    throw new Error("Missing userId or graphId for graph add batch");
  }
  return client.graph.addBatch({
    episodes: input.episodes,
    graphId: target.graphId,
    userId: target.userId,
  });
}

export async function addFactTriple(input: {
  fact: string;
  factName: string;
  sourceNodeName: string;
  targetNodeName: string;
  graphId?: string;
  userId?: string;
  createdAt?: string;
}) {
  const client = getZepClient();
  const target = resolveGraphTarget({ graphId: input.graphId, userId: input.userId });
  if (!target.graphId && !target.userId) {
    throw new Error("Missing userId or graphId for add fact triple");
  }
  return client.graph.addFactTriple({
    fact: input.fact,
    factName: input.factName,
    sourceNodeName: input.sourceNodeName,
    targetNodeName: input.targetNodeName,
    graphId: target.graphId,
    userId: target.userId,
    createdAt: input.createdAt,
  });
}

export async function searchGraph(input: {
  query: string;
  graphId?: string;
  userId?: string;
  limit?: number;
  minFactRating?: number;
}) {
  const client = getZepClient();
  const target = resolveGraphTarget({ graphId: input.graphId, userId: input.userId });
  if (!target.graphId && !target.userId) {
    throw new Error("Missing userId or graphId for graph search");
  }
  const result = await client.graph.search({
    query: input.query,
    graphId: target.graphId,
    userId: target.userId,
    limit: input.limit ?? 20,
    minFactRating: input.minFactRating,
  });
  return result;
}

export function formatGraphContextForLLM(searchResults: {
  edges?: Array<{ fact: string; name: string; attributes?: Record<string, unknown> }>;
  nodes?: Array<{ name: string; labels?: string[]; attributes?: Record<string, unknown> }>;
}): string {
  const lines: string[] = [];

  // Format nodes (entities)
  if (searchResults.nodes?.length) {
    lines.push("## 相关实体");
    for (const node of searchResults.nodes) {
      const labels = node.labels?.join(", ") ?? "Unknown";
      let line = `- **${node.name}** [${labels}]`;
      if (node.attributes && Object.keys(node.attributes).length > 0) {
        const attrs = Object.entries(node.attributes)
          .filter(([, v]) => v !== null && v !== undefined && v !== "")
          .map(([k, v]) => `${k}: ${v}`)
          .join("; ");
        if (attrs) line += ` — ${attrs}`;
      }
      lines.push(line);
    }
    lines.push("");
  }

  // Format edges (facts/relationships)
  if (searchResults.edges?.length) {
    lines.push("## 相关事实与关系");
    for (const edge of searchResults.edges) {
      lines.push(`- ${edge.fact}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function chunkText(input: string, maxChars = 8000) {
  const paragraphs = input
    .split(/\n\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buffer = "";

  const pushBuffer = () => {
    const trimmed = buffer.trim();
    if (trimmed) chunks.push(trimmed);
    buffer = "";
  };

  for (const paragraph of paragraphs) {
    if (!buffer) {
      if (paragraph.length <= maxChars) {
        buffer = paragraph;
      } else {
        for (let i = 0; i < paragraph.length; i += maxChars) {
          chunks.push(paragraph.slice(i, i + maxChars));
        }
      }
      continue;
    }

    if (buffer.length + paragraph.length + 2 <= maxChars) {
      buffer = `${buffer}\n\n${paragraph}`;
    } else {
      pushBuffer();
      if (paragraph.length <= maxChars) {
        buffer = paragraph;
      } else {
        for (let i = 0; i < paragraph.length; i += maxChars) {
          chunks.push(paragraph.slice(i, i + maxChars));
        }
      }
    }
  }

  pushBuffer();
  return chunks;
}
