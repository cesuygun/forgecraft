// ABOUTME: Theme CRUD operations
// ABOUTME: Load/save themes as JSON files in ~/.forgecraft/themes/

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from "fs";
import { join } from "path";
import { getDataPath } from "../db/database";
import type { Theme, CreateThemeInput, UpdateThemeInput } from "../../shared/types";
import { VALIDATION } from "../../shared/types";

const getThemesPath = (): string => {
	const themesPath = join(getDataPath(), "themes");
	if (!existsSync(themesPath)) {
		mkdirSync(themesPath, { recursive: true });
	}
	return themesPath;
};

const getThemeFilePath = (id: string): string => {
	return join(getThemesPath(), `${id}.json`);
};

// Validation helpers
const validateId = (id: string): string | null => {
	const v = VALIDATION.theme.id;
	if (id.length < v.minLength || id.length > v.maxLength) {
		return `ID must be between ${v.minLength} and ${v.maxLength} characters`;
	}
	if (!v.pattern.test(id)) {
		return "ID must contain only lowercase letters, numbers, and hyphens";
	}
	return null;
};

const validateTheme = (theme: Partial<Theme>): string | null => {
	const v = VALIDATION.theme;

	if (!theme.id) return "ID is required";
	const idError = validateId(theme.id);
	if (idError) return idError;

	if (!theme.name || theme.name.length < v.name.minLength || theme.name.length > v.name.maxLength) {
		return `Name must be between ${v.name.minLength} and ${v.name.maxLength} characters`;
	}

	if (
		!theme.stylePrompt ||
		theme.stylePrompt.length < v.stylePrompt.minLength ||
		theme.stylePrompt.length > v.stylePrompt.maxLength
	) {
		return `Style prompt must be between ${v.stylePrompt.minLength} and ${v.stylePrompt.maxLength} characters`;
	}

	if (
		theme.negativePrompt &&
		theme.negativePrompt.length > v.negativePrompt.maxLength
	) {
		return `Negative prompt must be at most ${v.negativePrompt.maxLength} characters`;
	}

	if (!theme.defaults) return "Defaults are required";

	const { steps, cfgScale, width, height } = theme.defaults;

	if (steps < v.steps.min || steps > v.steps.max) {
		return `Steps must be between ${v.steps.min} and ${v.steps.max}`;
	}

	if (cfgScale < v.cfgScale.min || cfgScale > v.cfgScale.max) {
		return `CFG scale must be between ${v.cfgScale.min} and ${v.cfgScale.max}`;
	}

	if (
		width < v.dimensions.min ||
		width > v.dimensions.max ||
		width % v.dimensions.divisibleBy !== 0
	) {
		return `Width must be between ${v.dimensions.min} and ${v.dimensions.max}, divisible by ${v.dimensions.divisibleBy}`;
	}

	if (
		height < v.dimensions.min ||
		height > v.dimensions.max ||
		height % v.dimensions.divisibleBy !== 0
	) {
		return `Height must be between ${v.dimensions.min} and ${v.dimensions.max}, divisible by ${v.dimensions.divisibleBy}`;
	}

	return null;
};

export const listThemes = (): Theme[] => {
	const themesPath = getThemesPath();
	const files = readdirSync(themesPath).filter((f) => f.endsWith(".json"));

	const themes: Theme[] = [];
	for (const file of files) {
		try {
			const content = readFileSync(join(themesPath, file), "utf-8");
			const theme = JSON.parse(content) as Theme;
			themes.push(theme);
		} catch (error) {
			console.error(`[Themes] Failed to load ${file}:`, error);
		}
	}

	return themes.sort((a, b) => a.name.localeCompare(b.name));
};

export const getTheme = (id: string): Theme | null => {
	const filePath = getThemeFilePath(id);
	if (!existsSync(filePath)) {
		return null;
	}

	try {
		const content = readFileSync(filePath, "utf-8");
		return JSON.parse(content) as Theme;
	} catch (error) {
		console.error(`[Themes] Failed to load theme ${id}:`, error);
		return null;
	}
};

export const themeExists = (id: string): boolean => {
	return existsSync(getThemeFilePath(id));
};

export const createTheme = (input: CreateThemeInput): Theme => {
	// Check if theme already exists
	if (themeExists(input.id)) {
		throw new Error(`Theme with ID "${input.id}" already exists`);
	}

	const now = new Date().toISOString();
	const theme: Theme = {
		id: input.id,
		name: input.name,
		stylePrompt: input.stylePrompt,
		negativePrompt: input.negativePrompt ?? "",
		defaults: input.defaults,
		createdAt: now,
		updatedAt: now,
	};

	// Validate
	const error = validateTheme(theme);
	if (error) {
		throw new Error(error);
	}

	// Save
	const filePath = getThemeFilePath(theme.id);
	writeFileSync(filePath, JSON.stringify(theme, null, 2), "utf-8");

	console.log(`[Themes] Created theme: ${theme.id}`);
	return theme;
};

export const updateTheme = (id: string, input: UpdateThemeInput): Theme => {
	const existing = getTheme(id);
	if (!existing) {
		throw new Error(`Theme "${id}" not found`);
	}

	const updated: Theme = {
		...existing,
		name: input.name ?? existing.name,
		stylePrompt: input.stylePrompt ?? existing.stylePrompt,
		negativePrompt: input.negativePrompt ?? existing.negativePrompt,
		defaults: {
			...existing.defaults,
			...input.defaults,
		},
		updatedAt: new Date().toISOString(),
	};

	// Validate
	const error = validateTheme(updated);
	if (error) {
		throw new Error(error);
	}

	// Save
	const filePath = getThemeFilePath(id);
	writeFileSync(filePath, JSON.stringify(updated, null, 2), "utf-8");

	console.log(`[Themes] Updated theme: ${id}`);
	return updated;
};

export const deleteTheme = (id: string): boolean => {
	const filePath = getThemeFilePath(id);
	if (!existsSync(filePath)) {
		return false;
	}

	unlinkSync(filePath);
	console.log(`[Themes] Deleted theme: ${id}`);
	return true;
};
