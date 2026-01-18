// ABOUTME: Data module exports
// ABOUTME: Re-exports all JSON-based data operations

export {
	listThemes,
	getTheme,
	themeExists,
	createTheme,
	updateTheme,
	deleteTheme,
} from "./themes";

export {
	listTemplates,
	getTemplate,
	templateExists,
	createTemplate,
	updateTemplate,
	deleteTemplate,
	interpolatePattern,
	generateCombinations,
} from "./templates";

// Re-export input types from shared
export type {
	CreateThemeInput,
	UpdateThemeInput,
	CreateTemplateInput,
	UpdateTemplateInput,
} from "../../shared/types";

export {
	buildOutputPath,
	getThemeOutputPath,
	getTemplateOutputPath,
	getOutputPath,
} from "./output";

export { getSettings, saveSettings, resetSettings } from "./settings";
