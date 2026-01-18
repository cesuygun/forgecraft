// ABOUTME: Preload script - exposes safe APIs to renderer
// ABOUTME: Bridges main process capabilities to the UI

import { contextBridge, ipcRenderer } from "electron";

// Re-export types from shared for consistency (single source of truth)
import type {
  InstallProgress,
  GenerationProgress,
  GenerateImageOptions,
  GenerateImageResult,
} from "../shared/sd-cpp";
import type { SdModel, DownloadProgress } from "../shared/sd-models";
import type {
  Theme,
  Template,
  CreateThemeInput,
  UpdateThemeInput,
  CreateTemplateInput,
  UpdateTemplateInput,
  GenerationRequest,
  GenerationRecord,
  QueueItem,
  QueueStatusMessage,
  GenerationProgressMessage,
  GenerationCompleteMessage,
  GenerationFailedMessage,
  QueueDiskFullMessage,
} from "../shared/types";

// History list options type
export interface HistoryListOptions {
  themeId?: string;
  templateId?: string;
  limit?: number;
  offset?: number;
}

// Re-export for consumers
export type {
  InstallProgress,
  GenerationProgress,
  GenerateImageOptions,
  GenerateImageResult,
  SdModel,
  DownloadProgress,
  Theme,
  Template,
  CreateThemeInput,
  UpdateThemeInput,
  CreateTemplateInput,
  UpdateTemplateInput,
  GenerationRequest,
  GenerationRecord,
  QueueItem,
  QueueStatusMessage,
  GenerationProgressMessage,
  GenerationCompleteMessage,
  GenerationFailedMessage,
  QueueDiskFullMessage,
};

// API exposed to renderer
const forgeApi = {
  // SD binary management
  sd: {
    isInstalled: (): Promise<boolean> => ipcRenderer.invoke("sd:isInstalled"),
    install: (): Promise<boolean> => ipcRenderer.invoke("sd:install"),
    onInstallProgress: (callback: (progress: InstallProgress) => void) => {
      const handler = (_: unknown, progress: InstallProgress) =>
        callback(progress);
      ipcRenderer.on("sd:installProgress", handler);
      return () => ipcRenderer.removeListener("sd:installProgress", handler);
    },
  },

  // Model management
  models: {
    list: (): Promise<SdModel[]> => ipcRenderer.invoke("models:list"),
    installed: (): Promise<SdModel[]> => ipcRenderer.invoke("models:installed"),
    download: (modelId: string): Promise<string> =>
      ipcRenderer.invoke("models:download", modelId),
    onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
      const handler = (_: unknown, progress: DownloadProgress) =>
        callback(progress);
      ipcRenderer.on("models:downloadProgress", handler);
      return () =>
        ipcRenderer.removeListener("models:downloadProgress", handler);
    },
  },

  // Image generation
  generate: {
    image: (options: GenerateImageOptions): Promise<GenerateImageResult> =>
      ipcRenderer.invoke("generate:image", options),
    onProgress: (callback: (progress: GenerationProgress) => void) => {
      const handler = (_: unknown, progress: GenerationProgress) =>
        callback(progress);
      ipcRenderer.on("generate:progress", handler);
      return () => ipcRenderer.removeListener("generate:progress", handler);
    },
  },

  // Theme management
  themes: {
    list: (): Promise<Theme[]> => ipcRenderer.invoke("themes:list"),
    get: (id: string): Promise<Theme | null> =>
      ipcRenderer.invoke("themes:get", id),
    create: (input: CreateThemeInput): Promise<Theme> =>
      ipcRenderer.invoke("themes:create", input),
    update: (id: string, input: UpdateThemeInput): Promise<Theme> =>
      ipcRenderer.invoke("themes:update", id, input),
    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke("themes:delete", id),
  },

  // Template management
  templates: {
    list: (): Promise<Template[]> => ipcRenderer.invoke("templates:list"),
    get: (id: string): Promise<Template | null> =>
      ipcRenderer.invoke("templates:get", id),
    create: (input: CreateTemplateInput): Promise<Template> =>
      ipcRenderer.invoke("templates:create", input),
    update: (id: string, input: UpdateTemplateInput): Promise<Template> =>
      ipcRenderer.invoke("templates:update", id, input),
    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke("templates:delete", id),
  },

  // Output path utilities
  output: {
    buildPath: (options: {
      themeId: string | null;
      templateId: string | null;
      templateValues: Record<string, string> | null;
      variableOrder?: string[];
      seed: number;
      timestamp?: number;
    }): Promise<string> => ipcRenderer.invoke("output:buildPath", options),
  },

  // Queue management
  queue: {
    add: (request: GenerationRequest): Promise<{ id: string }> =>
      ipcRenderer.invoke("queue:add", request),
    cancel: (id: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke("queue:cancel", id),
    retry: (id: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke("queue:retry", id),
    list: (): Promise<QueueItem[]> => ipcRenderer.invoke("queue:list"),
    getStatus: (): Promise<QueueStatusMessage> =>
      ipcRenderer.invoke("queue:status"),

    // Event listeners for queue status updates
    onStatusChange: (callback: (status: QueueStatusMessage) => void) => {
      const handler = (_: unknown, status: QueueStatusMessage) =>
        callback(status);
      ipcRenderer.on("queue:status", handler);
      return () => ipcRenderer.removeListener("queue:status", handler);
    },
    onProgress: (callback: (progress: GenerationProgressMessage) => void) => {
      const handler = (_: unknown, progress: GenerationProgressMessage) =>
        callback(progress);
      ipcRenderer.on("generation:progress", handler);
      return () => ipcRenderer.removeListener("generation:progress", handler);
    },
    onComplete: (callback: (data: GenerationCompleteMessage) => void) => {
      const handler = (_: unknown, data: GenerationCompleteMessage) =>
        callback(data);
      ipcRenderer.on("generation:complete", handler);
      return () => ipcRenderer.removeListener("generation:complete", handler);
    },
    onFailed: (callback: (data: GenerationFailedMessage) => void) => {
      const handler = (_: unknown, data: GenerationFailedMessage) =>
        callback(data);
      ipcRenderer.on("generation:failed", handler);
      return () => ipcRenderer.removeListener("generation:failed", handler);
    },
    onDiskFull: (callback: (data: QueueDiskFullMessage) => void) => {
      const handler = (_: unknown, data: QueueDiskFullMessage) =>
        callback(data);
      ipcRenderer.on("queue:diskFull", handler);
      return () => ipcRenderer.removeListener("queue:diskFull", handler);
    },
  },

  // History browser
  history: {
    list: (options?: HistoryListOptions): Promise<GenerationRecord[]> =>
      ipcRenderer.invoke("history:list", options),
    count: (options?: {
      themeId?: string;
      templateId?: string;
    }): Promise<number> => ipcRenderer.invoke("history:count", options),
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld("forge", forgeApi);

// Type declaration for the renderer
export type ForgeApi = typeof forgeApi;
