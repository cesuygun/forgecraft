// ABOUTME: Tests for generation queue operations
// ABOUTME: Verifies queue CRUD, status updates, and listing

import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import "./test-helpers";
import { cleanupTempDir, resetTempDir } from "./test-helpers";
import { initDatabase, closeDatabase } from "../database";
import {
	addToQueue,
	getQueueItem,
	getNextPending,
	updateQueueStatus,
	deleteQueueItem,
	getQueueStatus,
	listQueueItems,
	clearCompletedQueue,
} from "../queue";
import type { GenerationRequest } from "../../../shared/types";

const createRequest = (id: string, overrides?: Partial<GenerationRequest>): GenerationRequest => ({
	id,
	themeId: "test-theme",
	templateId: "test-template",
	templateValues: { race: "orc", job: "warrior" },
	prompt: "test prompt",
	negativePrompt: "test negative",
	model: "test-model",
	width: 512,
	height: 512,
	steps: 20,
	cfgScale: 7,
	seed: null,
	outputPath: "/output/test.png",
	...overrides,
});

describe("Queue Operations", () => {
	beforeEach(() => {
		resetTempDir();
		initDatabase();
	});

	afterEach(() => {
		closeDatabase();
	});

	afterAll(() => {
		cleanupTempDir();
	});

	describe("addToQueue", () => {
		it("should add request to queue with pending status", () => {
			const request = createRequest("req-1");
			const item = addToQueue(request);

			expect(item.id).toBe("req-1");
			expect(item.status).toBe("pending");
			expect(item.request).toEqual(request);
			expect(item.createdAt).toBeGreaterThan(0);
			expect(item.startedAt).toBeNull();
			expect(item.completedAt).toBeNull();
			expect(item.error).toBeNull();
		});

		it("should store request as JSON in database", () => {
			const request = createRequest("req-2");
			addToQueue(request);

			const retrieved = getQueueItem("req-2");
			expect(retrieved?.request).toEqual(request);
		});
	});

	describe("getQueueItem", () => {
		it("should return null for non-existent item", () => {
			const item = getQueueItem("non-existent");
			expect(item).toBeNull();
		});

		it("should return item with all fields", () => {
			const request = createRequest("req-3");
			addToQueue(request);

			const item = getQueueItem("req-3");
			expect(item).not.toBeNull();
			expect(item?.id).toBe("req-3");
			expect(item?.status).toBe("pending");
		});
	});

	describe("getNextPending", () => {
		it("should return null when queue is empty", () => {
			const next = getNextPending();
			expect(next).toBeNull();
		});

		it("should return oldest pending item", () => {
			addToQueue(createRequest("req-a"));
			addToQueue(createRequest("req-b"));
			addToQueue(createRequest("req-c"));

			const next = getNextPending();
			expect(next?.id).toBe("req-a");
		});

		it("should skip non-pending items", () => {
			addToQueue(createRequest("req-1"));
			addToQueue(createRequest("req-2"));
			updateQueueStatus("req-1", "generating");

			const next = getNextPending();
			expect(next?.id).toBe("req-2");
		});
	});

	describe("updateQueueStatus", () => {
		it("should update status", () => {
			addToQueue(createRequest("req-1"));
			updateQueueStatus("req-1", "generating");

			const item = getQueueItem("req-1");
			expect(item?.status).toBe("generating");
		});

		it("should update startedAt when provided", () => {
			addToQueue(createRequest("req-1"));
			const now = Date.now();
			updateQueueStatus("req-1", "generating", { startedAt: now });

			const item = getQueueItem("req-1");
			expect(item?.startedAt).toBe(now);
		});

		it("should update completedAt and resultSeed on complete", () => {
			addToQueue(createRequest("req-1"));
			const now = Date.now();
			updateQueueStatus("req-1", "complete", {
				completedAt: now,
				resultSeed: 12345,
			});

			const item = getQueueItem("req-1");
			expect(item?.status).toBe("complete");
			expect(item?.completedAt).toBe(now);
			expect(item?.resultSeed).toBe(12345);
		});

		it("should update error on failure", () => {
			addToQueue(createRequest("req-1"));
			updateQueueStatus("req-1", "failed", { error: "Model not found" });

			const item = getQueueItem("req-1");
			expect(item?.status).toBe("failed");
			expect(item?.error).toBe("Model not found");
		});
	});

	describe("deleteQueueItem", () => {
		it("should delete existing item", () => {
			addToQueue(createRequest("req-1"));
			const deleted = deleteQueueItem("req-1");

			expect(deleted).toBe(true);
			expect(getQueueItem("req-1")).toBeNull();
		});

		it("should return false for non-existent item", () => {
			const deleted = deleteQueueItem("non-existent");
			expect(deleted).toBe(false);
		});
	});

	describe("getQueueStatus", () => {
		it("should return zeros for empty queue", () => {
			const status = getQueueStatus();

			expect(status.pending).toBe(0);
			expect(status.generating).toBeNull();
			expect(status.completed).toBe(0);
			expect(status.failed).toBe(0);
		});

		it("should count items by status", () => {
			addToQueue(createRequest("req-1"));
			addToQueue(createRequest("req-2"));
			addToQueue(createRequest("req-3"));
			updateQueueStatus("req-2", "generating");
			updateQueueStatus("req-3", "complete");

			const status = getQueueStatus();
			expect(status.pending).toBe(1);
			expect(status.generating).toBe("req-2");
			expect(status.completed).toBe(1);
			expect(status.failed).toBe(0);
		});
	});

	describe("listQueueItems", () => {
		it("should return all items", () => {
			addToQueue(createRequest("req-a"));
			addToQueue(createRequest("req-b"));
			addToQueue(createRequest("req-c"));

			const items = listQueueItems();
			expect(items).toHaveLength(3);
			// All items should be present (order may vary if added in same millisecond)
			const ids = items.map((i) => i.id).sort();
			expect(ids).toEqual(["req-a", "req-b", "req-c"]);
		});

		it("should filter by status", () => {
			addToQueue(createRequest("req-1"));
			addToQueue(createRequest("req-2"));
			updateQueueStatus("req-1", "complete");

			const pending = listQueueItems({ status: "pending" });
			expect(pending).toHaveLength(1);
			expect(pending[0].id).toBe("req-2");
		});

		it("should respect limit and offset", () => {
			addToQueue(createRequest("req-1"));
			addToQueue(createRequest("req-2"));
			addToQueue(createRequest("req-3"));

			const page = listQueueItems({ limit: 2, offset: 1 });
			expect(page).toHaveLength(2);
		});
	});

	describe("clearCompletedQueue", () => {
		it("should remove all completed items", () => {
			addToQueue(createRequest("req-1"));
			addToQueue(createRequest("req-2"));
			addToQueue(createRequest("req-3"));
			updateQueueStatus("req-1", "complete");
			updateQueueStatus("req-2", "complete");

			const cleared = clearCompletedQueue();
			expect(cleared).toBe(2);

			const remaining = listQueueItems();
			expect(remaining).toHaveLength(1);
			expect(remaining[0].id).toBe("req-3");
		});
	});
});
