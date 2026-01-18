// ABOUTME: Core data types for Forgecraft
// ABOUTME: Defines themes, assets, and generation workflows

// ============================================================================
// THEME SYSTEM
// A theme defines a consistent visual style that can be applied to assets
// ============================================================================

export interface Theme {
	id: string;
	name: string;
	description: string;
	createdAt: Date;
	updatedAt: Date;

	// Visual style configuration
	style: ThemeStyle;

	// Reference images used to define this theme
	referenceImages: string[];

	// Trained LoRA for this theme (if any)
	loraPath?: string;
	loraTrainingStatus?: "pending" | "training" | "complete" | "failed";

	// Generation defaults for this theme
	defaults: GenerationDefaults;
}

export interface ThemeStyle {
	// Style descriptors used in prompts
	stylePrompt: string;
	negativePrompt: string;

	// Color palette (hex colors)
	primaryColors: string[];
	accentColors: string[];

	// Style tags for the AI
	tags: string[];

	// Art style category
	category:
		| "pixel-art"
		| "hand-drawn"
		| "painterly"
		| "vector"
		| "realistic"
		| "custom";
}

export interface GenerationDefaults {
	model: string;
	width: number;
	height: number;
	steps: number;
	cfgScale: number;
	lora?: string;
	loraWeight?: number;
}

// ============================================================================
// ASSET TYPES
// Different categories of game assets with specific generation behaviors
// ============================================================================

export type AssetCategory = "character" | "ui" | "item" | "environment" | "effect";

export interface Asset {
	id: string;
	name: string;
	category: AssetCategory;
	themeId: string;
	createdAt: Date;
	updatedAt: Date;

	// The source/master generation settings
	masterPrompt: string;
	masterSeed?: number;

	// Generated variants of this asset
	variants: AssetVariant[];

	// Asset-specific metadata
	metadata: AssetMetadata;
}

export interface AssetVariant {
	id: string;
	name: string;
	prompt: string;
	imagePath: string;
	seed: number;
	createdAt: Date;

	// What makes this variant different
	variantType: VariantType;
	variantData?: Record<string, unknown>;
}

export type VariantType =
	| "pose" // Different character pose
	| "state" // Different state (health bar 25%, 50%, etc.)
	| "animation-frame" // Frame in an animation sequence
	| "color-variant" // Same shape, different colors
	| "size-variant" // Same asset at different sizes
	| "angle" // Different viewing angle
	| "expression" // Different facial expression
	| "equipment"; // Same character with different equipment

// ============================================================================
// CHARACTER-SPECIFIC TYPES
// ============================================================================

export interface CharacterAsset extends Asset {
	category: "character";
	metadata: CharacterMetadata;
}

export interface CharacterMetadata extends AssetMetadata {
	// Character definition for consistency
	characterDescription: string;

	// Reference poses for ControlNet
	poseReferences?: PoseReference[];

	// Animation sequences
	animations?: AnimationSequence[];
}

export interface PoseReference {
	name: string;
	imagePath: string;
	controlNetType: "openpose" | "depth" | "lineart";
}

export interface AnimationSequence {
	name: string; // "idle", "walk", "attack", "death"
	frames: string[]; // Variant IDs
	fps: number;
}

// ============================================================================
// UI-SPECIFIC TYPES
// ============================================================================

export interface UIAsset extends Asset {
	category: "ui";
	metadata: UIMetadata;
}

export interface UIMetadata extends AssetMetadata {
	// UI element type
	uiType:
		| "health-bar"
		| "mana-bar"
		| "button"
		| "panel"
		| "icon"
		| "frame"
		| "progress-bar"
		| "slot"
		| "tooltip";

	// For stateful elements (health bars, progress bars)
	states?: UIState[];

	// For sliceable elements (9-slice panels)
	sliceGuides?: SliceGuides;
}

export interface UIState {
	name: string; // "empty", "25%", "50%", "75%", "full"
	value: number; // 0, 25, 50, 75, 100
	variantId: string;
}

export interface SliceGuides {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

// ============================================================================
// ITEM-SPECIFIC TYPES
// ============================================================================

export interface ItemAsset extends Asset {
	category: "item";
	metadata: ItemMetadata;
}

export interface ItemMetadata extends AssetMetadata {
	itemType: "weapon" | "armor" | "consumable" | "material" | "quest" | "misc";
	rarity?: "common" | "uncommon" | "rare" | "epic" | "legendary";
}

// ============================================================================
// BASE METADATA
// ============================================================================

export interface AssetMetadata {
	// Dimensions
	width: number;
	height: number;

	// Export settings
	transparent: boolean;
	format: "png" | "webp";

	// Tags for organization
	tags: string[];

	// Notes
	notes?: string;
}

// ============================================================================
// GENERATION REQUESTS
// ============================================================================

export interface GenerationRequest {
	id: string;
	status: "pending" | "generating" | "complete" | "failed";

	// What we're generating
	themeId: string;
	assetId?: string; // If generating a variant of existing asset
	category: AssetCategory;

	// Generation parameters
	prompt: string;
	negativePrompt?: string;
	model: string;
	width: number;
	height: number;
	steps: number;
	cfgScale: number;
	seed?: number;

	// LoRA
	lora?: string;
	loraWeight?: number;

	// ControlNet
	controlNet?: string;
	controlImage?: string;
	controlStrength?: number;

	// Batch generation
	batchSize: number;
	batchIndex: number;

	// Timestamps
	createdAt: Date;
	startedAt?: Date;
	completedAt?: Date;

	// Results
	outputPath?: string;
	error?: string;
	generationTime?: number;
}

// ============================================================================
// PROJECT STRUCTURE
// ============================================================================

export interface ForgeProject {
	id: string;
	name: string;
	description: string;
	createdAt: Date;
	updatedAt: Date;

	// Project paths
	projectPath: string;
	outputPath: string;

	// Active theme
	activeThemeId?: string;

	// All themes in this project
	themes: Theme[];

	// All assets in this project
	assets: Asset[];

	// Generation queue
	queue: GenerationRequest[];
}
