// ABOUTME: Tests for theme CRUD operations
// ABOUTME: Verifies JSON file operations and validation

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import "./test-helpers";
import { cleanupTempDir, resetTempDir } from "./test-helpers";
import {
	listThemes,
	getTheme,
	themeExists,
	createTheme,
	updateTheme,
	deleteTheme,
} from "../themes";
import type { CreateThemeInput } from "../../../shared/types";

const validThemeInput: CreateThemeInput = {
	id: "test-theme",
	name: "Test Theme",
	stylePrompt: "pixel art, dark fantasy, detailed",
	negativePrompt: "blurry, low quality",
	defaults: {
		model: "dreamshaper-xl",
		steps: 20,
		cfgScale: 7,
		width: 512,
		height: 512,
	},
};

describe("Theme CRUD Operations", () => {
	beforeEach(() => {
		resetTempDir();
	});

	afterAll(() => {
		cleanupTempDir();
	});

	describe("createTheme", () => {
		it("should create theme with valid input", () => {
			const theme = createTheme(validThemeInput);

			expect(theme.id).toBe("test-theme");
			expect(theme.name).toBe("Test Theme");
			expect(theme.stylePrompt).toBe("pixel art, dark fantasy, detailed");
			expect(theme.createdAt).toBeDefined();
			expect(theme.updatedAt).toBeDefined();
		});

		it("should set empty string for missing negativePrompt", () => {
			const theme = createTheme({
				...validThemeInput,
				id: "no-negative",
				negativePrompt: undefined,
			});

			expect(theme.negativePrompt).toBe("");
		});

		it("should throw for duplicate ID", () => {
			createTheme(validThemeInput);

			expect(() => createTheme(validThemeInput)).toThrow('already exists');
		});

		it("should throw for invalid ID format", () => {
			expect(() =>
				createTheme({ ...validThemeInput, id: "Invalid ID!" }),
			).toThrow("lowercase letters, numbers, and hyphens");
		});

		it("should throw for ID too long", () => {
			expect(() =>
				createTheme({ ...validThemeInput, id: "a".repeat(100) }),
			).toThrow("between 1 and 64");
		});

		it("should throw for empty name", () => {
			expect(() =>
				createTheme({ ...validThemeInput, id: "empty-name", name: "" }),
			).toThrow("Name must be between");
		});

		it("should throw for empty stylePrompt", () => {
			expect(() =>
				createTheme({ ...validThemeInput, id: "empty-style", stylePrompt: "" }),
			).toThrow("Style prompt must be between");
		});

		it("should throw for steps out of range", () => {
			expect(() =>
				createTheme({
					...validThemeInput,
					id: "bad-steps",
					defaults: { ...validThemeInput.defaults, steps: 0 },
				}),
			).toThrow("Steps must be between");

			expect(() =>
				createTheme({
					...validThemeInput,
					id: "bad-steps-2",
					defaults: { ...validThemeInput.defaults, steps: 200 },
				}),
			).toThrow("Steps must be between");
		});

		it("should throw for cfgScale out of range", () => {
			expect(() =>
				createTheme({
					...validThemeInput,
					id: "bad-cfg",
					defaults: { ...validThemeInput.defaults, cfgScale: 0 },
				}),
			).toThrow("CFG scale must be between");
		});

		it("should throw for dimensions not divisible by 8", () => {
			expect(() =>
				createTheme({
					...validThemeInput,
					id: "bad-width",
					defaults: { ...validThemeInput.defaults, width: 513 },
				}),
			).toThrow("divisible by 8");
		});

		it("should throw for dimensions out of range", () => {
			expect(() =>
				createTheme({
					...validThemeInput,
					id: "bad-height",
					defaults: { ...validThemeInput.defaults, height: 32 },
				}),
			).toThrow("between 64 and 2048");
		});
	});

	describe("getTheme", () => {
		it("should return null for non-existent theme", () => {
			const theme = getTheme("non-existent");
			expect(theme).toBeNull();
		});

		it("should return theme with all fields", () => {
			createTheme(validThemeInput);

			const theme = getTheme("test-theme");
			expect(theme).not.toBeNull();
			expect(theme?.id).toBe("test-theme");
			expect(theme?.defaults.model).toBe("dreamshaper-xl");
		});
	});

	describe("themeExists", () => {
		it("should return false for non-existent theme", () => {
			expect(themeExists("non-existent")).toBe(false);
		});

		it("should return true for existing theme", () => {
			createTheme(validThemeInput);
			expect(themeExists("test-theme")).toBe(true);
		});
	});

	describe("listThemes", () => {
		it("should return empty array when no themes", () => {
			const themes = listThemes();
			expect(themes).toEqual([]);
		});

		it("should return all themes sorted by name", () => {
			createTheme({ ...validThemeInput, id: "z-theme", name: "Zebra Theme" });
			createTheme({ ...validThemeInput, id: "a-theme", name: "Alpha Theme" });
			createTheme({ ...validThemeInput, id: "m-theme", name: "Middle Theme" });

			const themes = listThemes();
			expect(themes).toHaveLength(3);
			expect(themes[0].name).toBe("Alpha Theme");
			expect(themes[1].name).toBe("Middle Theme");
			expect(themes[2].name).toBe("Zebra Theme");
		});
	});

	describe("updateTheme", () => {
		it("should update name", () => {
			createTheme(validThemeInput);

			const updated = updateTheme("test-theme", { name: "Updated Name" });
			expect(updated.name).toBe("Updated Name");
			expect(updated.stylePrompt).toBe(validThemeInput.stylePrompt);
		});

		it("should update stylePrompt", () => {
			createTheme(validThemeInput);

			const updated = updateTheme("test-theme", { stylePrompt: "new style" });
			expect(updated.stylePrompt).toBe("new style");
		});

		it("should partially update defaults", () => {
			createTheme(validThemeInput);

			const updated = updateTheme("test-theme", {
				defaults: { steps: 30 },
			});
			expect(updated.defaults.steps).toBe(30);
			expect(updated.defaults.model).toBe("dreamshaper-xl"); // Unchanged
		});

		it("should update updatedAt timestamp", () => {
			const original = createTheme(validThemeInput);

			const updated = updateTheme("test-theme", { name: "New Name" });
			// updatedAt should be set and be >= createdAt
			expect(updated.updatedAt).toBeDefined();
			expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
				new Date(original.createdAt).getTime(),
			);
		});

		it("should throw for non-existent theme", () => {
			expect(() => updateTheme("non-existent", { name: "New" })).toThrow(
				'not found',
			);
		});

		it("should validate updated values", () => {
			createTheme(validThemeInput);

			expect(() =>
				updateTheme("test-theme", { defaults: { steps: 0 } }),
			).toThrow("Steps must be between");
		});
	});

	describe("deleteTheme", () => {
		it("should delete existing theme", () => {
			createTheme(validThemeInput);

			const deleted = deleteTheme("test-theme");
			expect(deleted).toBe(true);
			expect(getTheme("test-theme")).toBeNull();
		});

		it("should return false for non-existent theme", () => {
			const deleted = deleteTheme("non-existent");
			expect(deleted).toBe(false);
		});
	});
});
