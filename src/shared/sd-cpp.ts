// ABOUTME: sd-cpp binary management and image generation for Forgecraft
// ABOUTME: Handles binary installation, process spawning, and progress parsing

import { exec, spawn } from "node:child_process";
import * as fs from "node:fs";
import { createWriteStream } from "node:fs";
import * as fsp from "node:fs/promises";
import { homedir } from "node:os";
import * as path from "node:path";

import { resolveModelPath } from "./sd-models";

const FORGECRAFT_DIR = path.join(homedir(), ".forgecraft");
const SD_CPP_DIR = path.join(FORGECRAFT_DIR, "services", "sd-cpp");
const SD_CPP_BIN = path.join(SD_CPP_DIR, "bin", "sd");

// GitHub release URL for precompiled sd-cpp binary (reusing Vespyr's build)
export const SD_CPP_DOWNLOAD_URL =
	"https://github.com/cesuygun/vespyr/releases/download/sd-cpp-v1/sd-darwin-arm64.tar.gz";
export const SD_CPP_BINARY_SIZE = 52_000_000;

export const getForgeDir = (): string => FORGECRAFT_DIR;

export const getSdCppBinaryPath = (): string => SD_CPP_BIN;

export const getSdCppDir = (): string => SD_CPP_DIR;

export const isSdCppInstalled = (): boolean => fs.existsSync(SD_CPP_BIN);

export interface InstallProgress {
	stage: "downloading" | "extracting" | "complete";
	percent: number;
	downloadedBytes?: number;
	totalBytes?: number;
}

export type InstallProgressCallback = (progress: InstallProgress) => void;

export const installSdCpp = async (
	onProgress?: InstallProgressCallback,
): Promise<void> => {
	const binDir = path.join(SD_CPP_DIR, "bin");

	// Create directories
	if (!fs.existsSync(binDir)) {
		await fsp.mkdir(binDir, { recursive: true });
	}

	// Download tarball
	onProgress?.({ stage: "downloading", percent: 0 });

	const response = await fetch(SD_CPP_DOWNLOAD_URL);
	if (!response.ok) {
		throw new Error(`Failed to download sd-cpp: ${response.statusText}`);
	}

	const contentLength = response.headers.get("content-length");
	const totalBytes = contentLength
		? parseInt(contentLength, 10)
		: SD_CPP_BINARY_SIZE;

	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error("Failed to get response reader");
	}

	// Stream to temp file
	const tarPath = path.join(SD_CPP_DIR, "sd-cpp.tar.gz");
	const fileStream = createWriteStream(tarPath);
	let downloadedBytes = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		fileStream.write(value);
		downloadedBytes += value.length;

		onProgress?.({
			stage: "downloading",
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

	// Extract tarball
	onProgress?.({ stage: "extracting", percent: 50 });
	await new Promise<void>((resolve, reject) => {
		exec(`tar -xzf "${tarPath}" -C "${binDir}"`, (error) => {
			if (error) reject(error);
			else resolve();
		});
	});

	// Make binary executable
	await fsp.chmod(SD_CPP_BIN, 0o755);

	// Clean up tarball
	await fsp.unlink(tarPath);

	onProgress?.({ stage: "complete", percent: 100 });
};

export interface GenerateImageOptions {
	prompt: string;
	negativePrompt?: string;
	model: string;
	outputPath: string;
	width?: number;
	height?: number;
	steps?: number;
	cfgScale?: number;
	seed?: number;
	// LoRA support for themes
	lora?: string;
	loraWeight?: number;
	// ControlNet for pose/structure control
	controlNet?: string;
	controlImage?: string;
	controlStrength?: number;
}

export interface GenerationProgress {
	step: number;
	totalSteps: number;
	percent: number;
}

export type GenerationProgressCallback = (progress: GenerationProgress) => void;

export interface GenerateImageResult {
	success: boolean;
	outputPath?: string;
	error?: string;
	generationTime: number;
	seed?: number;
}

export const generateImage = async (
	options: GenerateImageOptions,
	onProgress?: GenerationProgressCallback,
): Promise<GenerateImageResult> => {
	if (!isSdCppInstalled()) {
		throw new Error("sd-cpp is not installed. Please install it first.");
	}

	const startTime = Date.now();

	const args: string[] = [
		"-m",
		resolveModelPath(options.model),
		"-p",
		options.prompt,
		"-o",
		options.outputPath,
		"--width",
		String(options.width ?? 512),
		"--height",
		String(options.height ?? 512),
		"--steps",
		String(options.steps ?? 20),
		"--cfg-scale",
		String(options.cfgScale ?? 7),
	];

	if (options.negativePrompt) {
		args.push("-n", options.negativePrompt);
	}

	if (options.seed !== undefined) {
		args.push("--seed", String(options.seed));
	}

	// LoRA for theme consistency
	if (options.lora) {
		args.push("--lora", resolveModelPath(options.lora));
		if (options.loraWeight !== undefined) {
			args.push("--lora-weight", String(options.loraWeight));
		}
	}

	// ControlNet for pose/structure
	if (options.controlNet && options.controlImage) {
		args.push("--control-net", resolveModelPath(options.controlNet));
		args.push("--control-image", options.controlImage);
		if (options.controlStrength !== undefined) {
			args.push("--control-strength", String(options.controlStrength));
		}
	}

	let capturedSeed: number | undefined;

	return new Promise((resolve) => {
		const process = spawn(SD_CPP_BIN, args);

		let errorOutput = "";

		process.stderr?.on("data", (data: Buffer) => {
			const text = data.toString();
			errorOutput += text;

			// Parse progress: "step 12/25"
			const progressMatch = text.match(/step\s+(\d+)\/(\d+)/i);
			if (progressMatch && onProgress) {
				const step = parseInt(progressMatch[1], 10);
				const totalSteps = parseInt(progressMatch[2], 10);
				onProgress({
					step,
					totalSteps,
					percent: Math.round((step / totalSteps) * 100),
				});
			}

			// Capture seed from output
			const seedMatch = text.match(/seed:\s*(\d+)/i);
			if (seedMatch) {
				capturedSeed = parseInt(seedMatch[1], 10);
			}
		});

		process.on("close", (code) => {
			const generationTime = Date.now() - startTime;

			if (code === 0) {
				resolve({
					success: true,
					outputPath: options.outputPath,
					generationTime,
					seed: capturedSeed,
				});
			} else {
				resolve({
					success: false,
					error: errorOutput || `Process exited with code ${code}`,
					generationTime,
				});
			}
		});

		process.on("error", (err) => {
			resolve({
				success: false,
				error: err.message,
				generationTime: Date.now() - startTime,
			});
		});
	});
};
