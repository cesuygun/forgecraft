// ABOUTME: SD model catalog for Forgecraft - focused on game art styles
// ABOUTME: Defines available models, LoRAs, and ControlNets for sprite generation

import * as fs from "node:fs";
import { createWriteStream } from "node:fs";
import * as fsp from "node:fs/promises";
import { homedir } from "node:os";
import * as path from "node:path";

export interface SdModel {
	id: string;
	name: string;
	type: "sd15" | "sdxl" | "flux";
	size: number;
	url: string;
	recommended?: boolean;
	description?: string;
	tags?: string[];
}

export interface LoraModel {
	id: string;
	name: string;
	baseModel: "sd15" | "sdxl" | "flux";
	size: number;
	url: string;
	description?: string;
	tags?: string[];
}

export interface ControlNetModel {
	id: string;
	name: string;
	baseModel: "sd15" | "sdxl";
	size: number;
	url: string;
	controlType: "pose" | "depth" | "canny" | "lineart" | "scribble";
	description?: string;
}

// Base models - focusing on game art styles
export const SD_MODELS: SdModel[] = [
	{
		id: "pixel-art-xl",
		name: "Pixel Art XL",
		type: "sdxl",
		size: 6_500_000_000,
		url: "https://civitai.com/api/download/models/290640", // Pixel Art XL
		recommended: true,
		description: "Best for pixel art and retro game sprites",
		tags: ["pixel-art", "retro", "sprites"],
	},
	{
		id: "dreamshaper-xl",
		name: "DreamShaper XL",
		type: "sdxl",
		size: 6_500_000_000,
		url: "https://huggingface.co/Lykon/dreamshaper-xl-v2-turbo/resolve/main/DreamShaperXL_Turbo_v2_1.safetensors",
		recommended: true,
		description: "Great for painterly/illustrated game art",
		tags: ["illustrated", "painterly", "fantasy"],
	},
	{
		id: "sdxl-base",
		name: "SDXL Base 1.0",
		type: "sdxl",
		size: 6_800_000_000,
		url: "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors",
		description: "Standard SDXL - good baseline for any style",
		tags: ["general"],
	},
];

// LoRAs for specific game art styles
export const LORA_MODELS: LoraModel[] = [
	{
		id: "game-icon-style",
		name: "Game Icon Style",
		baseModel: "sdxl",
		size: 150_000_000,
		url: "https://civitai.com/api/download/models/177164",
		description: "Perfect for game icons, items, abilities",
		tags: ["icons", "items", "ui"],
	},
	{
		id: "pixel-sprite",
		name: "Pixel Sprite LoRA",
		baseModel: "sdxl",
		size: 120_000_000,
		url: "https://civitai.com/api/download/models/151105",
		description: "Character sprites in pixel art style",
		tags: ["pixel-art", "characters", "sprites"],
	},
];

// ControlNets for pose and structure control
export const CONTROLNET_MODELS: ControlNetModel[] = [
	{
		id: "openpose-sdxl",
		name: "OpenPose SDXL",
		baseModel: "sdxl",
		size: 2_500_000_000,
		url: "https://huggingface.co/thibaud/controlnet-openpose-sdxl-1.0/resolve/main/OpenPoseXL2.safetensors",
		controlType: "pose",
		description: "Control character poses precisely",
	},
	{
		id: "lineart-sdxl",
		name: "LineArt SDXL",
		baseModel: "sdxl",
		size: 2_500_000_000,
		url: "https://huggingface.co/diffusers/controlnet-lineart-sdxl/resolve/main/diffusion_pytorch_model.safetensors",
		controlType: "lineart",
		description: "Generate from line drawings",
	},
];

const FORGECRAFT_DIR = path.join(homedir(), ".forgecraft");

export const getModelsDir = (): string => path.join(FORGECRAFT_DIR, "models");

export const getModelPath = (filename: string): string =>
	path.join(getModelsDir(), filename);

/**
 * Resolve a model ID or filename to its full filesystem path.
 * Accepts either:
 * - Model ID (e.g., "dreamshaper-xl") - looks up in catalog
 * - Filename (e.g., "dreamshaper-xl.safetensors") - uses directly
 * - Full path (e.g., "/path/to/model.safetensors") - returns as-is
 */
export const resolveModelPath = (modelIdOrPath: string): string => {
	// If it's already an absolute path, return it
	if (path.isAbsolute(modelIdOrPath)) {
		return modelIdOrPath;
	}

	// If it has an extension, treat as filename
	if (modelIdOrPath.includes(".")) {
		return getModelPath(modelIdOrPath);
	}

	// Otherwise, look up as model ID
	const model = SD_MODELS.find((m) => m.id === modelIdOrPath);
	if (model) {
		return getModelPath(`${modelIdOrPath}.safetensors`);
	}

	// Check LoRAs
	const lora = LORA_MODELS.find((l) => l.id === modelIdOrPath);
	if (lora) {
		return getLoraPath(`${modelIdOrPath}.safetensors`);
	}

	// Check ControlNets
	const cn = CONTROLNET_MODELS.find((c) => c.id === modelIdOrPath);
	if (cn) {
		return getControlNetPath(`${modelIdOrPath}.safetensors`);
	}

	// Fallback: assume it's a filename without extension
	return getModelPath(`${modelIdOrPath}.safetensors`);
};

export const getLorasDir = (): string => path.join(getModelsDir(), "loras");

export const getLoraPath = (filename: string): string =>
	path.join(getLorasDir(), filename);

export const getControlNetDir = (): string =>
	path.join(getModelsDir(), "controlnet");

export const getControlNetPath = (filename: string): string =>
	path.join(getControlNetDir(), filename);

// Custom themes (user-trained LoRAs)
export const getThemesDir = (): string => path.join(FORGECRAFT_DIR, "themes");

export const getThemePath = (themeId: string): string =>
	path.join(getThemesDir(), themeId);

export const getModelFilename = (modelId: string): string => {
	const model = SD_MODELS.find((m) => m.id === modelId);
	if (!model) {
		throw new Error(`Unknown model: ${modelId}`);
	}
	// Use model ID as filename for consistency
	return `${modelId}.safetensors`;
};

export const isModelInstalled = (modelId: string): boolean => {
	try {
		const filename = getModelFilename(modelId);
		return fs.existsSync(getModelPath(filename));
	} catch {
		return false;
	}
};

export const getInstalledModels = (): SdModel[] =>
	SD_MODELS.filter((model) => isModelInstalled(model.id));

export const isLoraInstalled = (loraId: string): boolean => {
	const lora = LORA_MODELS.find((l) => l.id === loraId);
	if (!lora) return false;
	return fs.existsSync(getLoraPath(`${loraId}.safetensors`));
};

export const isControlNetInstalled = (controlNetId: string): boolean => {
	const cn = CONTROLNET_MODELS.find((c) => c.id === controlNetId);
	if (!cn) return false;
	return fs.existsSync(getControlNetPath(`${controlNetId}.safetensors`));
};

export interface DownloadProgress {
	modelId: string;
	percent: number;
	downloadedBytes: number;
	totalBytes: number;
}

export type DownloadProgressCallback = (progress: DownloadProgress) => void;

export const downloadModel = async (
	modelId: string,
	onProgress?: DownloadProgressCallback,
): Promise<string> => {
	const model = SD_MODELS.find((m) => m.id === modelId);
	if (!model) {
		throw new Error(`Unknown model: ${modelId}`);
	}

	const modelsDir = getModelsDir();
	if (!fs.existsSync(modelsDir)) {
		await fsp.mkdir(modelsDir, { recursive: true });
	}

	const filename = `${modelId}.safetensors`;
	const outputPath = getModelPath(filename);

	const response = await fetch(model.url);
	if (!response.ok) {
		throw new Error(`Failed to download model: ${response.statusText}`);
	}

	const contentLength = response.headers.get("content-length");
	const totalBytes = contentLength ? parseInt(contentLength, 10) : model.size;

	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error("Failed to get response reader");
	}

	const fileStream = createWriteStream(outputPath);
	let downloadedBytes = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		fileStream.write(value);
		downloadedBytes += value.length;

		onProgress?.({
			modelId,
			percent: Math.round((downloadedBytes / totalBytes) * 100),
			downloadedBytes,
			totalBytes,
		});
	}

	await new Promise<void>((resolve, reject) => {
		fileStream.on("finish", resolve);
		fileStream.on("error", reject);
		fileStream.end();
	});

	onProgress?.({
		modelId,
		percent: 100,
		downloadedBytes: totalBytes,
		totalBytes,
	});

	return outputPath;
};

export const downloadLora = async (
	loraId: string,
	onProgress?: DownloadProgressCallback,
): Promise<string> => {
	const lora = LORA_MODELS.find((l) => l.id === loraId);
	if (!lora) {
		throw new Error(`Unknown LoRA: ${loraId}`);
	}

	const lorasDir = getLorasDir();
	if (!fs.existsSync(lorasDir)) {
		await fsp.mkdir(lorasDir, { recursive: true });
	}

	const filename = `${loraId}.safetensors`;
	const outputPath = getLoraPath(filename);

	const response = await fetch(lora.url);
	if (!response.ok) {
		throw new Error(`Failed to download LoRA: ${response.statusText}`);
	}

	const contentLength = response.headers.get("content-length");
	const totalBytes = contentLength ? parseInt(contentLength, 10) : lora.size;

	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error("Failed to get response reader");
	}

	const fileStream = createWriteStream(outputPath);
	let downloadedBytes = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		fileStream.write(value);
		downloadedBytes += value.length;

		onProgress?.({
			modelId: loraId,
			percent: Math.round((downloadedBytes / totalBytes) * 100),
			downloadedBytes,
			totalBytes,
		});
	}

	await new Promise<void>((resolve, reject) => {
		fileStream.on("finish", resolve);
		fileStream.on("error", reject);
		fileStream.end();
	});

	return outputPath;
};

export const deleteModel = async (modelId: string): Promise<void> => {
	const filename = getModelFilename(modelId);
	const modelPath = getModelPath(filename);

	if (fs.existsSync(modelPath)) {
		await fsp.unlink(modelPath);
	}
};
