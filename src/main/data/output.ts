// ABOUTME: Output folder utilities
// ABOUTME: Manage generated image output paths

import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getDataPath } from "../db/database";

const getOutputPath = (): string => {
	const outputPath = join(getDataPath(), "output");
	if (!existsSync(outputPath)) {
		mkdirSync(outputPath, { recursive: true });
	}
	return outputPath;
};

/**
 * Build output path for a generation based on theme, template, and variable values.
 *
 * Structure:
 * - With theme + template: output/{theme}/{template}/{var1}-{var2}-{varN}/{seed}.png
 * - Theme only (raw prompt): output/{theme}/_raw/{timestamp}-{seed}.png
 * - No theme (raw prompt): output/_raw/{timestamp}-{seed}.png
 *
 * @param variableOrder - Array of variable names in the order they should appear in the path.
 *                        Required when templateValues is provided for consistent ordering.
 */
export const buildOutputPath = (options: {
	themeId: string | null;
	templateId: string | null;
	templateValues: Record<string, string> | null;
	variableOrder?: string[];
	seed: number;
	timestamp?: number;
}): string => {
	const { themeId, templateId, templateValues, variableOrder, seed, timestamp = Date.now() } =
		options;
	const outputBase = getOutputPath();

	// No theme - completely raw
	if (!themeId) {
		const rawPath = join(outputBase, "_raw");
		ensureDir(rawPath);
		return join(rawPath, `${timestamp}-${seed}.png`);
	}

	// Theme but no template - raw within theme
	if (!templateId || !templateValues) {
		const themePath = join(outputBase, themeId, "_raw");
		ensureDir(themePath);
		return join(themePath, `${timestamp}-${seed}.png`);
	}

	// Theme + template - full path with variable values in consistent order
	// Use variableOrder if provided, otherwise fall back to sorted keys for deterministic output
	const orderedKeys = variableOrder ?? Object.keys(templateValues).sort();
	const variableValues = orderedKeys.map((key) => templateValues[key]);
	const varDir = variableValues.join("-");
	const fullPath = join(outputBase, themeId, templateId, varDir);
	ensureDir(fullPath);
	return join(fullPath, `${seed}.png`);
};

/**
 * Ensure a directory exists, creating it if necessary.
 */
const ensureDir = (dirPath: string): void => {
	if (!existsSync(dirPath)) {
		mkdirSync(dirPath, { recursive: true });
	}
};

/**
 * Get the output directory for a specific theme.
 */
export const getThemeOutputPath = (themeId: string): string => {
	const themePath = join(getOutputPath(), themeId);
	ensureDir(themePath);
	return themePath;
};

/**
 * Get the output directory for a specific template within a theme.
 */
export const getTemplateOutputPath = (themeId: string, templateId: string): string => {
	const templatePath = join(getOutputPath(), themeId, templateId);
	ensureDir(templatePath);
	return templatePath;
};

/**
 * Get the base output directory.
 */
export { getOutputPath };
