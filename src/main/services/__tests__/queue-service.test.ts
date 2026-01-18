// ABOUTME: Tests for queue service - IPC bridge for queue operations
// ABOUTME: Verifies IPC event broadcasting and command handling

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
  vi,
} from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { GenerationRequest, QueueItem } from "../../../shared/types";

// Mock Electron BrowserWindow - must be before other imports
const mockWebContentsSend = vi.fn();
const mockBrowserWindow = {
  webContents: {
    send: mockWebContentsSend,
  },
};

let tempDir: string | null = null;

vi.mock("electron", () => ({
  app: {
    getPath: (name: string) => {
      if (name === "home") {
        if (!tempDir) {
          tempDir = mkdtempSync(join(tmpdir(), "forgecraft-test-"));
        }
        return tempDir;
      }
      return "/tmp";
    },
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [mockBrowserWindow]),
  },
}));

// Mock sd-cpp module
vi.mock("../../../shared/sd-cpp", () => ({
  generateImage: vi.fn(),
  isSdCppInstalled: vi.fn(() => true),
}));

// Helper functions for temp directory management
const getTempDir = (): string => {
  if (!tempDir) {
    tempDir = mkdtempSync(join(tmpdir(), "forgecraft-test-"));
  }
  return tempDir;
};

const cleanupTempDir = (): void => {
  if (tempDir) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    tempDir = null;
  }
};

const resetTempDir = (): void => {
  cleanupTempDir();
  tempDir = mkdtempSync(join(tmpdir(), "forgecraft-test-"));
};

import { initDatabase, closeDatabase } from "../../db/database";
import { addToQueue, getQueueItem } from "../../db/queue";

import { generateImage } from "../../../shared/sd-cpp";
import { createQueueService, type QueueService } from "../queue-service";

const mockedGenerateImage = vi.mocked(generateImage);

const createRequest = (
  id: string,
  overrides?: Partial<GenerationRequest>,
): GenerationRequest => ({
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

describe("QueueService", () => {
  let service: QueueService;

  beforeEach(() => {
    resetTempDir();
    initDatabase();
    // Use clearAllMocks to preserve mock implementations while clearing call history
    vi.clearAllMocks();
    // Reset generateImage mock specifically (as it may have custom implementations)
    mockedGenerateImage.mockReset();
    service = createQueueService();
  });

  afterEach(async () => {
    // Ensure service is stopped before closing database
    service.stop();
    // Give it a moment to clean up
    await new Promise((resolve) => setTimeout(resolve, 50));
    closeDatabase();
  });

  afterAll(() => {
    cleanupTempDir();
  });

  describe("createQueueService", () => {
    it("should create a new service instance", () => {
      const svc = createQueueService();
      expect(svc).toBeDefined();
      expect(svc.isRunning()).toBe(false);
    });
  });

  describe("start/stop behavior", () => {
    it("should start the service and underlying processor", () => {
      service.start();
      expect(service.isRunning()).toBe(true);
    });

    it("should stop the service", () => {
      service.start();
      service.stop();
      expect(service.isRunning()).toBe(false);
    });
  });

  describe("add command", () => {
    it("should add a request to the queue and return the id", () => {
      const request = createRequest("add-1");
      const result = service.add(request);

      expect(result).toEqual({ id: "add-1" });

      const item = getQueueItem("add-1");
      expect(item).not.toBeNull();
      expect(item?.status).toBe("pending");
    });

    it("should broadcast queue status after adding", () => {
      const request = createRequest("add-2");
      service.add(request);

      expect(mockWebContentsSend).toHaveBeenCalledWith(
        "queue:status",
        expect.objectContaining({
          pending: 1,
          generating: null,
          completed: 0,
          failed: 0,
        }),
      );
    });
  });

  describe("cancel command", () => {
    it("should cancel a pending item and return success", () => {
      const request = createRequest("cancel-1");
      addToQueue(request);

      const result = service.cancel("cancel-1");

      expect(result).toEqual({ success: true });

      // Item should be deleted (cancelled items are removed)
      const item = getQueueItem("cancel-1");
      expect(item).toBeNull();
    });

    it("should return failure for non-existent item", () => {
      const result = service.cancel("non-existent");
      expect(result).toEqual({ success: false });
    });

    it("should not cancel items that are generating", async () => {
      const request = createRequest("cancel-2");
      addToQueue(request);

      // Start the service to begin processing
      mockedGenerateImage.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  success: true,
                  outputPath: request.outputPath,
                  generationTime: 100,
                  seed: 123,
                }),
              500,
            ),
          ),
      );

      service.start();

      // Wait for item to be generating
      await vi.waitFor(
        () => {
          const item = getQueueItem("cancel-2");
          expect(item?.status).toBe("generating");
        },
        { timeout: 2000 },
      );

      // Try to cancel - should fail because item is generating
      const result = service.cancel("cancel-2");
      expect(result).toEqual({ success: false });

      service.stop();
    });

    it("should broadcast queue status after cancelling", () => {
      const request = createRequest("cancel-3");
      addToQueue(request);

      mockWebContentsSend.mockClear();
      service.cancel("cancel-3");

      expect(mockWebContentsSend).toHaveBeenCalledWith(
        "queue:status",
        expect.objectContaining({
          pending: 0,
        }),
      );
    });
  });

  describe("retry command", () => {
    it("should retry a failed item and return success", async () => {
      const request = createRequest("retry-1");
      addToQueue(request);

      // Fail the item first
      mockedGenerateImage.mockResolvedValueOnce({
        success: false,
        error: "Test error",
        generationTime: 50,
      });

      service.start();

      await vi.waitFor(
        () => {
          const item = getQueueItem("retry-1");
          expect(item?.status).toBe("failed");
        },
        { timeout: 2000 },
      );

      service.stop();

      // Now retry
      const result = service.retry("retry-1");
      expect(result).toEqual({ success: true });

      const item = getQueueItem("retry-1");
      expect(item?.status).toBe("pending");
      expect(item?.error).toBeNull();
    });

    it("should return failure for non-existent item", () => {
      const result = service.retry("non-existent");
      expect(result).toEqual({ success: false });
    });

    it("should not retry items that are not failed", () => {
      const request = createRequest("retry-2");
      addToQueue(request);

      const result = service.retry("retry-2");
      expect(result).toEqual({ success: false });
    });

    it("should broadcast queue status after retrying", async () => {
      const request = createRequest("retry-3");
      addToQueue(request);

      // Fail the item first
      mockedGenerateImage.mockResolvedValueOnce({
        success: false,
        error: "Test error",
        generationTime: 50,
      });

      service.start();

      await vi.waitFor(
        () => {
          const item = getQueueItem("retry-3");
          expect(item?.status).toBe("failed");
        },
        { timeout: 2000 },
      );

      service.stop();

      mockWebContentsSend.mockClear();
      service.retry("retry-3");

      expect(mockWebContentsSend).toHaveBeenCalledWith(
        "queue:status",
        expect.objectContaining({
          pending: 1,
          failed: 0,
        }),
      );
    });
  });

  describe("list command", () => {
    it("should return all queue items", () => {
      const request1 = createRequest("list-1");
      const request2 = createRequest("list-2");
      addToQueue(request1);
      addToQueue(request2);

      const items = service.list();

      expect(items).toHaveLength(2);
      expect(items.map((i: QueueItem) => i.id)).toContain("list-1");
      expect(items.map((i: QueueItem) => i.id)).toContain("list-2");
    });

    it("should return empty array when queue is empty", () => {
      const items = service.list();
      expect(items).toEqual([]);
    });
  });

  describe("IPC event broadcasting", () => {
    it("should broadcast queue:status when item status changes", async () => {
      const request = createRequest("ipc-1");
      service.add(request);

      mockWebContentsSend.mockClear();

      mockedGenerateImage.mockResolvedValueOnce({
        success: true,
        outputPath: request.outputPath,
        generationTime: 100,
        seed: 123,
      });

      service.start();

      await vi.waitFor(
        () => {
          const item = getQueueItem("ipc-1");
          expect(item?.status).toBe("complete");
        },
        { timeout: 2000 },
      );

      service.stop();

      // Should have sent queue:status updates
      const statusCalls = mockWebContentsSend.mock.calls.filter(
        (call) => call[0] === "queue:status",
      );
      expect(statusCalls.length).toBeGreaterThan(0);
    });

    it("should broadcast generation:progress during generation", async () => {
      const request = createRequest("ipc-2");
      service.add(request);

      mockWebContentsSend.mockClear();

      mockedGenerateImage.mockImplementationOnce(
        async (_options, onProgress) => {
          onProgress?.({ step: 5, totalSteps: 20, percent: 25 });
          onProgress?.({ step: 10, totalSteps: 20, percent: 50 });
          return {
            success: true,
            outputPath: request.outputPath,
            generationTime: 100,
            seed: 456,
          };
        },
      );

      service.start();

      await vi.waitFor(
        () => {
          const item = getQueueItem("ipc-2");
          expect(item?.status).toBe("complete");
        },
        { timeout: 2000 },
      );

      service.stop();

      // Should have sent progress updates
      const progressCalls = mockWebContentsSend.mock.calls.filter(
        (call) => call[0] === "generation:progress",
      );
      expect(progressCalls.length).toBeGreaterThanOrEqual(2);
      expect(progressCalls[0][1]).toEqual({
        requestId: "ipc-2",
        percent: 25,
        step: 5,
        totalSteps: 20,
      });
    });

    it("should broadcast generation:complete on success", async () => {
      const request = createRequest("ipc-3", {
        outputPath: "/output/ipc-3.png",
      });
      service.add(request);

      mockWebContentsSend.mockClear();

      mockedGenerateImage.mockResolvedValueOnce({
        success: true,
        outputPath: request.outputPath,
        generationTime: 100,
        seed: 789,
      });

      service.start();

      await vi.waitFor(
        () => {
          const item = getQueueItem("ipc-3");
          expect(item?.status).toBe("complete");
        },
        { timeout: 2000 },
      );

      service.stop();

      // Should have sent generation:complete
      const completeCalls = mockWebContentsSend.mock.calls.filter(
        (call) => call[0] === "generation:complete",
      );
      expect(completeCalls).toHaveLength(1);
      expect(completeCalls[0][1]).toEqual({
        requestId: "ipc-3",
        outputPath: "/output/ipc-3.png",
        seed: 789,
      });
    });

    it("should broadcast generation:failed on failure", async () => {
      const request = createRequest("ipc-4");
      service.add(request);

      mockWebContentsSend.mockClear();

      mockedGenerateImage.mockResolvedValueOnce({
        success: false,
        error: "Out of memory",
        generationTime: 50,
      });

      service.start();

      await vi.waitFor(
        () => {
          const item = getQueueItem("ipc-4");
          expect(item?.status).toBe("failed");
        },
        { timeout: 2000 },
      );

      service.stop();

      // Should have sent generation:failed
      const failedCalls = mockWebContentsSend.mock.calls.filter(
        (call) => call[0] === "generation:failed",
      );
      expect(failedCalls).toHaveLength(1);
      expect(failedCalls[0][1]).toEqual({
        requestId: "ipc-4",
        error: "Out of memory",
      });
    });

    it("should broadcast to all windows", async () => {
      // Add a second mock window
      const mockWindow2 = {
        webContents: { send: vi.fn() },
      };

      const { BrowserWindow } = await import("electron");
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        mockBrowserWindow as unknown as Electron.BrowserWindow,
        mockWindow2 as unknown as Electron.BrowserWindow,
      ]);

      // Create a new service to pick up the new mock
      const svc = createQueueService();

      const request = createRequest("ipc-5");
      svc.add(request);

      // Both windows should receive the status update
      expect(mockWebContentsSend).toHaveBeenCalledWith(
        "queue:status",
        expect.any(Object),
      );
      expect(mockWindow2.webContents.send).toHaveBeenCalledWith(
        "queue:status",
        expect.any(Object),
      );

      // Restore original mock
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        mockBrowserWindow as unknown as Electron.BrowserWindow,
      ]);
    });
  });

  describe("getStatus", () => {
    it("should return current queue status", () => {
      const request1 = createRequest("status-1");
      const request2 = createRequest("status-2");
      addToQueue(request1);
      addToQueue(request2);

      const status = service.getStatus();

      expect(status).toEqual({
        pending: 2,
        generating: null,
        completed: 0,
        failed: 0,
      });
    });
  });

  describe("disk full handling", () => {
    it("should broadcast queue:diskFull when disk full error occurs", async () => {
      const request = createRequest("disk-full-1");
      service.add(request);

      mockWebContentsSend.mockClear();

      // Simulate disk full error
      const diskFullError = new Error("ENOSPC: no space left on device");
      (diskFullError as NodeJS.ErrnoException).code = "ENOSPC";
      mockedGenerateImage.mockRejectedValueOnce(diskFullError);

      service.start();

      await vi.waitFor(
        () => {
          const item = getQueueItem("disk-full-1");
          expect(item?.status).toBe("failed");
        },
        { timeout: 2000 },
      );

      service.stop();

      // Should have sent queue:diskFull event
      const diskFullCalls = mockWebContentsSend.mock.calls.filter(
        (call) => call[0] === "queue:diskFull",
      );
      expect(diskFullCalls).toHaveLength(1);
      expect(diskFullCalls[0][1]).toEqual({
        requestId: "disk-full-1",
      });
    });
  });
});
