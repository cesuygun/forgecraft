// ABOUTME: Generation queue processor service
// ABOUTME: Sequentially processes pending queue items using sd-cpp

import { getNextPending, updateQueueStatus } from "../db/queue";
import { recordGeneration } from "../db/generations";
import { generateImage } from "../../shared/sd-cpp";
import { removeBackground, getTransparentPath } from "./background-removal";
import { getSettings } from "../data";
import type { QueueItem, GenerationRecord } from "../../shared/types";
import type { GenerationProgress } from "../../shared/sd-cpp";

export interface QueueProcessorCallbacks {
	onStatusChange?: (id: string, status: string) => void;
	onProgress?: (id: string, progress: GenerationProgress) => void;
	onComplete?: (id: string, outputPath: string, seed: number) => void;
	onFailed?: (id: string, error: string) => void;
	onDiskFull?: (id: string) => void;
}

export interface QueueProcessor {
	start: () => void;
	stop: () => void;
	isRunning: () => boolean;
	pause: () => void;
	resume: () => void;
	isPaused: () => boolean;
}

// Polling interval when queue is empty (ms)
const POLLING_INTERVAL_MS = 100;

// Detects if an error is a disk full error (ENOSPC or similar)
const isDiskFullError = (error: unknown): boolean => {
	if (error instanceof Error) {
		// Check for ENOSPC error code (Node.js standard for disk full)
		const nodeError = error as NodeJS.ErrnoException;
		if (nodeError.code === "ENOSPC") {
			return true;
		}
		// Check for common disk full error messages
		const message = error.message.toLowerCase();
		if (message.includes("disk full") || message.includes("no space left on device")) {
			return true;
		}
	}
	// Check string errors too
	if (typeof error === "string") {
		const lowerError = error.toLowerCase();
		if (lowerError.includes("disk full") || lowerError.includes("no space left on device")) {
			return true;
		}
	}
	return false;
};

export const createQueueProcessor = (callbacks?: QueueProcessorCallbacks): QueueProcessor => {
	let running = false;
	let processing = false;
	let paused = false;

	const processNext = async (): Promise<void> => {
		if (!running || processing || paused) {
			return;
		}

		const item = getNextPending();
		if (!item) {
			// No items to process, schedule next check
			if (running && !paused) {
				setTimeout(processNext, POLLING_INTERVAL_MS);
			}
			return;
		}

		processing = true;

		try {
			await processItem(item);
		} finally {
			processing = false;
		}

		// Process next item if still running
		if (running) {
			// Use setImmediate-style scheduling to avoid stack growth
			setTimeout(processNext, 0);
		}
	};

	const processItem = async (item: QueueItem): Promise<void> => {
		const { id, request } = item;
		const startTime = Date.now();

		// Mark as generating
		updateQueueStatus(id, "generating", { startedAt: startTime });
		callbacks?.onStatusChange?.(id, "generating");

		try {
			const result = await generateImage(
				{
					prompt: request.prompt,
					negativePrompt: request.negativePrompt,
					model: request.model,
					outputPath: request.outputPath,
					width: request.width,
					height: request.height,
					steps: request.steps,
					cfgScale: request.cfgScale,
					seed: request.seed ?? undefined,
				},
				(progress) => {
					callbacks?.onProgress?.(id, progress);
				},
			);

			const completedAt = Date.now();

			if (result.success) {
				const seed = result.seed ?? request.seed ?? 0;

				// Update queue status to complete
				updateQueueStatus(id, "complete", {
					completedAt,
					resultSeed: seed,
				});

				// Remove background if setting is enabled (before recording)
				let transparentPath: string | null = null;
				const settings = getSettings();
				if (settings.removeBackground) {
					const targetPath = getTransparentPath(request.outputPath);
					const bgResult = await removeBackground(request.outputPath, targetPath);
					if (bgResult.success) {
						transparentPath = targetPath;
					} else {
						console.error(`[QueueProcessor] Background removal failed: ${bgResult.error}`);
						// Continue anyway - original image is still saved, transparentPath stays null
					}
				}

				// Record in generation history (after background removal so we have the path)
				const record: GenerationRecord = {
					id,
					themeId: request.themeId,
					templateId: request.templateId,
					templateValues: request.templateValues,
					prompt: request.prompt,
					negativePrompt: request.negativePrompt,
					seed,
					outputPath: request.outputPath,
					transparentPath,
					model: request.model,
					width: request.width,
					height: request.height,
					steps: request.steps,
					cfgScale: request.cfgScale,
					generationTimeMs: result.generationTime,
					createdAt: completedAt,
				};
				recordGeneration(record);

				callbacks?.onStatusChange?.(id, "complete");
				callbacks?.onComplete?.(id, request.outputPath, seed);
			} else {
				const errorMessage = result.error ?? "Unknown error";

				// Check for disk full error in result
				if (isDiskFullError(errorMessage)) {
					updateQueueStatus(id, "failed", {
						completedAt,
						error: "Disk full",
					});

					callbacks?.onStatusChange?.(id, "failed");
					callbacks?.onFailed?.(id, "Disk full");

					// Pause the queue and notify
					paused = true;
					callbacks?.onDiskFull?.(id);
					return;
				}

				updateQueueStatus(id, "failed", {
					completedAt,
					error: errorMessage,
				});

				callbacks?.onStatusChange?.(id, "failed");
				callbacks?.onFailed?.(id, errorMessage);
			}
		} catch (error) {
			const completedAt = Date.now();
			const errorMessage = error instanceof Error ? error.message : String(error);

			// Check for disk full error
			if (isDiskFullError(error)) {
				updateQueueStatus(id, "failed", {
					completedAt,
					error: "Disk full",
				});

				callbacks?.onStatusChange?.(id, "failed");
				callbacks?.onFailed?.(id, "Disk full");

				// Pause the queue and notify
				paused = true;
				callbacks?.onDiskFull?.(id);
				return;
			}

			updateQueueStatus(id, "failed", {
				completedAt,
				error: errorMessage,
			});

			callbacks?.onStatusChange?.(id, "failed");
			callbacks?.onFailed?.(id, errorMessage);
		}
	};

	return {
		start: () => {
			if (running) {
				return;
			}
			running = true;
			paused = false;
			processNext();
		},

		stop: () => {
			running = false;
			paused = false;
		},

		isRunning: () => running,

		pause: () => {
			if (!running || paused) {
				return;
			}
			paused = true;
		},

		resume: () => {
			if (!running || !paused) {
				return;
			}
			paused = false;
			// Restart processing loop
			processNext();
		},

		isPaused: () => paused,
	};
};
