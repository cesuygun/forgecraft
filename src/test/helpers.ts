// ABOUTME: Shared test helpers for all test suites
// ABOUTME: Provides temp directories and Electron mocks

import { vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

let tempDir: string | null = null;

// Mock Electron's app module before importing modules that use it
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
}));

export const getTempDir = (): string => {
	if (!tempDir) {
		tempDir = mkdtempSync(join(tmpdir(), "forgecraft-test-"));
	}
	return tempDir;
};

export const cleanupTempDir = (): void => {
	if (tempDir) {
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		tempDir = null;
	}
};

export const resetTempDir = (): void => {
	cleanupTempDir();
	tempDir = mkdtempSync(join(tmpdir(), "forgecraft-test-"));
};
