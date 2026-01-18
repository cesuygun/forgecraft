// ABOUTME: Generation queue database operations
// ABOUTME: Add, update, query queue items

import { getDatabase } from "./database";
import type {
  GenerationRequest,
  QueueItem,
  QueueStatus,
  QueueStatusMessage,
} from "../../shared/types";

// SQLite row type for generation_queue table
interface QueueRow {
  id: string;
  status: QueueStatus;
  request: string;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  error: string | null;
  result_seed: number | null;
}

// Convert database row to QueueItem
const rowToQueueItem = (row: QueueRow): QueueItem => ({
  id: row.id,
  status: row.status,
  request: JSON.parse(row.request) as GenerationRequest,
  createdAt: row.created_at,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  error: row.error,
  resultSeed: row.result_seed,
});

export const addToQueue = (request: GenerationRequest): QueueItem => {
  const db = getDatabase();
  const now = Date.now();

  const item: QueueItem = {
    id: request.id,
    status: "pending",
    request,
    createdAt: now,
    startedAt: null,
    completedAt: null,
    error: null,
    resultSeed: null,
  };

  db.prepare(
    `INSERT INTO generation_queue (id, status, request, created_at)
		 VALUES (?, ?, ?, ?)`,
  ).run(item.id, item.status, JSON.stringify(item.request), item.createdAt);

  return item;
};

export const getQueueItem = (id: string): QueueItem | null => {
  const db = getDatabase();
  const row = db
    .prepare("SELECT * FROM generation_queue WHERE id = ?")
    .get(id) as QueueRow | undefined;

  if (!row) return null;
  return rowToQueueItem(row);
};

export const getNextPending = (): QueueItem | null => {
  const db = getDatabase();
  const row = db
    .prepare(
      "SELECT * FROM generation_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1",
    )
    .get() as QueueRow | undefined;

  if (!row) return null;
  return rowToQueueItem(row);
};

export const updateQueueStatus = (
  id: string,
  status: QueueStatus,
  updates?: {
    startedAt?: number;
    completedAt?: number;
    error?: string;
    resultSeed?: number;
  },
): void => {
  const db = getDatabase();

  let sql = "UPDATE generation_queue SET status = ?";
  const params: (string | number | null)[] = [status];

  if (updates?.startedAt !== undefined) {
    sql += ", started_at = ?";
    params.push(updates.startedAt);
  }
  if (updates?.completedAt !== undefined) {
    sql += ", completed_at = ?";
    params.push(updates.completedAt);
  }
  if (updates?.error !== undefined) {
    sql += ", error = ?";
    params.push(updates.error);
  }
  if (updates?.resultSeed !== undefined) {
    sql += ", result_seed = ?";
    params.push(updates.resultSeed);
  }

  sql += " WHERE id = ?";
  params.push(id);

  db.prepare(sql).run(...params);
};

export const deleteQueueItem = (id: string): boolean => {
  const db = getDatabase();
  const result = db
    .prepare("DELETE FROM generation_queue WHERE id = ?")
    .run(id);
  return result.changes > 0;
};

export const getQueueStatus = (): QueueStatusMessage => {
  const db = getDatabase();

  const counts = db
    .prepare(
      `SELECT
				SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
				SUM(CASE WHEN status = 'generating' THEN 1 ELSE 0 END) as generating,
				SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) as completed,
				SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
			 FROM generation_queue`,
    )
    .get() as {
    pending: number;
    generating: number;
    completed: number;
    failed: number;
  };

  // Get the ID of the currently generating item (if any)
  const generatingItem = db
    .prepare(
      "SELECT id FROM generation_queue WHERE status = 'generating' LIMIT 1",
    )
    .get() as { id: string } | undefined;

  return {
    pending: counts.pending || 0,
    generating: generatingItem?.id ?? null,
    completed: counts.completed || 0,
    failed: counts.failed || 0,
  };
};

export const listQueueItems = (options?: {
  status?: QueueStatus;
  limit?: number;
  offset?: number;
}): QueueItem[] => {
  const db = getDatabase();

  let sql = "SELECT * FROM generation_queue";
  const params: (string | number)[] = [];

  if (options?.status) {
    sql += " WHERE status = ?";
    params.push(options.status);
  }

  sql += " ORDER BY created_at DESC";

  if (options?.limit) {
    sql += " LIMIT ?";
    params.push(options.limit);
  }

  if (options?.offset) {
    sql += " OFFSET ?";
    params.push(options.offset);
  }

  const rows = db.prepare(sql).all(...params) as QueueRow[];
  return rows.map(rowToQueueItem);
};

export const clearCompletedQueue = (): number => {
  const db = getDatabase();
  const result = db
    .prepare("DELETE FROM generation_queue WHERE status = 'complete'")
    .run();
  return result.changes;
};

export const resetQueueItem = (id: string): boolean => {
  const db = getDatabase();
  const result = db
    .prepare(
      `UPDATE generation_queue
			 SET status = 'pending', started_at = NULL, completed_at = NULL, error = NULL, result_seed = NULL
			 WHERE id = ?`,
    )
    .run(id);
  return result.changes > 0;
};
