// ABOUTME: Settings load/save operations
// ABOUTME: Persists app settings as JSON in ~/.forgecraft/settings.json

import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { getDataPath } from "../db/database";
import type { AppSettings } from "../../shared/types";
import { DEFAULT_SETTINGS, VALIDATION } from "../../shared/types";

const getSettingsPath = (): string => {
	return join(getDataPath(), "settings.json");
};

const validateSettings = (settings: AppSettings): string | null => {
	const v = VALIDATION.theme;

	if (settings.defaultSteps < v.steps.min || settings.defaultSteps > v.steps.max) {
		return `Steps must be between ${v.steps.min} and ${v.steps.max}`;
	}

	if (settings.defaultCfgScale < v.cfgScale.min || settings.defaultCfgScale > v.cfgScale.max) {
		return `CFG scale must be between ${v.cfgScale.min} and ${v.cfgScale.max}`;
	}

	if (
		settings.defaultWidth < v.dimensions.min ||
		settings.defaultWidth > v.dimensions.max ||
		settings.defaultWidth % v.dimensions.divisibleBy !== 0
	) {
		return `Width must be between ${v.dimensions.min} and ${v.dimensions.max}, divisible by ${v.dimensions.divisibleBy}`;
	}

	if (
		settings.defaultHeight < v.dimensions.min ||
		settings.defaultHeight > v.dimensions.max ||
		settings.defaultHeight % v.dimensions.divisibleBy !== 0
	) {
		return `Height must be between ${v.dimensions.min} and ${v.dimensions.max}, divisible by ${v.dimensions.divisibleBy}`;
	}

	return null;
};

export const getSettings = (): AppSettings => {
	const settingsPath = getSettingsPath();

	if (!existsSync(settingsPath)) {
		return { ...DEFAULT_SETTINGS };
	}

	try {
		const content = readFileSync(settingsPath, "utf-8");
		const parsed = JSON.parse(content) as Partial<AppSettings>;

		// Merge with defaults to ensure all fields exist
		return {
			...DEFAULT_SETTINGS,
			...parsed,
		};
	} catch (error) {
		console.error("[Settings] Failed to load settings:", error);
		return { ...DEFAULT_SETTINGS };
	}
};

export const saveSettings = (settings: AppSettings): void => {
	const error = validateSettings(settings);
	if (error) {
		throw new Error(error);
	}

	const settingsPath = getSettingsPath();
	writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
	console.log("[Settings] Saved settings");
};

export const resetSettings = (): void => {
	const settingsPath = getSettingsPath();
	if (existsSync(settingsPath)) {
		unlinkSync(settingsPath);
	}
	console.log("[Settings] Reset to defaults");
};
