import { ZepClient, ZepError, entityFields, type EdgeType, type EntityType } from "@getzep/zep-cloud";

let zepClient: ZepClient | null = null;

function getOrCreateClient(): ZepClient {
  if (!zepClient) {
    zepClient = new ZepClient({
      apiKey: process.env.ZEP_API_KEY,
      ...(process.env.ZEP_API_BASE_URL ? { baseUrl: process.env.ZEP_API_BASE_URL } : {}),
    });
  }
  return zepClient;
}

const worldEntityTypes: Record<string, EntityType> = {
  Character: {
    description: "World characters, creatures, or agents.",
    fields: {
      aliases: entityFields.text("Aliases or alternative names"),
      kind: entityFields.text("Species or type"),
      role: entityFields.text("Role or occupation"),
      status: entityFields.text("Status such as alive/dead/missing"),
    },
  },
  Faction: {
    description: "Organizations, factions, nations, or groups.",
    fields: { kind: entityFields.text("Faction type") },
  },
  Location: {
    description: "Places in the world.",
    fields: { kind: entityFields.text("Location type") },
  },
  Item: {
    description: "Items, artifacts, devices, or relics.",
    fields: { kind: entityFields.text("Item type") },
  },
  Event: {
    description: "Important events.",
    fields: { summary_text: entityFields.text("Event summary") },
  },
  Concept: {
    description: "Abstract concepts, rules, or myths.",
    fields: { kind: entityFields.text("Concept type") },
  },
  WorldFact: {
    description: "Key-value style world facts.",
    fields: { key: entityFields.text("Fact key"), value: entityFields.text("Fact value") },
  },
};

const worldEdgeTypes: Record<string, EdgeType> = {
  REL_CHARACTER_CHARACTER: {
    description: "Relations between characters.",
    fields: { relation: entityFields.text("Relation type") },
    sourceTargets: [{ source: "Character", target: "Character" }],
  },
  REL_CHARACTER_FACTION: {
    description: "Relations between characters and factions.",
    fields: { relation: entityFields.text("Relation type") },
    sourceTargets: [{ source: "Character", target: "Faction" }],
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

export function getZepClient() {
  ensureApiKey();
  return getOrCreateClient();
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

export async function ensureWorldOntology(targets: { userId?: string; graphId?: string }) {
  const client = getZepClient();
  if (!targets.graphId && !targets.userId) {
    throw new Error("Missing userId or graphId for ontology");
  }

  const targetParams = targets.graphId
    ? { graphIds: [targets.graphId] }
    : { userIds: [targets.userId as string] };

  await client.graph.setEntityTypes(worldEntityTypes, worldEdgeTypes, targetParams);
}
