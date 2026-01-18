// ABOUTME: Tests for queue processor service
// ABOUTME: Verifies start/stop, processing, success/failure handling

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { cleanupTempDir, resetTempDir } from "../../db/__tests__/test-helpers";
import { initDatabase, closeDatabase } from "../../db/database";
import { addToQueue, getQueueItem } from "../../db/queue";
import { getGeneration } from "../../db/generations";
import type { GenerationRequest } from "../../../shared/types";
import type { GenerationProgressCallback, GenerationProgress } from "../../../shared/sd-cpp";

// Mock sd-cpp module
vi.mock("../../../shared/sd-cpp", () => ({
	generateImage: vi.fn(),
	isSdCppInstalled: vi.fn(() => true),
}));

import { generateImage } from "../../../shared/sd-cpp";
import {
	QueueProcessor,
	createQueueProcessor,
	type QueueProcessorCallbacks,
} from "../queue-processor";

const mockedGenerateImage = vi.mocked(generateImage);

const createRequest = (id: string, overrides?: Partial<GenerationRequest>): GenerationRequest => ({
	id,
	themeId: "test-theme",
	templateId: "test-template",
	templateValues: { race: "orc", job: "warrior" },
	prompt: "test prompt",
	negativePrompt: "test negative",
	model: "test-model",
	width: 512,
	height: 512,
	steps: 20,
	cfgScale: 7,
	seed: null,
	outputPath: "/output/test.png",
	...overrides,
});

describe("QueueProcessor", () => {
	let processor: QueueProcessor;

	beforeEach(() => {
		resetTempDir();
		initDatabase();
		// resetAllMocks also clears mock implementation queue (mockRejectedValueOnce, etc.)
		vi.resetAllMocks();
		processor = createQueueProcessor();
	});

	afterEach(async () => {
		// Ensure processor is stopped before closing database
		if (processor.isRunning()) {
			processor.stop();
			// Give it a moment to clean up
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
		closeDatabase();
	});

	afterAll(() => {
		cleanupTempDir();
	});

	describe("createQueueProcessor", () => {
		it("should create a new processor instance", () => {
			const proc = createQueueProcessor();
			expect(proc).toBeDefined();
			expect(proc.isRunning()).toBe(false);
		});
	});

	describe("start/stop behavior", () => {
		it("should start the processor", () => {
			processor.start();
			expect(processor.isRunning()).toBe(true);
		});

		it("should stop the processor", () => {
			processor.start();
			processor.stop();
			expect(processor.isRunning()).toBe(false);
		});

		it("should be idempotent when starting multiple times", () => {
			processor.start();
			processor.start();
			expect(processor.isRunning()).toBe(true);
		});

		it("should be idempotent when stopping multiple times", () => {
			processor.start();
			processor.stop();
			processor.stop();
			expect(processor.isRunning()).toBe(false);
		});

		it("should do nothing when stopping a non-started processor", () => {
			expect(processor.isRunning()).toBe(false);
			processor.stop();
			expect(processor.isRunning()).toBe(false);
		});
	});

	describe("processing pending items", () => {
		it("should process a pending item and mark it as complete on success", async () => {
			const request = createRequest("req-1");
			addToQueue(request);

			mockedGenerateImage.mockResolvedValueOnce({
				success: true,
				outputPath: request.outputPath,
				generationTime: 1000,
				seed: 12345,
			});

			processor.start();

			// Wait for processing
			await vi.waitFor(
				() => {
					const item = getQueueItem("req-1");
					expect(item?.status).toBe("complete");
				},
				{ timeout: 2000 },
			);

			processor.stop();

			const item = getQueueItem("req-1");
			expect(item?.status).toBe("complete");
			expect(item?.resultSeed).toBe(12345);
			expect(item?.completedAt).not.toBeNull();
		});

		it("should record generation in history on success", async () => {
			const request = createRequest("req-2");
			addToQueue(request);

			mockedGenerateImage.mockResolvedValueOnce({
				success: true,
				outputPath: request.outputPath,
				generationTime: 1500,
				seed: 67890,
			});

			processor.start();

			await vi.waitFor(
				() => {
					const generation = getGeneration("req-2");
					expect(generation).not.toBeNull();
				},
				{ timeout: 2000 },
			);

			processor.stop();

			const generation = getGeneration("req-2");
			expect(generation?.id).toBe("req-2");
			expect(generation?.seed).toBe(67890);
			expect(generation?.generationTimeMs).toBe(1500);
			expect(generation?.prompt).toBe(request.prompt);
		});

		it("should mark item as failed on generation failure", async () => {
			const request = createRequest("req-3");
			addToQueue(request);

			mockedGenerateImage.mockResolvedValueOnce({
				success: false,
				error: "Model file not found",
				generationTime: 100,
			});

			processor.start();

			await vi.waitFor(
				() => {
					const item = getQueueItem("req-3");
					expect(item?.status).toBe("failed");
				},
				{ timeout: 2000 },
			);

			processor.stop();

			const item = getQueueItem("req-3");
			expect(item?.status).toBe("failed");
			expect(item?.error).toBe("Model file not found");
			expect(item?.completedAt).not.toBeNull();
		});

		it("should not record generation in history on failure", async () => {
			const request = createRequest("req-4");
			addToQueue(request);

			mockedGenerateImage.mockResolvedValueOnce({
				success: false,
				error: "Generation failed",
				generationTime: 100,
			});

			processor.start();

			await vi.waitFor(
				() => {
					const item = getQueueItem("req-4");
					expect(item?.status).toBe("failed");
				},
				{ timeout: 2000 },
			);

			processor.stop();

			const generation = getGeneration("req-4");
			expect(generation).toBeNull();
		});

		it("should update status to generating while processing", async () => {
			const request = createRequest("req-5");
			addToQueue(request);

			let capturedStatus: string | null = null;

			mockedGenerateImage.mockImplementationOnce(async () => {
				// Capture the status while "generating"
				const item = getQueueItem("req-5");
				capturedStatus = item?.status ?? null;
				return {
					success: true,
					outputPath: request.outputPath,
					generationTime: 100,
					seed: 11111,
				};
			});

			processor.start();

			await vi.waitFor(
				() => {
					const item = getQueueItem("req-5");
					expect(item?.status).toBe("complete");
				},
				{ timeout: 2000 },
			);

			processor.stop();

			expect(capturedStatus).toBe("generating");
		});

		it("should process multiple items sequentially", async () => {
			const request1 = createRequest("req-a", { outputPath: "/output/a.png" });
			const request2 = createRequest("req-b", { outputPath: "/output/b.png" });
			addToQueue(request1);
			addToQueue(request2);

			const processingOrder: string[] = [];

			mockedGenerateImage.mockImplementation(async (options) => {
				processingOrder.push(options.outputPath);
				return {
					success: true,
					outputPath: options.outputPath,
					generationTime: 50,
					seed: 99999,
				};
			});

			processor.start();

			await vi.waitFor(
				() => {
					const item1 = getQueueItem("req-a");
					const item2 = getQueueItem("req-b");
					expect(item1?.status).toBe("complete");
					expect(item2?.status).toBe("complete");
				},
				{ timeout: 3000 },
			);

			processor.stop();

			// Verify sequential processing (oldest first)
			expect(processingOrder).toEqual(["/output/a.png", "/output/b.png"]);
		});

		it("should call generateImage with correct parameters", async () => {
			const request = createRequest("req-6", {
				prompt: "a beautiful landscape",
				negativePrompt: "ugly, blurry",
				model: "my-model.safetensors",
				width: 768,
				height: 512,
				steps: 30,
				cfgScale: 8,
				seed: 42,
				outputPath: "/output/landscape.png",
			});
			addToQueue(request);

			mockedGenerateImage.mockResolvedValueOnce({
				success: true,
				outputPath: request.outputPath,
				generationTime: 200,
				seed: 42,
			});

			processor.start();

			await vi.waitFor(
				() => {
					expect(mockedGenerateImage).toHaveBeenCalled();
				},
				{ timeout: 2000 },
			);

			processor.stop();

			expect(mockedGenerateImage).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: "a beautiful landscape",
					negativePrompt: "ugly, blurry",
					model: "my-model.safetensors",
					width: 768,
					height: 512,
					steps: 30,
					cfgScale: 8,
					seed: 42,
					outputPath: "/output/landscape.png",
				}),
				expect.any(Function),
			);
		});
	});

	describe("callbacks", () => {
		it("should call onStatusChange when item status changes", async () => {
			const request = createRequest("req-cb-1");
			addToQueue(request);

			const statusChanges: Array<{ id: string; status: string }> = [];
			const callbacks: QueueProcessorCallbacks = {
				onStatusChange: (id: string, status: string) => {
					statusChanges.push({ id, status });
				},
			};

			mockedGenerateImage.mockResolvedValueOnce({
				success: true,
				outputPath: request.outputPath,
				generationTime: 100,
				seed: 123,
			});

			processor = createQueueProcessor(callbacks);
			processor.start();

			await vi.waitFor(
				() => {
					expect(statusChanges.length).toBeGreaterThanOrEqual(2);
				},
				{ timeout: 2000 },
			);

			processor.stop();

			expect(statusChanges).toContainEqual({ id: "req-cb-1", status: "generating" });
			expect(statusChanges).toContainEqual({ id: "req-cb-1", status: "complete" });
		});

		it("should call onProgress during generation", async () => {
			const request = createRequest("req-cb-2");
			addToQueue(request);

			const progressUpdates: Array<{ id: string; percent: number }> = [];
			const callbacks: QueueProcessorCallbacks = {
				onProgress: (id: string, progress: GenerationProgress) => {
					progressUpdates.push({ id, percent: progress.percent });
				},
			};

			mockedGenerateImage.mockImplementationOnce(
				async (_options, onProgress?: GenerationProgressCallback) => {
					// Simulate progress updates
					onProgress?.({ step: 5, totalSteps: 20, percent: 25 });
					onProgress?.({ step: 10, totalSteps: 20, percent: 50 });
					onProgress?.({ step: 20, totalSteps: 20, percent: 100 });
					return {
						success: true,
						outputPath: request.outputPath,
						generationTime: 100,
						seed: 456,
					};
				},
			);

			processor = createQueueProcessor(callbacks);
			processor.start();

			await vi.waitFor(
				() => {
					const item = getQueueItem("req-cb-2");
					expect(item?.status).toBe("complete");
				},
				{ timeout: 2000 },
			);

			processor.stop();

			expect(progressUpdates).toContainEqual({ id: "req-cb-2", percent: 25 });
			expect(progressUpdates).toContainEqual({ id: "req-cb-2", percent: 50 });
			expect(progressUpdates).toContainEqual({ id: "req-cb-2", percent: 100 });
		});

		it("should call onComplete when generation succeeds", async () => {
			const request = createRequest("req-cb-3");
			addToQueue(request);

			let completionData: { id: string; outputPath: string; seed: number } | null = null;
			const callbacks: QueueProcessorCallbacks = {
				onComplete: (id: string, outputPath: string, seed: number) => {
					completionData = { id, outputPath, seed };
				},
			};

			mockedGenerateImage.mockResolvedValueOnce({
				success: true,
				outputPath: request.outputPath,
				generationTime: 100,
				seed: 789,
			});

			processor = createQueueProcessor(callbacks);
			processor.start();

			await vi.waitFor(
				() => {
					expect(completionData).not.toBeNull();
				},
				{ timeout: 2000 },
			);

			processor.stop();

			expect(completionData).toEqual({
				id: "req-cb-3",
				outputPath: request.outputPath,
				seed: 789,
			});
		});

		it("should call onFailed when generation fails", async () => {
			const request = createRequest("req-cb-4");
			addToQueue(request);

			let failureData: { id: string; error: string } | null = null;
			const callbacks: QueueProcessorCallbacks = {
				onFailed: (id: string, error: string) => {
					failureData = { id, error };
				},
			};

			mockedGenerateImage.mockResolvedValueOnce({
				success: false,
				error: "Out of memory",
				generationTime: 50,
			});

			processor = createQueueProcessor(callbacks);
			processor.start();

			await vi.waitFor(
				() => {
					expect(failureData).not.toBeNull();
				},
				{ timeout: 2000 },
			);

			processor.stop();

			expect(failureData).toEqual({
				id: "req-cb-4",
				error: "Out of memory",
			});
		});
	});

	describe("error handling", () => {
		it("should handle exceptions from generateImage gracefully", async () => {
			const request = createRequest("req-err-1");
			addToQueue(request);

			mockedGenerateImage.mockRejectedValueOnce(new Error("Unexpected crash"));

			processor.start();

			await vi.waitFor(
				() => {
					const item = getQueueItem("req-err-1");
					expect(item?.status).toBe("failed");
				},
				{ timeout: 2000 },
			);

			processor.stop();

			const item = getQueueItem("req-err-1");
			expect(item?.status).toBe("failed");
			expect(item?.error).toBe("Unexpected crash");
		});

		it("should continue processing after a failed item", async () => {
			const request1 = createRequest("req-err-a");
			const request2 = createRequest("req-err-b");
			addToQueue(request1);
			addToQueue(request2);

			mockedGenerateImage
				.mockResolvedValueOnce({
					success: false,
					error: "First failed",
					generationTime: 50,
				})
				.mockResolvedValueOnce({
					success: true,
					outputPath: request2.outputPath,
					generationTime: 100,
					seed: 111,
				});

			processor.start();

			await vi.waitFor(
				() => {
					const item1 = getQueueItem("req-err-a");
					const item2 = getQueueItem("req-err-b");
					expect(item1?.status).toBe("failed");
					expect(item2?.status).toBe("complete");
				},
				{ timeout: 3000 },
			);

			processor.stop();
		});
	});

	describe("stopping mid-process", () => {
		it("should not pick up new items after stop is called", async () => {
			const request1 = createRequest("req-stop-1");
			addToQueue(request1);

			mockedGenerateImage.mockImplementationOnce(async () => {
				// Stop processor while processing
				processor.stop();
				return {
					success: true,
					outputPath: request1.outputPath,
					generationTime: 100,
					seed: 222,
				};
			});

			processor.start();

			await vi.waitFor(
				() => {
					const item = getQueueItem("req-stop-1");
					expect(item?.status).toBe("complete");
				},
				{ timeout: 2000 },
			);

			// Add another item after stop
			const request2 = createRequest("req-stop-2");
			addToQueue(request2);

			// Give it a moment to potentially pick up the item (it shouldn't)
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Second item should still be pending since processor stopped
			const item2 = getQueueItem("req-stop-2");
			expect(item2?.status).toBe("pending");
		});
	});

	describe("pause/resume behavior", () => {
		it("should not be paused initially", () => {
			expect(processor.isPaused()).toBe(false);
		});

		it("should pause the processor", () => {
			processor.start();
			processor.pause();
			expect(processor.isPaused()).toBe(true);
			expect(processor.isRunning()).toBe(true);
		});

		it("should resume the processor", () => {
			processor.start();
			processor.pause();
			processor.resume();
			expect(processor.isPaused()).toBe(false);
		});

		it("should not pick up new items when paused", async () => {
			// Start processor with no items, then pause, then add item
			processor.start();
			processor.pause();

			const request = createRequest("req-pause-1");
			addToQueue(request);

			mockedGenerateImage.mockResolvedValueOnce({
				success: true,
				outputPath: request.outputPath,
				generationTime: 100,
				seed: 123,
			});

			// Give it a moment to potentially pick up the item (it shouldn't)
			await new Promise((resolve) => setTimeout(resolve, 150));

			// Item should still be pending since processor is paused
			const item = getQueueItem("req-pause-1");
			expect(item?.status).toBe("pending");
		});

		it("should resume processing after resume is called", async () => {
			// Start processor with no items, then pause, then add item
			processor.start();
			processor.pause();

			const request = createRequest("req-pause-2");
			addToQueue(request);

			mockedGenerateImage.mockResolvedValueOnce({
				success: true,
				outputPath: request.outputPath,
				generationTime: 100,
				seed: 456,
			});

			// Give it a moment
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Item should still be pending
			const item = getQueueItem("req-pause-2");
			expect(item?.status).toBe("pending");

			// Resume and wait for processing
			processor.resume();

			await vi.waitFor(
				() => {
					const updatedItem = getQueueItem("req-pause-2");
					expect(updatedItem?.status).toBe("complete");
				},
				{ timeout: 2000 },
			);

			processor.stop();
		});

		it("should be idempotent when pausing multiple times", () => {
			processor.start();
			processor.pause();
			processor.pause();
			expect(processor.isPaused()).toBe(true);
		});

		it("should be idempotent when resuming multiple times", () => {
			processor.start();
			processor.pause();
			processor.resume();
			processor.resume();
			expect(processor.isPaused()).toBe(false);
		});

		it("should do nothing when pausing a non-started processor", () => {
			processor.pause();
			expect(processor.isPaused()).toBe(false);
		});

		it("should do nothing when resuming a non-paused processor", () => {
			processor.start();
			processor.resume();
			expect(processor.isPaused()).toBe(false);
		});

		it("should reset paused state on stop", () => {
			processor.start();
			processor.pause();
			expect(processor.isPaused()).toBe(true);
			processor.stop();
			expect(processor.isPaused()).toBe(false);
		});

		it("should reset paused state on start", () => {
			processor.start();
			processor.pause();
			processor.stop();
			processor.start();
			expect(processor.isPaused()).toBe(false);
		});
	});

	describe("disk full error handling", () => {
		it("should pause queue and call onDiskFull when ENOSPC error is thrown", async () => {
			const request = createRequest("req-disk-1");
			addToQueue(request);

			let diskFullId: string | null = null;
			let failedId: string | null = null;
			let failedError: string | null = null;
			const callbacks: QueueProcessorCallbacks = {
				onDiskFull: (id: string) => {
					diskFullId = id;
				},
				onFailed: (id: string, error: string) => {
					failedId = id;
					failedError = error;
				},
			};

			// Create an error with ENOSPC code - use Object.assign to ensure code is preserved
			const enospcError = Object.assign(new Error("write failed"), { code: "ENOSPC" });

			mockedGenerateImage.mockRejectedValueOnce(enospcError);

			processor = createQueueProcessor(callbacks);
			processor.start();

			// First wait for the item to be processed (failed status)
			await vi.waitFor(
				() => {
					const item = getQueueItem("req-disk-1");
					expect(item?.status).toBe("failed");
				},
				{ timeout: 2000 },
			);

			// Check the error stored in the database
			const item = getQueueItem("req-disk-1");

			// onDiskFull should have been called
			expect(diskFullId).toBe("req-disk-1");

			// Processor should be paused but still running
			expect(processor.isPaused()).toBe(true);
			expect(processor.isRunning()).toBe(true);

			// Item should be marked as failed with "Disk full" error
			expect(item?.status).toBe("failed");
			expect(item?.error).toBe("Disk full");

			processor.stop();
		});

		it("should pause queue and call onDiskFull when 'disk full' message is in error", async () => {
			const request = createRequest("req-disk-2");
			addToQueue(request);

			let diskFullId: string | null = null;
			const callbacks: QueueProcessorCallbacks = {
				onDiskFull: (id: string) => {
					diskFullId = id;
				},
			};

			mockedGenerateImage.mockRejectedValueOnce(new Error("Disk full - cannot write output file"));

			processor = createQueueProcessor(callbacks);
			processor.start();

			await vi.waitFor(
				() => {
					expect(diskFullId).not.toBeNull();
				},
				{ timeout: 2000 },
			);

			expect(processor.isPaused()).toBe(true);
			expect(diskFullId).toBe("req-disk-2");

			processor.stop();
		});

		it("should pause queue and call onDiskFull when 'no space left on device' is in error", async () => {
			const request = createRequest("req-disk-3");
			addToQueue(request);

			let diskFullId: string | null = null;
			const callbacks: QueueProcessorCallbacks = {
				onDiskFull: (id: string) => {
					diskFullId = id;
				},
			};

			mockedGenerateImage.mockRejectedValueOnce(new Error("No space left on device"));

			processor = createQueueProcessor(callbacks);
			processor.start();

			await vi.waitFor(
				() => {
					expect(diskFullId).not.toBeNull();
				},
				{ timeout: 2000 },
			);

			expect(processor.isPaused()).toBe(true);
			expect(diskFullId).toBe("req-disk-3");

			processor.stop();
		});

		it("should detect disk full from result.error and pause queue", async () => {
			const request = createRequest("req-disk-4");
			addToQueue(request);

			let diskFullId: string | null = null;
			const callbacks: QueueProcessorCallbacks = {
				onDiskFull: (id: string) => {
					diskFullId = id;
				},
			};

			mockedGenerateImage.mockResolvedValueOnce({
				success: false,
				error: "Disk full - cannot save image",
				generationTime: 100,
			});

			processor = createQueueProcessor(callbacks);
			processor.start();

			await vi.waitFor(
				() => {
					expect(diskFullId).not.toBeNull();
				},
				{ timeout: 2000 },
			);

			expect(processor.isPaused()).toBe(true);
			const item = getQueueItem("req-disk-4");
			expect(item?.status).toBe("failed");
			expect(item?.error).toBe("Disk full");

			processor.stop();
		});

		it("should not pick up new items after disk full pause", async () => {
			const request1 = createRequest("req-disk-5a");
			const request2 = createRequest("req-disk-5b");
			addToQueue(request1);
			addToQueue(request2);

			const callbacks: QueueProcessorCallbacks = {
				onDiskFull: () => {},
			};

			const enospcError = Object.assign(new Error("write failed"), { code: "ENOSPC" });

			mockedGenerateImage.mockRejectedValueOnce(enospcError);

			processor = createQueueProcessor(callbacks);
			processor.start();

			await vi.waitFor(
				() => {
					expect(processor.isPaused()).toBe(true);
				},
				{ timeout: 2000 },
			);

			// Wait a bit to ensure the second item is not processed
			await new Promise((resolve) => setTimeout(resolve, 150));

			// Second item should still be pending
			const item2 = getQueueItem("req-disk-5b");
			expect(item2?.status).toBe("pending");

			processor.stop();
		});

		it("should resume processing remaining items after resume is called post disk full", async () => {
			const request1 = createRequest("req-disk-6a");
			const request2 = createRequest("req-disk-6b");
			addToQueue(request1);
			addToQueue(request2);

			const callbacks: QueueProcessorCallbacks = {
				onDiskFull: () => {},
			};

			const enospcError = Object.assign(new Error("write failed"), { code: "ENOSPC" });

			mockedGenerateImage
				.mockRejectedValueOnce(enospcError)
				.mockResolvedValueOnce({
					success: true,
					outputPath: request2.outputPath,
					generationTime: 100,
					seed: 789,
				});

			processor = createQueueProcessor(callbacks);
			processor.start();

			await vi.waitFor(
				() => {
					expect(processor.isPaused()).toBe(true);
				},
				{ timeout: 2000 },
			);

			// First item should be failed
			const item1 = getQueueItem("req-disk-6a");
			expect(item1?.status).toBe("failed");

			// Resume and wait for second item to be processed
			processor.resume();

			await vi.waitFor(
				() => {
					const item2 = getQueueItem("req-disk-6b");
					expect(item2?.status).toBe("complete");
				},
				{ timeout: 2000 },
			);

			processor.stop();
		});

		it("should also call onFailed when disk full error occurs", async () => {
			const request = createRequest("req-disk-7");
			addToQueue(request);

			let failureData: { id: string; error: string } | null = null;
			const callbacks: QueueProcessorCallbacks = {
				onDiskFull: () => {},
				onFailed: (id: string, error: string) => {
					failureData = { id, error };
				},
			};

			const enospcError = Object.assign(new Error("write failed"), { code: "ENOSPC" });

			mockedGenerateImage.mockRejectedValueOnce(enospcError);

			processor = createQueueProcessor(callbacks);
			processor.start();

			await vi.waitFor(
				() => {
					expect(failureData).not.toBeNull();
				},
				{ timeout: 2000 },
			);

			expect(failureData).toEqual({
				id: "req-disk-7",
				error: "Disk full",
			});

			processor.stop();
		});
	});
});
