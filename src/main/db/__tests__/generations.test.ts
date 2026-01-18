// ABOUTME: Tests for generation history operations
// ABOUTME: Verifies recording and querying completed generations

import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import "./test-helpers";
import { cleanupTempDir, resetTempDir } from "./test-helpers";
import { initDatabase, closeDatabase } from "../database";
import {
	recordGeneration,
	getGeneration,
	listGenerations,
	countGenerations,
	deleteGeneration,
} from "../generations";
import type { GenerationRecord } from "../../../shared/types";

const createRecord = (id: string, overrides?: Partial<GenerationRecord>): GenerationRecord => ({
	id,
	themeId: "test-theme",
	templateId: "test-template",
	templateValues: { race: "orc", job: "warrior" },
	prompt: "test prompt",
	negativePrompt: "test negative",
	seed: 12345,
	outputPath: "/output/test.png",
	model: "test-model",
	width: 512,
	height: 512,
	steps: 20,
	cfgScale: 7,
	generationTimeMs: 5000,
	createdAt: Date.now(),
	...overrides,
});

describe("Generation History Operations", () => {
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

	describe("recordGeneration", () => {
		it("should store generation record", () => {
			const record = createRecord("gen-1");
			recordGeneration(record);

			const retrieved = getGeneration("gen-1");
			expect(retrieved).not.toBeNull();
			expect(retrieved?.id).toBe("gen-1");
		});

		it("should store all fields correctly", () => {
			const record = createRecord("gen-2", {
				themeId: "custom-theme",
				templateId: "custom-template",
				templateValues: { slot: "boots", rarity: "epic" },
				seed: 99999,
			});
			recordGeneration(record);

			const retrieved = getGeneration("gen-2");
			expect(retrieved?.themeId).toBe("custom-theme");
			expect(retrieved?.templateId).toBe("custom-template");
			expect(retrieved?.templateValues).toEqual({ slot: "boots", rarity: "epic" });
			expect(retrieved?.seed).toBe(99999);
		});

		it("should handle null templateValues", () => {
			const record = createRecord("gen-3", {
				templateId: null,
				templateValues: null,
			});
			recordGeneration(record);

			const retrieved = getGeneration("gen-3");
			expect(retrieved?.templateId).toBeNull();
			expect(retrieved?.templateValues).toBeNull();
		});
	});

	describe("getGeneration", () => {
		it("should return null for non-existent record", () => {
			const record = getGeneration("non-existent");
			expect(record).toBeNull();
		});

		it("should parse JSON fields correctly", () => {
			const record = createRecord("gen-1", {
				templateValues: { a: "1", b: "2", c: "3" },
			});
			recordGeneration(record);

			const retrieved = getGeneration("gen-1");
			expect(retrieved?.templateValues).toEqual({ a: "1", b: "2", c: "3" });
		});
	});

	describe("listGenerations", () => {
		it("should return all records in descending order", () => {
			recordGeneration(createRecord("gen-a", { createdAt: 1000 }));
			recordGeneration(createRecord("gen-b", { createdAt: 2000 }));
			recordGeneration(createRecord("gen-c", { createdAt: 3000 }));

			const records = listGenerations();
			expect(records).toHaveLength(3);
			expect(records[0].id).toBe("gen-c"); // Most recent first
		});

		it("should filter by themeId", () => {
			recordGeneration(createRecord("gen-1", { themeId: "theme-a" }));
			recordGeneration(createRecord("gen-2", { themeId: "theme-b" }));
			recordGeneration(createRecord("gen-3", { themeId: "theme-a" }));

			const records = listGenerations({ themeId: "theme-a" });
			expect(records).toHaveLength(2);
			expect(records.every((r) => r.themeId === "theme-a")).toBe(true);
		});

		it("should filter by templateId", () => {
			recordGeneration(createRecord("gen-1", { templateId: "tpl-a" }));
			recordGeneration(createRecord("gen-2", { templateId: "tpl-b" }));

			const records = listGenerations({ templateId: "tpl-a" });
			expect(records).toHaveLength(1);
			expect(records[0].templateId).toBe("tpl-a");
		});

		it("should filter by both themeId and templateId", () => {
			recordGeneration(createRecord("gen-1", { themeId: "t1", templateId: "tpl-a" }));
			recordGeneration(createRecord("gen-2", { themeId: "t1", templateId: "tpl-b" }));
			recordGeneration(createRecord("gen-3", { themeId: "t2", templateId: "tpl-a" }));

			const records = listGenerations({ themeId: "t1", templateId: "tpl-a" });
			expect(records).toHaveLength(1);
			expect(records[0].id).toBe("gen-1");
		});

		it("should respect limit and offset", () => {
			for (let i = 0; i < 10; i++) {
				recordGeneration(createRecord(`gen-${i}`, { createdAt: i * 1000 }));
			}

			const page = listGenerations({ limit: 3, offset: 2 });
			expect(page).toHaveLength(3);
		});
	});

	describe("countGenerations", () => {
		it("should return total count", () => {
			recordGeneration(createRecord("gen-1"));
			recordGeneration(createRecord("gen-2"));
			recordGeneration(createRecord("gen-3"));

			const count = countGenerations();
			expect(count).toBe(3);
		});

		it("should filter count by themeId", () => {
			recordGeneration(createRecord("gen-1", { themeId: "theme-a" }));
			recordGeneration(createRecord("gen-2", { themeId: "theme-b" }));
			recordGeneration(createRecord("gen-3", { themeId: "theme-a" }));

			const count = countGenerations({ themeId: "theme-a" });
			expect(count).toBe(2);
		});
	});

	describe("deleteGeneration", () => {
		it("should delete existing record", () => {
			recordGeneration(createRecord("gen-1"));
			const deleted = deleteGeneration("gen-1");

			expect(deleted).toBe(true);
			expect(getGeneration("gen-1")).toBeNull();
		});

		it("should return false for non-existent record", () => {
			const deleted = deleteGeneration("non-existent");
			expect(deleted).toBe(false);
		});
	});
});
