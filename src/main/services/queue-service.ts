// ABOUTME: Queue service - IPC bridge for queue operations
// ABOUTME: Manages queue processor and broadcasts events to renderer

import { BrowserWindow } from "electron";
import { createQueueProcessor, type QueueProcessor } from "./queue-processor";
import {
  addToQueue,
  getQueueItem,
  deleteQueueItem,
  getQueueStatus,
  listQueueItems,
  resetQueueItem,
} from "../db/queue";
import type {
  GenerationRequest,
  QueueItem,
  QueueStatusMessage,
  GenerationProgressMessage,
  GenerationCompleteMessage,
  GenerationFailedMessage,
} from "../../shared/types";
import type { GenerationProgress } from "../../shared/sd-cpp";

export interface QueueService {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
  add: (request: GenerationRequest) => { id: string };
  cancel: (id: string) => { success: boolean };
  remove: (id: string) => { success: boolean };
  retry: (id: string) => { success: boolean };
  list: () => QueueItem[];
  getStatus: () => QueueStatusMessage;
}

// Broadcast a message to all windows
const broadcast = <T>(channel: string, data: T): void => {
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    window.webContents.send(channel, data);
  }
};

// Broadcast current queue status to all windows
const broadcastQueueStatus = (): void => {
  const status = getQueueStatus();
  broadcast<QueueStatusMessage>("queue:status", status);
};

export const createQueueService = (): QueueService => {
  const processor: QueueProcessor = createQueueProcessor({
    onStatusChange: (_id: string, _status: string) => {
      broadcastQueueStatus();
    },

    onProgress: (id: string, progress: GenerationProgress) => {
      const message: GenerationProgressMessage = {
        requestId: id,
        percent: progress.percent,
        step: progress.step,
        totalSteps: progress.totalSteps,
      };
      broadcast<GenerationProgressMessage>("generation:progress", message);
    },

    onComplete: (id: string, outputPath: string, seed: number) => {
      const message: GenerationCompleteMessage = {
        requestId: id,
        outputPath,
        seed,
      };
      broadcast<GenerationCompleteMessage>("generation:complete", message);
    },

    onFailed: (id: string, error: string) => {
      const message: GenerationFailedMessage = {
        requestId: id,
        error,
      };
      broadcast<GenerationFailedMessage>("generation:failed", message);
    },

    onDiskFull: (id: string) => {
      broadcast<{ requestId: string }>("queue:diskFull", { requestId: id });
    },
  });

  return {
    start: () => {
      processor.start();
    },

    stop: () => {
      processor.stop();
    },

    isRunning: () => processor.isRunning(),

    add: (request: GenerationRequest) => {
      addToQueue(request);
      broadcastQueueStatus();
      return { id: request.id };
    },

    cancel: (id: string) => {
      const item = getQueueItem(id);

      // Can only cancel pending items
      if (!item || item.status !== "pending") {
        return { success: false };
      }

      deleteQueueItem(id);
      broadcastQueueStatus();
      return { success: true };
    },

    remove: (id: string) => {
      const item = getQueueItem(id);

      // Can only remove failed or completed items (not pending or generating)
      if (!item || (item.status !== "failed" && item.status !== "complete")) {
        return { success: false };
      }

      deleteQueueItem(id);
      broadcastQueueStatus();
      return { success: true };
    },

    retry: (id: string) => {
      const item = getQueueItem(id);

      // Can only retry failed items
      if (!item || item.status !== "failed") {
        return { success: false };
      }

      // Reset to pending status (clears error, timestamps, etc.)
      resetQueueItem(id);
      broadcastQueueStatus();
      return { success: true };
    },

    list: () => {
      return listQueueItems();
    },

    getStatus: () => {
      return getQueueStatus();
    },
  };
};
