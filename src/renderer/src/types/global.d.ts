// ABOUTME: Global type declarations for renderer process
// ABOUTME: Declares window.forge API exposed by preload

import type {
	InstallProgress,
	GenerationProgress,
	GenerateImageOptions,
	GenerateImageResult,
} from "@shared/sd-cpp";
import type { SdModel, DownloadProgress } from "@shared/sd-models";

export interface ForgeApi {
	sd: {
		isInstalled: () => Promise<boolean>;
		install: () => Promise<boolean>;
		onInstallProgress: (callback: (progress: InstallProgress) => void) => () => void;
	};
	models: {
		list: () => Promise<SdModel[]>;
		installed: () => Promise<SdModel[]>;
		download: (modelId: string) => Promise<string>;
		onDownloadProgress: (callback: (progress: DownloadProgress) => void) => () => void;
	};
	generate: {
		image: (options: GenerateImageOptions) => Promise<GenerateImageResult>;
		onProgress: (callback: (progress: GenerationProgress) => void) => () => void;
	};
}

declare global {
	interface Window {
		forge: ForgeApi;
	}
}

export {};
