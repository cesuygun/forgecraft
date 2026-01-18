// ABOUTME: Tests for output path utilities
// ABOUTME: Verifies path building for different scenarios

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import "./test-helpers";
import { cleanupTempDir, resetTempDir } from "./test-helpers";
import { buildOutputPath, getOutputPath, getThemeOutputPath, getTemplateOutputPath } from "../output";
import { existsSync } from "fs";
import { join } from "path";

describe("Output Path Utilities", () => {
	beforeEach(() => {
		resetTempDir();
	});

	afterAll(() => {
		cleanupTempDir();
	});

	describe("getOutputPath", () => {
		it("should return output directory path", () => {
			const outputPath = getOutputPath();
			expect(outputPath).toContain(".forgecraft");
			expect(outputPath).toContain("output");
		});

		it("should create directory if not exists", () => {
			const outputPath = getOutputPath();
			expect(existsSync(outputPath)).toBe(true);
		});
	});

	describe("buildOutputPath", () => {
		describe("raw prompt (no theme)", () => {
			it("should build path in _raw directory", () => {
				const path = buildOutputPath({
					themeId: null,
					templateId: null,
					templateValues: null,
					seed: 12345,
					timestamp: 1000,
				});

				expect(path).toContain("_raw");
				expect(path).toContain("1000-12345.png");
			});

			it("should create _raw directory", () => {
				buildOutputPath({
					themeId: null,
					templateId: null,
					templateValues: null,
					seed: 12345,
				});

				const rawPath = join(getOutputPath(), "_raw");
				expect(existsSync(rawPath)).toBe(true);
			});
		});

		describe("theme only (raw within theme)", () => {
			it("should build path in theme/_raw directory", () => {
				const path = buildOutputPath({
					themeId: "hero-legends",
					templateId: null,
					templateValues: null,
					seed: 12345,
					timestamp: 2000,
				});

				expect(path).toContain("hero-legends");
				expect(path).toContain("_raw");
				expect(path).toContain("2000-12345.png");
			});

			it("should handle theme + empty templateValues", () => {
				const path = buildOutputPath({
					themeId: "my-theme",
					templateId: "my-template",
					templateValues: null,
					seed: 99999,
					timestamp: 3000,
				});

				expect(path).toContain("my-theme");
				expect(path).toContain("_raw");
			});
		});

		describe("theme + template", () => {
			it("should build full path with variable values", () => {
				const path = buildOutputPath({
					themeId: "hero-legends",
					templateId: "characters",
					templateValues: { race: "orc", job: "warrior" },
					seed: 54321,
				});

				expect(path).toContain("hero-legends");
				expect(path).toContain("characters");
				expect(path).toContain("54321.png");
			});

			it("should use variableOrder for consistent paths", () => {
				const path1 = buildOutputPath({
					themeId: "theme",
					templateId: "template",
					templateValues: { b: "second", a: "first" },
					variableOrder: ["a", "b"],
					seed: 111,
				});

				const path2 = buildOutputPath({
					themeId: "theme",
					templateId: "template",
					templateValues: { a: "first", b: "second" },
					variableOrder: ["a", "b"],
					seed: 111,
				});

				expect(path1).toBe(path2);
				expect(path1).toContain("first-second");
			});

			it("should fall back to sorted keys without variableOrder", () => {
				const path = buildOutputPath({
					themeId: "theme",
					templateId: "template",
					templateValues: { z: "last", a: "first", m: "middle" },
					seed: 222,
				});

				// Should be sorted: a-m-z
				expect(path).toContain("first-middle-last");
			});

			it("should create all necessary directories", () => {
				buildOutputPath({
					themeId: "new-theme",
					templateId: "new-template",
					templateValues: { race: "elf" },
					variableOrder: ["race"],
					seed: 333,
				});

				const expectedDir = join(
					getOutputPath(),
					"new-theme",
					"new-template",
					"elf",
				);
				expect(existsSync(expectedDir)).toBe(true);
			});
		});

		describe("edge cases", () => {
			it("should handle single variable", () => {
				const path = buildOutputPath({
					themeId: "theme",
					templateId: "icons",
					templateValues: { slot: "boots" },
					variableOrder: ["slot"],
					seed: 444,
				});

				expect(path).toContain("boots");
				expect(path).toContain("444.png");
			});

			it("should handle many variables", () => {
				const path = buildOutputPath({
					themeId: "theme",
					templateId: "complex",
					templateValues: { a: "1", b: "2", c: "3", d: "4" },
					variableOrder: ["a", "b", "c", "d"],
					seed: 555,
				});

				expect(path).toContain("1-2-3-4");
			});

			it("should use current timestamp when not provided", () => {
				const before = Date.now();
				const path = buildOutputPath({
					themeId: null,
					templateId: null,
					templateValues: null,
					seed: 666,
				});
				const after = Date.now();

				// Extract timestamp from filename
				const filename = path.split("/").pop()!;
				const timestamp = parseInt(filename.split("-")[0]);

				expect(timestamp).toBeGreaterThanOrEqual(before);
				expect(timestamp).toBeLessThanOrEqual(after);
			});
		});
	});

	describe("getThemeOutputPath", () => {
		it("should return theme output directory", () => {
			const path = getThemeOutputPath("my-theme");
			expect(path).toContain("my-theme");
		});

		it("should create directory", () => {
			const path = getThemeOutputPath("created-theme");
			expect(existsSync(path)).toBe(true);
		});
	});

	describe("getTemplateOutputPath", () => {
		it("should return template output directory within theme", () => {
			const path = getTemplateOutputPath("my-theme", "my-template");
			expect(path).toContain("my-theme");
			expect(path).toContain("my-template");
		});

		it("should create directory", () => {
			const path = getTemplateOutputPath("theme-x", "template-y");
			expect(existsSync(path)).toBe(true);
		});
	});
});
