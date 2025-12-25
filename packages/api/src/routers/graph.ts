import { z } from "zod";
import { publicProcedure, router } from "../index";
import { getZepClient, ensureUser, ensureGraph, ensureWorldOntology } from "../zep";

const NODE_BATCH_SIZE = 100;
const EDGE_BATCH_SIZE = 100;
const EPISODE_BATCH_SIZE = 100;

// Types
export interface GraphNode {
  uuid: string;
  name: string;
  summary?: string;
  labels?: string[];
  attributes?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface GraphEdge {
  uuid: string;
  source_node_uuid: string;
  target_node_uuid: string;
  type: string;
  name: string;
  fact?: string;
  episodes?: string[];
  created_at: string;
  updated_at: string;
  valid_at?: string;
  expired_at?: string;
  invalid_at?: string;
}

export interface RawTriplet {
  sourceNode: GraphNode;
  edge: GraphEdge;
  targetNode: GraphNode;
}

function transformSDKNode(node: any): GraphNode {
  return {
    uuid: node.uuid,
    name: node.name,
    summary: node.summary,
    labels: node.labels,
    created_at: node.createdAt,
    updated_at: node.updatedAt || "",
    attributes: node.attributes,
  };
}

function transformSDKEdge(edge: any): GraphEdge {
  return {
    uuid: edge.uuid,
    source_node_uuid: edge.sourceNodeUuid,
    target_node_uuid: edge.targetNodeUuid,
    type: edge.type || "",
    name: edge.name,
    fact: edge.fact,
    episodes: edge.episodes,
    created_at: edge.createdAt,
    updated_at: edge.updatedAt || "",
    valid_at: edge.validAt,
    expired_at: edge.expiredAt,
    invalid_at: edge.invalidAt,
  };
}

function createTriplets(edges: GraphEdge[], nodes: GraphNode[]): RawTriplet[] {
  const connectedNodeIds = new Set<string>();

  const edgeTriplets = edges
    .map((edge) => {
      const sourceNode = nodes.find((n) => n.uuid === edge.source_node_uuid);
      const targetNode = nodes.find((n) => n.uuid === edge.target_node_uuid);
      if (!sourceNode || !targetNode) return null;
      connectedNodeIds.add(sourceNode.uuid);
      connectedNodeIds.add(targetNode.uuid);
      return { sourceNode, edge, targetNode };
    })
    .filter((t): t is RawTriplet => t !== null);

  const isolatedNodes = nodes.filter((n) => !connectedNodeIds.has(n.uuid));
  const isolatedTriplets: RawTriplet[] = isolatedNodes.map((node) => ({
    sourceNode: node,
    edge: {
      uuid: `isolated-node-${node.uuid}`,
      source_node_uuid: node.uuid,
      target_node_uuid: node.uuid,
      type: "_isolated_node_",
      name: "",
      created_at: node.created_at,
      updated_at: node.updated_at,
    },
    targetNode: node,
  }));

  return [...edgeTriplets, ...isolatedTriplets];
}

export const graphRouter = router({
  list: publicProcedure.query(async () => {
    const zep = getZepClient();
    const { graphs } = await zep.graph.listAll();
    return (graphs ?? []).map((graph: any) => ({
      graphId: graph.graphId || graph.id || graph.graph_id,
      name: graph.name || graph.graphId || graph.id || graph.graph_id,
    }));
  }),

  create: publicProcedure
    .input(z.object({ graphId: z.string().min(1), name: z.string().optional() }))
    .mutation(async ({ input }) => {
      const userId = process.env.ZEP_USER_ID ?? "demo-user";
      await ensureUser(userId);
      await ensureGraph(input.graphId);
      await ensureWorldOntology({ graphId: input.graphId });
      return { graphId: input.graphId, name: input.name || input.graphId };
    }),

  delete: publicProcedure
    .input(z.object({ graphId: z.string() }))
    .mutation(async ({ input }) => {
      const zep = getZepClient();
      await zep.graph.delete(input.graphId);
      return { success: true };
    }),

  getTriplets: publicProcedure
    .input(z.object({ graphId: z.string().optional(), userId: z.string().optional() }))
    .query(async ({ input }) => {
      const { graphId, userId } = input;
      if (!graphId && !userId) throw new Error("Either graphId or userId must be provided");

      const zep = getZepClient();

      // Fetch nodes
      const allNodes: GraphNode[] = [];
      let nodeCursor: string | undefined;
      let hasMoreNodes = true;
      while (hasMoreNodes) {
        const nodes = graphId
          ? await zep.graph.node.getByGraphId(graphId, { uuidCursor: nodeCursor || "", limit: NODE_BATCH_SIZE })
          : await zep.graph.node.getByUserId(userId!, { uuidCursor: nodeCursor || "", limit: NODE_BATCH_SIZE });
        const transformed = nodes.map(transformSDKNode);
        allNodes.push(...transformed);
        hasMoreNodes = transformed.length >= NODE_BATCH_SIZE;
        if (hasMoreNodes) nodeCursor = transformed[transformed.length - 1].uuid;
      }

      // Fetch edges
      const allEdges: GraphEdge[] = [];
      let edgeCursor: string | undefined;
      let hasMoreEdges = true;
      while (hasMoreEdges) {
        const edges = graphId
          ? await zep.graph.edge.getByGraphId(graphId, { uuidCursor: edgeCursor || "", limit: EDGE_BATCH_SIZE })
          : await zep.graph.edge.getByUserId(userId!, { uuidCursor: edgeCursor || "", limit: EDGE_BATCH_SIZE });
        const transformed = edges.map(transformSDKEdge);
        allEdges.push(...transformed);
        hasMoreEdges = transformed.length >= EDGE_BATCH_SIZE;
        if (hasMoreEdges) edgeCursor = transformed[transformed.length - 1].uuid;
      }

      return createTriplets(allEdges, allNodes);
    }),

  listEpisodes: publicProcedure
    .input(z.object({ graphId: z.string().optional(), userId: z.string().optional() }))
    .query(async ({ input }) => {
      const { graphId, userId } = input;
      if (!graphId && !userId) throw new Error("Either graphId or userId must be provided");

      const zep = getZepClient();
      const { episodes = [] } = graphId
        ? await zep.graph.episode.getByGraphId(graphId, { lastn: EPISODE_BATCH_SIZE })
        : await zep.graph.episode.getByUserId(userId!, { lastn: EPISODE_BATCH_SIZE });
      return episodes;
    }),

  deleteEpisode: publicProcedure
    .input(z.object({ uuid: z.string() }))
    .mutation(async ({ input }) => {
      const zep = getZepClient();
      await zep.graph.episode.delete(input.uuid);
      return { success: true };
    }),
});
