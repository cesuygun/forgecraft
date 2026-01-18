// ABOUTME: Global type declarations for renderer process
// ABOUTME: Declares window.forge API exposed by preload

import type {
  InstallProgress,
  GenerationProgress,
  GenerateImageOptions,
  GenerateImageResult,
} from "@shared/sd-cpp";
import type { SdModel, DownloadProgress } from "@shared/sd-models";
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
  AppSettings,
} from "@shared/types";

// History list filter options
export interface HistoryListOptions {
  themeId?: string;
  templateId?: string;
  limit?: number;
  offset?: number;
}

export interface ForgeApi {
  sd: {
    isInstalled: () => Promise<boolean>;
    install: () => Promise<boolean>;
    onInstallProgress: (
      callback: (progress: InstallProgress) => void,
    ) => () => void;
  };
  models: {
    list: () => Promise<SdModel[]>;
    installed: () => Promise<SdModel[]>;
    download: (modelId: string) => Promise<string>;
    onDownloadProgress: (
      callback: (progress: DownloadProgress) => void,
    ) => () => void;
  };
  generate: {
    image: (options: GenerateImageOptions) => Promise<GenerateImageResult>;
    onProgress: (
      callback: (progress: GenerationProgress) => void,
    ) => () => void;
  };
  themes: {
    list: () => Promise<Theme[]>;
    get: (id: string) => Promise<Theme | null>;
    create: (input: CreateThemeInput) => Promise<Theme>;
    update: (id: string, input: UpdateThemeInput) => Promise<Theme>;
    delete: (id: string) => Promise<boolean>;
    onChange: (callback: () => void) => () => void;
  };
  templates: {
    list: () => Promise<Template[]>;
    get: (id: string) => Promise<Template | null>;
    create: (input: CreateTemplateInput) => Promise<Template>;
    update: (id: string, input: UpdateTemplateInput) => Promise<Template>;
    delete: (id: string) => Promise<boolean>;
    onChange: (callback: () => void) => () => void;
  };
  output: {
    buildPath: (options: {
      themeId: string | null;
      templateId: string | null;
      templateValues: Record<string, string> | null;
      variableOrder?: string[];
      seed: number;
      timestamp?: number;
    }) => Promise<string>;
  };
  queue: {
    add: (request: GenerationRequest) => Promise<{ id: string }>;
    cancel: (id: string) => Promise<{ success: boolean }>;
    retry: (id: string) => Promise<{ success: boolean }>;
    list: () => Promise<QueueItem[]>;
    getStatus: () => Promise<QueueStatusMessage>;
    onStatusChange: (
      callback: (status: QueueStatusMessage) => void,
    ) => () => void;
    onProgress: (
      callback: (progress: GenerationProgressMessage) => void,
    ) => () => void;
    onComplete: (
      callback: (data: GenerationCompleteMessage) => void,
    ) => () => void;
    onFailed: (callback: (data: GenerationFailedMessage) => void) => () => void;
    onDiskFull: (callback: (data: QueueDiskFullMessage) => void) => () => void;
  };
  history: {
    list: (options?: HistoryListOptions) => Promise<GenerationRecord[]>;
    count: (options?: { themeId?: string; templateId?: string }) => Promise<number>;
  };
  settings: {
    get: () => Promise<AppSettings>;
    set: (settings: AppSettings) => Promise<AppSettings>;
  };
}

declare global {
  interface Window {
    forge: ForgeApi;
  }
}

export {};
