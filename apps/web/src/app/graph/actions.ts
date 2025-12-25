"use server";

import { getZepClient, ensureUser, ensureGraph, ensureWorldOntology } from "@/lib/zep";
import type { Node, Edge, RawTriplet } from "@/lib/types/graph";
import { createTriplets } from "@/lib/utils/graph";
import { Zep } from "@getzep/zep-cloud";

const NODE_BATCH_SIZE = 100;
const EDGE_BATCH_SIZE = 100;

const transformSDKNode = (node: Zep.EntityNode): Node => ({
  uuid: node.uuid,
  name: node.name,
  summary: node.summary,
  labels: node.labels,
  created_at: node.createdAt,
  updated_at: "",
  attributes: node.attributes,
});

const transformSDKEdge = (edge: Zep.EntityEdge): Edge => ({
  uuid: edge.uuid,
  source_node_uuid: edge.sourceNodeUuid,
  target_node_uuid: edge.targetNodeUuid,
  type: "",
  name: edge.name,
  fact: edge.fact,
  episodes: edge.episodes,
  created_at: edge.createdAt,
  updated_at: "",
  valid_at: edge.validAt,
  expired_at: edge.expiredAt,
  invalid_at: edge.invalidAt,
});

export async function listGraphs() {
  const zep = getZepClient();
  const { graphs } = await zep.graph.listAll();
  return (graphs ?? []).map((graph: any) => ({
    graphId: graph.graphId || graph.id || graph.graph_id,
    name: graph.name || graph.graphId || graph.id || graph.graph_id,
  }));
}

export async function createGraph(input: { graphId: string; name?: string }) {
  const zep = getZepClient();
  const userId = process.env.ZEP_USER_ID ?? "demo-user";
  
  await ensureUser(userId);
  await ensureGraph(input.graphId);
  await ensureWorldOntology({ graphId: input.graphId });
  
  return { graphId: input.graphId, name: input.name || input.graphId };
}

export async function getGraphTriplets(input: {
  graphId?: string;
  userId?: string;
}): Promise<RawTriplet[]> {
  const { graphId, userId } = input;

  if (!graphId && !userId) {
    throw new Error("Either graphId or userId must be provided");
  }

  const zep = getZepClient();

  // Fetch all nodes
  const allNodes: Node[] = [];
  let nodeCursor: string | undefined;
  let hasMoreNodes = true;

  while (hasMoreNodes) {
    const nodes = graphId
      ? await zep.graph.node.getByGraphId(graphId, {
          uuidCursor: nodeCursor || "",
          limit: NODE_BATCH_SIZE,
        })
      : await zep.graph.node.getByUserId(userId!, {
          uuidCursor: nodeCursor || "",
          limit: NODE_BATCH_SIZE,
        });

    const transformedNodes = nodes.map(transformSDKNode);
    allNodes.push(...transformedNodes);

    if (transformedNodes.length < NODE_BATCH_SIZE) {
      hasMoreNodes = false;
    } else {
      nodeCursor = transformedNodes[transformedNodes.length - 1].uuid;
    }
  }

  // Fetch all edges
  const allEdges: Edge[] = [];
  let edgeCursor: string | undefined;
  let hasMoreEdges = true;

  while (hasMoreEdges) {
    const edges = graphId
      ? await zep.graph.edge.getByGraphId(graphId, {
          uuidCursor: edgeCursor || "",
          limit: EDGE_BATCH_SIZE,
        })
      : await zep.graph.edge.getByUserId(userId!, {
          uuidCursor: edgeCursor || "",
          limit: EDGE_BATCH_SIZE,
        });

    const transformedEdges = edges.map(transformSDKEdge);
    allEdges.push(...transformedEdges);

    if (transformedEdges.length < EDGE_BATCH_SIZE) {
      hasMoreEdges = false;
    } else {
      edgeCursor = transformedEdges[transformedEdges.length - 1].uuid;
    }
  }

  return createTriplets(allEdges, allNodes);
}

export async function deleteGraph(graphId: string) {
  const zep = getZepClient();
  await zep.graph.delete(graphId);
  return { success: true };
}

const EPISODE_BATCH_SIZE = 100;

export async function listEpisodes(input: {
  graphId?: string;
  userId?: string;
}) {
  const { graphId, userId } = input;

  if (!graphId && !userId) {
    throw new Error("Either graphId or userId must be provided");
  }

  const zep = getZepClient();
  
  const { episodes = [] } = graphId
    ? await zep.graph.episode.getByGraphId(graphId, { lastn: EPISODE_BATCH_SIZE })
    : await zep.graph.episode.getByUserId(userId!, { lastn: EPISODE_BATCH_SIZE });
  
  return episodes;
}

export async function deleteEpisode(uuid: string) {
  const zep = getZepClient();
  await zep.graph.episode.delete(uuid);
  return { success: true };
}

// Entity Types
// export interface EntityTypeInfo {
//   name: string;
//   description?: string;
//   fields?: Record<string, any>;
// }

export async function listEntityTypes(input: {
  graphId?: string;
  userId?: string;
}) {
  const { graphId, userId } = input;

  const zep = getZepClient();
  
  const { entityTypes = [] } = await zep.graph.listEntityTypes({
    graphId,
    userId,
  });

  
  return entityTypes;
}

