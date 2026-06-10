import Dexie, { type Table } from 'dexie';

export interface LocalNode {
  id: string;
  session_id: string;
  branch_id: string;
  parent_node_id: string | null;
  role: 'user' | 'assistant' | 'system_summary';
  content: string;
  model_used: string | null;
  timestamp: string;
  is_condensed: boolean;
}

export interface LocalSession {
  id: string;
  title: string;
  created_at: string;
  last_active: string;
}

class LocalDatabase extends Dexie {
  nodes!: Table<LocalNode>;
  sessions!: Table<LocalSession>;

  constructor() {
    super('NeuraStitchLocalDB');
    this.version(1).stores({
      nodes: 'id, session_id, parent_node_id, branch_id, role, timestamp',
      sessions: 'id, title, created_at, last_active'
    });
  }
}

export const db = new LocalDatabase();

/**
 * Traverses upwards from a leaf node to reconstruct the chronological thread history.
 */
export async function getLocalPathToNode(nodeId: string): Promise<LocalNode[]> {
  const path: LocalNode[] = [];
  let currentId: string | null = nodeId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const node: LocalNode | undefined = await db.nodes.get(currentId);
    if (!node) break;

    path.push(node);
    currentId = node.parent_node_id;
  }

  return path.reverse();
}
