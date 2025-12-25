import { z } from "zod";

import { addFactTriple, addGraphData } from "@/lib/zep";

const entityTypes = [
  "Character",
  "Faction",
  "Location",
  "Item",
  "Event",
  "Concept",
  "WorldFact",
] as const;

const relationshipTypes = [
  "REL_CHARACTER_CHARACTER",
  "REL_CHARACTER_FACTION",
  "REL_CHARACTER_LOCATION",
  "REL_FACTION_FACTION",
  "REL_ITEM_CHARACTER",
  "REL_ITEM_LOCATION",
  "REL_EVENT_PARTICIPANT",
  "REL_EVENT_LOCATION",
  "REL_EVENT_EVENT",
  "REL_CONCEPT_RELATED_TO",
] as const;

const baseEntitySchema = z
  .object({
    type: z.enum(entityTypes),
    name: z.string().optional(),
    temp_id: z.string().optional(),
    id: z.string().optional(),
  })
  .passthrough();

const updatedEntitySchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    type: z.enum(entityTypes).optional(),
    set: z.record(z.string(), z.any()).optional(),
    append: z.record(z.string(), z.any()).optional(),
  })
  .passthrough();

const relationshipSchema = z
  .object({
    type: z.enum(relationshipTypes),
    from_entity_id: z.string().optional(),
    to_entity_id: z.string().optional(),
    from_entity_name: z.string().optional(),
    to_entity_name: z.string().optional(),
    relation: z.string().optional(),
    role: z.string().optional(),
    notes: z.string().optional(),
  })
  .passthrough();

const eventSchema = z
  .object({
    name: z.string(),
    summary: z.string().optional(),
    time: z.string().optional(),
    importance: z.number().int().optional(),
    status: z.string().optional(),
    notes: z.string().optional(),
    participants: z
      .array(
        z.object({
          entity_id: z.string().optional(),
          entity_name: z.string().optional(),
          role: z.string().optional(),
        })
      )
      .optional(),
    location_id: z.string().optional(),
    location_name: z.string().optional(),
  })
  .passthrough();

const worldFactSchema = z
  .object({
    key: z.string(),
    value: z.string(),
    notes: z.string().optional(),
  })
  .passthrough();

export const worldUpdatePayloadSchema = z.object({
  assistant_reply: z.string(),
  world_updates: z.object({
    new_entities: z.array(baseEntitySchema).default([]),
    updated_entities: z.array(updatedEntitySchema).default([]),
    new_relationships: z.array(relationshipSchema).default([]),
    updated_relationships: z.array(relationshipSchema).default([]),
    new_events: z.array(eventSchema).default([]),
    world_facts: z.array(worldFactSchema).default([]),
  }),
});

export type WorldUpdatePayload = z.infer<typeof worldUpdatePayloadSchema>;

export function parseWorldUpdatePayload(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    const result = worldUpdatePayloadSchema.safeParse(parsed);
    if (result.success) return result.data;
  } catch {
    return null;
  }
  return null;
}

export async function applyWorldUpdates(input: {
  updates: WorldUpdatePayload;
  userId: string;
  graphId?: string;
}) {
  const { updates, userId, graphId } = input;
  const createdAt = new Date().toISOString();
  const tempIdMap = new Map<string, string>();

  for (const entity of updates.world_updates.new_entities) {
    if (entity.temp_id && entity.name) {
      tempIdMap.set(entity.temp_id, entity.name);
    }
  }

  for (const entity of updates.world_updates.new_entities) {
    await addGraphData({
      data: JSON.stringify({
        entity_type: entity.type,
        ...normalizeEntityPayload(entity),
      }),
      type: "json",
      userId,
      graphId,
      createdAt,
      sourceDescription: "world_update:new_entity",
    });
  }

  for (const entity of updates.world_updates.updated_entities) {
    const normalizedEntity = normalizeEntityPayload(entity);
    await addGraphData({
      data: JSON.stringify({
        entity_type: entity.type,
        ...normalizedEntity,
      }),
      type: "json",
      userId,
      graphId,
      createdAt,
      sourceDescription: "world_update:updated_entity",
    });
  }

  for (const event of updates.world_updates.new_events) {
    const normalizedEvent = normalizeEntityPayload(event);
    await addGraphData({
      data: JSON.stringify({
        entity_type: "Event",
        ...normalizedEvent,
      }),
      type: "json",
      userId,
      graphId,
      createdAt,
      sourceDescription: "world_update:new_event",
    });

    if (event.participants?.length) {
      for (const participant of event.participants) {
        const participantName =
          participant.entity_name ??
          (participant.entity_id ? tempIdMap.get(participant.entity_id) : undefined);
        if (!participantName) continue;
        await addFactTriple({
          fact: participant.role ?? "participant",
          factName: "REL_EVENT_PARTICIPANT",
          sourceNodeName: participantName,
          targetNodeName: event.name,
          graphId,
          userId,
          createdAt,
        });
      }
    }

    const locationName =
      event.location_name ??
      (event.location_id ? tempIdMap.get(event.location_id) : undefined);
    if (locationName) {
      await addFactTriple({
        fact: "OCCURRED_AT",
        factName: "REL_EVENT_LOCATION",
        sourceNodeName: event.name,
        targetNodeName: locationName,
        graphId,
        userId,
        createdAt,
      });
    }
  }

  for (const fact of updates.world_updates.world_facts) {
    await addGraphData({
      data: JSON.stringify({
        entity_type: "WorldFact",
        ...fact,
      }),
      type: "json",
      userId,
      graphId,
      createdAt,
      sourceDescription: "world_update:world_fact",
    });
  }

  const allRelationships = [
    ...updates.world_updates.new_relationships,
    ...updates.world_updates.updated_relationships,
  ];

  for (const relation of allRelationships) {
    const sourceName =
      relation.from_entity_name ??
      (relation.from_entity_id ? tempIdMap.get(relation.from_entity_id) : undefined);
    const targetName =
      relation.to_entity_name ??
      (relation.to_entity_id ? tempIdMap.get(relation.to_entity_id) : undefined);

    if (sourceName && targetName) {
      await addFactTriple({
        fact: relation.relation ?? relation.role ?? relation.notes ?? "RELATED",
        factName: relation.type,
        sourceNodeName: sourceName,
        targetNodeName: targetName,
        graphId,
        userId,
        createdAt,
      });
    } else {
      await addGraphData({
        data: JSON.stringify({
          relationship_type: relation.type,
          ...relation,
        }),
        type: "json",
        userId,
        graphId,
        createdAt,
        sourceDescription: "world_update:relationship",
      });
    }
  }
}

function normalizeEntityPayload<T extends Record<string, unknown>>(payload: T) {
  const normalized = { ...payload } as Record<string, unknown>;
  if ("summary" in normalized) {
    normalized.summary_text = normalized.summary;
    delete normalized.summary;
  }
  if (normalized.set && typeof normalized.set === "object") {
    normalized.set = replaceSummaryKey(normalized.set as Record<string, unknown>);
  }
  if (normalized.append && typeof normalized.append === "object") {
    normalized.append = replaceSummaryKey(normalized.append as Record<string, unknown>);
  }
  return normalized;
}

function replaceSummaryKey(input: Record<string, unknown>) {
  if (!("summary" in input)) return input;
  const output = { ...input };
  output.summary_text = output.summary;
  delete output.summary;
  return output;
}
