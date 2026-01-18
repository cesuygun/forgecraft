// ABOUTME: Tests for template CRUD operations
// ABOUTME: Verifies JSON file operations, validation, interpolation, and combinations

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import "./test-helpers";
import { cleanupTempDir, resetTempDir } from "./test-helpers";
import {
	listTemplates,
	getTemplate,
	templateExists,
	createTemplate,
	updateTemplate,
	deleteTemplate,
	interpolatePattern,
	generateCombinations,
} from "../templates";
import type { CreateTemplateInput } from "../../../shared/types";

const validTemplateInput: CreateTemplateInput = {
	id: "test-template",
	name: "Test Template",
	variables: [
		{
			name: "race",
			options: [
				{ id: "human", label: "Human", promptFragment: "human, normal skin" },
				{ id: "orc", label: "Orc", promptFragment: "orc, green skin, tusks" },
			],
		},
		{
			name: "job",
			options: [
				{ id: "warrior", label: "Warrior", promptFragment: "warrior, heavy armor, sword" },
				{ id: "mage", label: "Mage", promptFragment: "mage, robes, staff" },
			],
		},
	],
	promptPattern: "{race} {job}, fantasy character",
};

describe("Template CRUD Operations", () => {
	beforeEach(() => {
		resetTempDir();
	});

	afterAll(() => {
		cleanupTempDir();
	});

	describe("createTemplate", () => {
		it("should create template with valid input", () => {
			const template = createTemplate(validTemplateInput);

			expect(template.id).toBe("test-template");
			expect(template.name).toBe("Test Template");
			expect(template.variables).toHaveLength(2);
			expect(template.promptPattern).toBe("{race} {job}, fantasy character");
			expect(template.createdAt).toBeDefined();
		});

		it("should throw for duplicate ID", () => {
			createTemplate(validTemplateInput);

			expect(() => createTemplate(validTemplateInput)).toThrow('already exists');
		});

		it("should throw for invalid ID format", () => {
			expect(() =>
				createTemplate({ ...validTemplateInput, id: "Invalid ID!" }),
			).toThrow("lowercase letters, numbers, and hyphens");
		});

		it("should throw for empty name", () => {
			expect(() =>
				createTemplate({ ...validTemplateInput, id: "empty-name", name: "" }),
			).toThrow("Name must be between");
		});

		it("should throw for pattern without variables", () => {
			expect(() =>
				createTemplate({
					...validTemplateInput,
					id: "no-vars",
					promptPattern: "just a plain string",
				}),
			).toThrow("at least one {variable}");
		});

		it("should throw for empty variables array", () => {
			expect(() =>
				createTemplate({
					...validTemplateInput,
					id: "no-vars",
					variables: [],
				}),
			).toThrow("At least one variable is required");
		});

		it("should throw for too many variables", () => {
			const manyVars = Array.from({ length: 15 }, (_, i) => ({
				name: `var${i}`,
				options: [{ id: "opt", label: "Option", promptFragment: "fragment" }],
			}));

			expect(() =>
				createTemplate({
					...validTemplateInput,
					id: "many-vars",
					variables: manyVars,
					promptPattern: manyVars.map((v) => `{${v.name}}`).join(" "),
				}),
			).toThrow("Maximum 10 variables");
		});

		it("should throw for duplicate variable names", () => {
			expect(() =>
				createTemplate({
					...validTemplateInput,
					id: "dup-vars",
					variables: [
						{
							name: "race",
							options: [{ id: "a", label: "A", promptFragment: "a" }],
						},
						{
							name: "race",
							options: [{ id: "b", label: "B", promptFragment: "b" }],
						},
					],
					promptPattern: "{race}",
				}),
			).toThrow("Duplicate variable name");
		});

		it("should throw for variable with no options", () => {
			expect(() =>
				createTemplate({
					...validTemplateInput,
					id: "no-opts",
					variables: [{ name: "race", options: [] }],
					promptPattern: "{race}",
				}),
			).toThrow("must have at least one option");
		});

		it("should throw for duplicate option IDs", () => {
			expect(() =>
				createTemplate({
					...validTemplateInput,
					id: "dup-opts",
					variables: [
						{
							name: "race",
							options: [
								{ id: "same", label: "A", promptFragment: "a" },
								{ id: "same", label: "B", promptFragment: "b" },
							],
						},
					],
					promptPattern: "{race}",
				}),
			).toThrow("Duplicate option ID");
		});

		it("should throw for missing option label", () => {
			expect(() =>
				createTemplate({
					...validTemplateInput,
					id: "no-label",
					variables: [
						{
							name: "race",
							options: [{ id: "a", label: "", promptFragment: "fragment" }],
						},
					],
					promptPattern: "{race}",
				}),
			).toThrow("label must be between");
		});

		it("should throw for empty promptFragment", () => {
			expect(() =>
				createTemplate({
					...validTemplateInput,
					id: "no-frag",
					variables: [
						{
							name: "race",
							options: [{ id: "a", label: "A", promptFragment: "" }],
						},
					],
					promptPattern: "{race}",
				}),
			).toThrow("prompt fragment must be between");
		});

		it("should throw for pattern variable without definition", () => {
			expect(() =>
				createTemplate({
					...validTemplateInput,
					id: "missing-def",
					promptPattern: "{race} {undefined_var}",
				}),
			).toThrow('"{undefined_var}" has no corresponding variable definition');
		});
	});

	describe("getTemplate", () => {
		it("should return null for non-existent template", () => {
			const template = getTemplate("non-existent");
			expect(template).toBeNull();
		});

		it("should return template with all fields", () => {
			createTemplate(validTemplateInput);

			const template = getTemplate("test-template");
			expect(template).not.toBeNull();
			expect(template?.variables).toHaveLength(2);
		});
	});

	describe("templateExists", () => {
		it("should return false for non-existent template", () => {
			expect(templateExists("non-existent")).toBe(false);
		});

		it("should return true for existing template", () => {
			createTemplate(validTemplateInput);
			expect(templateExists("test-template")).toBe(true);
		});
	});

	describe("listTemplates", () => {
		it("should return empty array when no templates", () => {
			const templates = listTemplates();
			expect(templates).toEqual([]);
		});

		it("should return all templates sorted by name", () => {
			createTemplate({ ...validTemplateInput, id: "z-tpl", name: "Zebra" });
			createTemplate({ ...validTemplateInput, id: "a-tpl", name: "Alpha" });

			const templates = listTemplates();
			expect(templates).toHaveLength(2);
			expect(templates[0].name).toBe("Alpha");
		});
	});

	describe("updateTemplate", () => {
		it("should update name", () => {
			createTemplate(validTemplateInput);

			const updated = updateTemplate("test-template", { name: "New Name" });
			expect(updated.name).toBe("New Name");
		});

		it("should update variables", () => {
			createTemplate(validTemplateInput);

			const updated = updateTemplate("test-template", {
				variables: [
					{
						name: "race",
						options: [{ id: "elf", label: "Elf", promptFragment: "elf, pointed ears" }],
					},
				],
				promptPattern: "{race}",
			});
			expect(updated.variables).toHaveLength(1);
			expect(updated.variables[0].options[0].id).toBe("elf");
		});

		it("should throw for non-existent template", () => {
			expect(() => updateTemplate("non-existent", { name: "New" })).toThrow(
				'not found',
			);
		});

		it("should validate updated values", () => {
			createTemplate(validTemplateInput);

			expect(() =>
				updateTemplate("test-template", { promptPattern: "no vars" }),
			).toThrow("at least one {variable}");
		});
	});

	describe("deleteTemplate", () => {
		it("should delete existing template", () => {
			createTemplate(validTemplateInput);

			const deleted = deleteTemplate("test-template");
			expect(deleted).toBe(true);
			expect(getTemplate("test-template")).toBeNull();
		});

		it("should return false for non-existent template", () => {
			const deleted = deleteTemplate("non-existent");
			expect(deleted).toBe(false);
		});
	});

	describe("interpolatePattern", () => {
		it("should replace variables with promptFragments", () => {
			const template = createTemplate(validTemplateInput);

			const result = interpolatePattern(template, {
				race: "orc",
				job: "warrior",
			});

			expect(result).toBe(
				"orc, green skin, tusks warrior, heavy armor, sword, fantasy character",
			);
		});

		it("should handle all variables", () => {
			const template = createTemplate(validTemplateInput);

			const result = interpolatePattern(template, {
				race: "human",
				job: "mage",
			});

			expect(result).toBe(
				"human, normal skin mage, robes, staff, fantasy character",
			);
		});

		it("should leave unmatched variables as-is with warning", () => {
			const template = createTemplate(validTemplateInput);

			// Missing 'job' value
			const result = interpolatePattern(template, { race: "orc" });
			expect(result).toContain("{job}");
		});
	});

	describe("generateCombinations", () => {
		it("should generate all combinations when all selected", () => {
			const template = createTemplate(validTemplateInput);

			const combinations = generateCombinations(template, {
				race: "all",
				job: "all",
			});

			expect(combinations).toHaveLength(4); // 2 races * 2 jobs
			expect(combinations).toContainEqual({ race: "human", job: "warrior" });
			expect(combinations).toContainEqual({ race: "human", job: "mage" });
			expect(combinations).toContainEqual({ race: "orc", job: "warrior" });
			expect(combinations).toContainEqual({ race: "orc", job: "mage" });
		});

		it("should generate partial combinations", () => {
			const template = createTemplate(validTemplateInput);

			const combinations = generateCombinations(template, {
				race: "orc",
				job: "all",
			});

			expect(combinations).toHaveLength(2); // 1 race * 2 jobs
			expect(combinations).toContainEqual({ race: "orc", job: "warrior" });
			expect(combinations).toContainEqual({ race: "orc", job: "mage" });
		});

		it("should generate single combination for specific selections", () => {
			const template = createTemplate(validTemplateInput);

			const combinations = generateCombinations(template, {
				race: "human",
				job: "mage",
			});

			expect(combinations).toHaveLength(1);
			expect(combinations[0]).toEqual({ race: "human", job: "mage" });
		});

		it("should handle template with many options", () => {
			const manyOptionsTemplate = createTemplate({
				id: "many-opts",
				name: "Many Options",
				variables: [
					{
						name: "slot",
						options: [
							{ id: "boots", label: "Boots", promptFragment: "boots" },
							{ id: "helmet", label: "Helmet", promptFragment: "helmet" },
							{ id: "chest", label: "Chest", promptFragment: "chest" },
							{ id: "weapon", label: "Weapon", promptFragment: "weapon" },
							{ id: "shield", label: "Shield", promptFragment: "shield" },
						],
					},
					{
						name: "rarity",
						options: [
							{ id: "common", label: "Common", promptFragment: "common" },
							{ id: "rare", label: "Rare", promptFragment: "rare" },
							{ id: "epic", label: "Epic", promptFragment: "epic" },
							{ id: "legendary", label: "Legendary", promptFragment: "legendary" },
						],
					},
				],
				promptPattern: "{slot} {rarity}",
			});

			const combinations = generateCombinations(manyOptionsTemplate, {
				slot: "all",
				rarity: "all",
			});

			expect(combinations).toHaveLength(20); // 5 slots * 4 rarities
		});
	});
});
