// ABOUTME: V1 data types for Forgecraft
// ABOUTME: Theme-based, template-driven generation system

// ============================================================================
// THEMES
// Define visual style. Stored as JSON files in ~/.forgecraft/themes/
// ============================================================================

export interface Theme {
	id: string;
	name: string;
	stylePrompt: string;
	negativePrompt: string;
	defaults: ThemeDefaults;
	createdAt: string; // ISO timestamp
	updatedAt: string;
}

export interface ThemeDefaults {
	model: string;
	steps: number;
	cfgScale: number;
	width: number;
	height: number;
}

// ============================================================================
// TEMPLATES
// Define generation structure with variable axes. Stored as JSON files.
// ============================================================================

export interface Template {
	id: string;
	name: string;
	variables: TemplateVariable[];
	promptPattern: string; // "{race} {job}, {rarity} quality, idle pose"
	createdAt: string;
	updatedAt: string;
}

export interface TemplateVariable {
	name: string; // "race"
	options: VariableOption[];
}

export interface VariableOption {
	id: string; // "orc"
	label: string; // "Orc"
	promptFragment: string; // "orc, green skin, tusks, muscular"
}

// ============================================================================
// GENERATION REQUESTS
// What goes into the queue
// ============================================================================

export interface GenerationRequest {
	id: string;

	// Source tracking (nullable - for raw prompts these are null)
	themeId: string | null;
	templateId: string | null;
	templateValues: Record<string, string> | null; // {race: "orc", job: "warrior_t1"}

	// Final resolved values (computed from theme + template + overrides)
	prompt: string;
	negativePrompt: string;
	model: string;
	width: number;
	height: number;
	steps: number;
	cfgScale: number;
	seed: number | null; // null = random, captured after generation

	// Output
	outputPath: string;
}

// ============================================================================
// QUEUE ITEMS
// Queue table records with status
// ============================================================================

export type QueueStatus = "pending" | "generating" | "complete" | "failed";

export interface QueueItem {
	id: string;
	status: QueueStatus;
	request: GenerationRequest;
	createdAt: number; // Unix timestamp
	startedAt: number | null;
	completedAt: number | null;
	error: string | null;
	resultSeed: number | null;
}

// ============================================================================
// GENERATION HISTORY
// Completed generations stored in SQLite
// ============================================================================

export interface GenerationRecord {
	id: string;
	themeId: string | null;
	templateId: string | null;
	templateValues: Record<string, string> | null;
	prompt: string;
	negativePrompt: string | null;
	seed: number;
	outputPath: string;
	model: string;
	width: number;
	height: number;
	steps: number;
	cfgScale: number;
	generationTimeMs: number | null;
	createdAt: number; // Unix timestamp
}

// ============================================================================
// IPC MESSAGE TYPES
// For communication between main and renderer
// ============================================================================

export interface QueueStatusMessage {
	pending: number;
	generating: string | null; // Request ID or null
	completed: number;
	failed: number;
}

export interface GenerationProgressMessage {
	requestId: string;
	percent: number;
	step: number;
	totalSteps: number;
}

export interface GenerationCompleteMessage {
	requestId: string;
	outputPath: string;
	seed: number;
}

export interface GenerationFailedMessage {
	requestId: string;
	error: string;
}

export interface QueueDiskFullMessage {
	requestId: string;
}

// ============================================================================
// VALIDATION
// Validation constraints from design doc
// ============================================================================

export const VALIDATION = {
	theme: {
		id: { minLength: 1, maxLength: 64, pattern: /^[a-z0-9-]+$/ },
		name: { minLength: 1, maxLength: 100 },
		stylePrompt: { minLength: 1, maxLength: 2000 },
		negativePrompt: { minLength: 0, maxLength: 2000 },
		steps: { min: 1, max: 150 },
		cfgScale: { min: 1.0, max: 30.0 },
		dimensions: { min: 64, max: 2048, divisibleBy: 8 },
	},
	template: {
		id: { minLength: 1, maxLength: 64, pattern: /^[a-z0-9-]+$/ },
		name: { minLength: 1, maxLength: 100 },
		promptPattern: { minLength: 1, maxLength: 2000 },
		maxVariables: 10,
		variableName: { minLength: 1, maxLength: 32, pattern: /^[a-z0-9_]+$/ },
		maxOptions: 100,
		optionId: { minLength: 1, maxLength: 32, pattern: /^[a-z0-9_]+$/ },
		optionLabel: { minLength: 1, maxLength: 50 },
		promptFragment: { minLength: 1, maxLength: 500 },
	},
} as const;

// ============================================================================
// APP SETTINGS
// User-configurable defaults stored in settings.json
// ============================================================================

export interface AppSettings {
	defaultModel: string;
	defaultSteps: number;
	defaultCfgScale: number;
	defaultWidth: number;
	defaultHeight: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
	defaultModel: "dreamshaper-xl",
	defaultSteps: 20,
	defaultCfgScale: 7,
	defaultWidth: 512,
	defaultHeight: 512,
};

// ============================================================================
// CRUD INPUT TYPES
// Shared input types for create/update operations
// ============================================================================

export interface CreateThemeInput {
	id: string;
	name: string;
	stylePrompt: string;
	negativePrompt?: string;
	defaults: ThemeDefaults;
}

export interface UpdateThemeInput {
	name?: string;
	stylePrompt?: string;
	negativePrompt?: string;
	defaults?: Partial<ThemeDefaults>;
}

export interface CreateTemplateInput {
	id: string;
	name: string;
	variables: TemplateVariable[];
	promptPattern: string;
}

export interface UpdateTemplateInput {
	name?: string;
	variables?: TemplateVariable[];
	promptPattern?: string;
}
