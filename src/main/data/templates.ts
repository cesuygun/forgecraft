// ABOUTME: Template CRUD operations
// ABOUTME: Load/save templates as JSON files in ~/.forgecraft/templates/

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from "fs";
import { join } from "path";
import { getDataPath } from "../db/database";
import type { Template, CreateTemplateInput, UpdateTemplateInput } from "../../shared/types";
import { VALIDATION } from "../../shared/types";

const getTemplatesPath = (): string => {
	const templatesPath = join(getDataPath(), "templates");
	if (!existsSync(templatesPath)) {
		mkdirSync(templatesPath, { recursive: true });
	}
	return templatesPath;
};

const getTemplateFilePath = (id: string): string => {
	return join(getTemplatesPath(), `${id}.json`);
};

// Extract variable names from pattern
const extractVariableNames = (pattern: string): string[] => {
	const matches = pattern.match(/\{([a-z0-9_]+)\}/g) || [];
	return matches.map((m) => m.slice(1, -1));
};

// Validation helpers
const validateId = (id: string, fieldName: string, config: { minLength: number; maxLength: number; pattern: RegExp }): string | null => {
	if (id.length < config.minLength || id.length > config.maxLength) {
		return `${fieldName} must be between ${config.minLength} and ${config.maxLength} characters`;
	}
	if (!config.pattern.test(id)) {
		return `${fieldName} must contain only lowercase letters, numbers, and ${fieldName === "ID" ? "hyphens" : "underscores"}`;
	}
	return null;
};

const validateTemplate = (template: Partial<Template>): string | null => {
	const v = VALIDATION.template;

	if (!template.id) return "ID is required";
	const idError = validateId(template.id, "ID", v.id);
	if (idError) return idError;

	if (!template.name || template.name.length < v.name.minLength || template.name.length > v.name.maxLength) {
		return `Name must be between ${v.name.minLength} and ${v.name.maxLength} characters`;
	}

	if (
		!template.promptPattern ||
		template.promptPattern.length < v.promptPattern.minLength ||
		template.promptPattern.length > v.promptPattern.maxLength
	) {
		return `Prompt pattern must be between ${v.promptPattern.minLength} and ${v.promptPattern.maxLength} characters`;
	}

	// Check that pattern contains at least one variable
	const patternVars = extractVariableNames(template.promptPattern);
	if (patternVars.length === 0) {
		return "Prompt pattern must contain at least one {variable}";
	}

	if (!template.variables || template.variables.length === 0) {
		return "At least one variable is required";
	}

	if (template.variables.length > v.maxVariables) {
		return `Maximum ${v.maxVariables} variables allowed`;
	}

	// Validate each variable
	const variableNames = new Set<string>();
	for (const variable of template.variables) {
		const nameError = validateId(variable.name, "Variable name", v.variableName);
		if (nameError) return nameError;

		if (variableNames.has(variable.name)) {
			return `Duplicate variable name: ${variable.name}`;
		}
		variableNames.add(variable.name);

		if (!variable.options || variable.options.length === 0) {
			return `Variable "${variable.name}" must have at least one option`;
		}

		if (variable.options.length > v.maxOptions) {
			return `Variable "${variable.name}" has too many options (max ${v.maxOptions})`;
		}

		// Validate each option
		const optionIds = new Set<string>();
		for (const option of variable.options) {
			const optionIdError = validateId(option.id, "Option ID", v.optionId);
			if (optionIdError) return optionIdError;

			if (optionIds.has(option.id)) {
				return `Duplicate option ID in "${variable.name}": ${option.id}`;
			}
			optionIds.add(option.id);

			// Validate label
			if (
				!option.label ||
				option.label.length < v.optionLabel.minLength ||
				option.label.length > v.optionLabel.maxLength
			) {
				return `Option "${option.id}" label must be between ${v.optionLabel.minLength} and ${v.optionLabel.maxLength} characters`;
			}

			if (
				!option.promptFragment ||
				option.promptFragment.length < v.promptFragment.minLength ||
				option.promptFragment.length > v.promptFragment.maxLength
			) {
				return `Option "${option.id}" prompt fragment must be between ${v.promptFragment.minLength} and ${v.promptFragment.maxLength} characters`;
			}
		}
	}

	// Check that all pattern variables have corresponding variable definitions
	for (const varName of patternVars) {
		if (!variableNames.has(varName)) {
			return `Pattern variable "{${varName}}" has no corresponding variable definition`;
		}
	}

	return null;
};

export const listTemplates = (): Template[] => {
	const templatesPath = getTemplatesPath();
	const files = readdirSync(templatesPath).filter((f) => f.endsWith(".json"));

	const templates: Template[] = [];
	for (const file of files) {
		try {
			const content = readFileSync(join(templatesPath, file), "utf-8");
			const template = JSON.parse(content) as Template;
			templates.push(template);
		} catch (error) {
			console.error(`[Templates] Failed to load ${file}:`, error);
		}
	}

	return templates.sort((a, b) => a.name.localeCompare(b.name));
};

export const getTemplate = (id: string): Template | null => {
	const filePath = getTemplateFilePath(id);
	if (!existsSync(filePath)) {
		return null;
	}

	try {
		const content = readFileSync(filePath, "utf-8");
		return JSON.parse(content) as Template;
	} catch (error) {
		console.error(`[Templates] Failed to load template ${id}:`, error);
		return null;
	}
};

export const templateExists = (id: string): boolean => {
	return existsSync(getTemplateFilePath(id));
};

export const createTemplate = (input: CreateTemplateInput): Template => {
	// Check if template already exists
	if (templateExists(input.id)) {
		throw new Error(`Template with ID "${input.id}" already exists`);
	}

	const now = new Date().toISOString();
	const template: Template = {
		id: input.id,
		name: input.name,
		variables: input.variables,
		promptPattern: input.promptPattern,
		createdAt: now,
		updatedAt: now,
	};

	// Validate
	const error = validateTemplate(template);
	if (error) {
		throw new Error(error);
	}

	// Save
	const filePath = getTemplateFilePath(template.id);
	writeFileSync(filePath, JSON.stringify(template, null, 2), "utf-8");

	console.log(`[Templates] Created template: ${template.id}`);
	return template;
};

export const updateTemplate = (id: string, input: UpdateTemplateInput): Template => {
	const existing = getTemplate(id);
	if (!existing) {
		throw new Error(`Template "${id}" not found`);
	}

	const updated: Template = {
		...existing,
		name: input.name ?? existing.name,
		variables: input.variables ?? existing.variables,
		promptPattern: input.promptPattern ?? existing.promptPattern,
		updatedAt: new Date().toISOString(),
	};

	// Validate
	const error = validateTemplate(updated);
	if (error) {
		throw new Error(error);
	}

	// Save
	const filePath = getTemplateFilePath(id);
	writeFileSync(filePath, JSON.stringify(updated, null, 2), "utf-8");

	console.log(`[Templates] Updated template: ${id}`);
	return updated;
};

export const deleteTemplate = (id: string): boolean => {
	const filePath = getTemplateFilePath(id);
	if (!existsSync(filePath)) {
		return false;
	}

	unlinkSync(filePath);
	console.log(`[Templates] Deleted template: ${id}`);
	return true;
};

// Utility: interpolate template pattern with selected values
export const interpolatePattern = (
	template: Template,
	values: Record<string, string>,
): string => {
	let result = template.promptPattern;

	for (const variable of template.variables) {
		const selectedOptionId = values[variable.name];
		if (!selectedOptionId) {
			console.warn(`[Templates] Missing value for variable "${variable.name}"`);
			continue;
		}

		const option = variable.options.find((o) => o.id === selectedOptionId);
		if (!option) {
			console.warn(
				`[Templates] Invalid option "${selectedOptionId}" for variable "${variable.name}"`,
			);
			continue;
		}

		result = result.replace(`{${variable.name}}`, option.promptFragment);
	}

	return result;
};

// Utility: generate all combinations for "Generate All"
export const generateCombinations = (
	template: Template,
	selections: Record<string, string | "all">,
): Record<string, string>[] => {
	const combinations: Record<string, string>[] = [];

	// Build arrays of options for each variable
	const variableOptions: { name: string; options: string[] }[] = [];

	for (const variable of template.variables) {
		const selection = selections[variable.name];
		if (selection === "all") {
			variableOptions.push({
				name: variable.name,
				options: variable.options.map((o) => o.id),
			});
		} else if (selection) {
			variableOptions.push({
				name: variable.name,
				options: [selection],
			});
		}
	}

	// Generate cartesian product
	const generateCartesian = (
		index: number,
		current: Record<string, string>,
	): void => {
		if (index === variableOptions.length) {
			combinations.push({ ...current });
			return;
		}

		const { name, options } = variableOptions[index];
		for (const option of options) {
			current[name] = option;
			generateCartesian(index + 1, current);
		}
	};

	generateCartesian(0, {});
	return combinations;
};
