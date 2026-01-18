# Settings Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a Settings panel accessible from the sidebar that persists default generation settings to a JSON file.

**Architecture:** Settings stored as JSON in `~/.forgecraft/settings.json`. Main process handles load/save via IPC. Renderer displays SettingsView with form inputs. GenerationPanel reads settings on mount and uses them as defaults when no theme is selected.

**Tech Stack:** TypeScript, Electron IPC, React (functional components, hooks), JSON file storage

---

## Task 1: Create AppSettings Type in shared/types.ts

**Files:**
- Modify: `/Users/cesurhanuygun/iv/forgecraft/src/shared/types.ts`

**Step 1: Add AppSettings interface to shared types**

Add after the VALIDATION export (around line 180):

```typescript
// ============================================================================
// APP SETTINGS
// User-configurable defaults stored in settings.json
// ============================================================================

export interface AppSettings {
	defaultModel: string;
	defaultSteps: number;
	defaultCfgScale: number;
	defaultWidth: number;
	defaultHeight: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
	defaultModel: "dreamshaper-xl",
	defaultSteps: 20,
	defaultCfgScale: 7,
	defaultWidth: 512,
	defaultHeight: 512,
};
```

**Step 2: Run typecheck to verify syntax**

Run: `npm run typecheck`
Expected: PASS (no type errors)

**Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat(settings): add AppSettings type and defaults"
```

---

## Task 2: Create Settings Module in main/data/settings.ts

**Files:**
- Create: `/Users/cesurhanuygun/iv/forgecraft/src/main/data/settings.ts`

**Step 1: Write the failing test**

Create file: `/Users/cesurhanuygun/iv/forgecraft/src/main/data/__tests__/settings.test.ts`

```typescript
// ABOUTME: Tests for settings load/save operations
// ABOUTME: Verifies JSON file operations and validation

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import "./test-helpers";
import { cleanupTempDir, resetTempDir } from "./test-helpers";
import { getSettings, saveSettings, resetSettings } from "../settings";
import { DEFAULT_SETTINGS } from "../../../shared/types";
import type { AppSettings } from "../../../shared/types";

describe("Settings Operations", () => {
	beforeEach(() => {
		resetTempDir();
	});

	afterAll(() => {
		cleanupTempDir();
	});

	describe("getSettings", () => {
		it("should return default settings when no file exists", () => {
			const settings = getSettings();
			expect(settings).toEqual(DEFAULT_SETTINGS);
		});

		it("should return saved settings when file exists", () => {
			const custom: AppSettings = {
				defaultModel: "pixel-art-xl",
				defaultSteps: 30,
				defaultCfgScale: 10,
				defaultWidth: 1024,
				defaultHeight: 1024,
			};
			saveSettings(custom);

			const settings = getSettings();
			expect(settings).toEqual(custom);
		});
	});

	describe("saveSettings", () => {
		it("should save valid settings", () => {
			const custom: AppSettings = {
				defaultModel: "sdxl-base",
				defaultSteps: 50,
				defaultCfgScale: 15,
				defaultWidth: 768,
				defaultHeight: 768,
			};
			saveSettings(custom);

			const settings = getSettings();
			expect(settings.defaultModel).toBe("sdxl-base");
			expect(settings.defaultSteps).toBe(50);
		});

		it("should throw for steps out of range", () => {
			expect(() =>
				saveSettings({ ...DEFAULT_SETTINGS, defaultSteps: 0 })
			).toThrow("Steps must be between");

			expect(() =>
				saveSettings({ ...DEFAULT_SETTINGS, defaultSteps: 200 })
			).toThrow("Steps must be between");
		});

		it("should throw for cfgScale out of range", () => {
			expect(() =>
				saveSettings({ ...DEFAULT_SETTINGS, defaultCfgScale: 0 })
			).toThrow("CFG scale must be between");

			expect(() =>
				saveSettings({ ...DEFAULT_SETTINGS, defaultCfgScale: 50 })
			).toThrow("CFG scale must be between");
		});

		it("should throw for width not divisible by 8", () => {
			expect(() =>
				saveSettings({ ...DEFAULT_SETTINGS, defaultWidth: 513 })
			).toThrow("divisible by 8");
		});

		it("should throw for height out of range", () => {
			expect(() =>
				saveSettings({ ...DEFAULT_SETTINGS, defaultHeight: 32 })
			).toThrow("between 64 and 2048");
		});
	});

	describe("resetSettings", () => {
		it("should reset to default settings", () => {
			saveSettings({
				...DEFAULT_SETTINGS,
				defaultSteps: 100,
			});

			resetSettings();

			const settings = getSettings();
			expect(settings).toEqual(DEFAULT_SETTINGS);
		});
	});
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/main/data/__tests__/settings.test.ts`
Expected: FAIL with "Cannot find module '../settings'"

**Step 3: Write minimal implementation**

Create file: `/Users/cesurhanuygun/iv/forgecraft/src/main/data/settings.ts`

```typescript
// ABOUTME: Settings load/save operations
// ABOUTME: Persists app settings as JSON in ~/.forgecraft/settings.json

import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { getDataPath } from "../db/database";
import type { AppSettings } from "../../shared/types";
import { DEFAULT_SETTINGS, VALIDATION } from "../../shared/types";

const getSettingsPath = (): string => {
	return join(getDataPath(), "settings.json");
};

const validateSettings = (settings: AppSettings): string | null => {
	const v = VALIDATION.theme;

	if (settings.defaultSteps < v.steps.min || settings.defaultSteps > v.steps.max) {
		return `Steps must be between ${v.steps.min} and ${v.steps.max}`;
	}

	if (settings.defaultCfgScale < v.cfgScale.min || settings.defaultCfgScale > v.cfgScale.max) {
		return `CFG scale must be between ${v.cfgScale.min} and ${v.cfgScale.max}`;
	}

	if (
		settings.defaultWidth < v.dimensions.min ||
		settings.defaultWidth > v.dimensions.max ||
		settings.defaultWidth % v.dimensions.divisibleBy !== 0
	) {
		return `Width must be between ${v.dimensions.min} and ${v.dimensions.max}, divisible by ${v.dimensions.divisibleBy}`;
	}

	if (
		settings.defaultHeight < v.dimensions.min ||
		settings.defaultHeight > v.dimensions.max ||
		settings.defaultHeight % v.dimensions.divisibleBy !== 0
	) {
		return `Height must be between ${v.dimensions.min} and ${v.dimensions.max}, divisible by ${v.dimensions.divisibleBy}`;
	}

	return null;
};

export const getSettings = (): AppSettings => {
	const settingsPath = getSettingsPath();

	if (!existsSync(settingsPath)) {
		return { ...DEFAULT_SETTINGS };
	}

	try {
		const content = readFileSync(settingsPath, "utf-8");
		const parsed = JSON.parse(content) as Partial<AppSettings>;

		// Merge with defaults to ensure all fields exist
		return {
			...DEFAULT_SETTINGS,
			...parsed,
		};
	} catch (error) {
		console.error("[Settings] Failed to load settings:", error);
		return { ...DEFAULT_SETTINGS };
	}
};

export const saveSettings = (settings: AppSettings): void => {
	const error = validateSettings(settings);
	if (error) {
		throw new Error(error);
	}

	const settingsPath = getSettingsPath();
	writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
	console.log("[Settings] Saved settings");
};

export const resetSettings = (): void => {
	const settingsPath = getSettingsPath();
	if (existsSync(settingsPath)) {
		unlinkSync(settingsPath);
	}
	console.log("[Settings] Reset to defaults");
};
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/main/data/__tests__/settings.test.ts`
Expected: PASS

**Step 5: Export from data/index.ts**

Add to `/Users/cesurhanuygun/iv/forgecraft/src/main/data/index.ts`:

```typescript
export { getSettings, saveSettings, resetSettings } from "./settings";
```

**Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 7: Commit**

```bash
git add src/main/data/settings.ts src/main/data/__tests__/settings.test.ts src/main/data/index.ts
git commit -m "feat(settings): add settings module with load/save/reset"
```

---

## Task 3: Add Settings IPC Handlers to main/index.ts

**Files:**
- Modify: `/Users/cesurhanuygun/iv/forgecraft/src/main/index.ts`

**Step 1: Add imports**

At the top of the file, add to the data imports:

```typescript
import {
	listThemes,
	getTheme,
	createTheme,
	updateTheme,
	deleteTheme,
	listTemplates,
	getTemplate,
	createTemplate,
	updateTemplate,
	deleteTemplate,
	buildOutputPath,
	getSettings,
	saveSettings,
} from "./data";
```

Also add the AppSettings type import:

```typescript
import type { AppSettings } from "../shared/types";
```

**Step 2: Add IPC handlers**

Add after the History IPC Handlers section (around line 295):

```typescript
// ============================================================================
// Settings IPC Handlers
// ============================================================================

ipcMain.handle("settings:get", () => getSettings());

ipcMain.handle(
	"settings:set",
	(_event: IpcMainInvokeEvent, settings: unknown) => {
		saveSettings(assertObject<AppSettings>(settings, "settings"));
		return getSettings();
	}
);
```

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/main/index.ts
git commit -m "feat(settings): add IPC handlers for settings get/set"
```

---

## Task 4: Extend Preload API with Settings Methods

**Files:**
- Modify: `/Users/cesurhanuygun/iv/forgecraft/src/preload/index.ts`

**Step 1: Add AppSettings type import**

Add to the imports from shared/types (around line 28):

```typescript
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
} from "../shared/types";
```

**Step 2: Add re-export for AppSettings**

Add to the re-exports (around line 61):

```typescript
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
	AppSettings,
};
```

**Step 3: Add settings API to forgeApi**

Add after the history section (around line 195):

```typescript
// Settings management
settings: {
	get: (): Promise<AppSettings> => ipcRenderer.invoke("settings:get"),
	set: (settings: AppSettings): Promise<AppSettings> =>
		ipcRenderer.invoke("settings:set", settings),
},
```

**Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat(settings): add settings API to preload"
```

---

## Task 5: Add Settings View Type to Forge Component

**Files:**
- Modify: `/Users/cesurhanuygun/iv/forgecraft/src/renderer/src/components/Forge.tsx`

**Step 1: Extend View type**

Change the View type from:

```typescript
export type View = "themes" | "templates" | "history" | "queue";
```

To:

```typescript
export type View = "themes" | "templates" | "history" | "queue" | "settings";
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: FAIL (Canvas.tsx missing VIEW_TITLES for settings)

**Step 3: Commit (will commit with Canvas changes in next task)**

---

## Task 6: Update Sidebar to Navigate to Settings

**Files:**
- Modify: `/Users/cesurhanuygun/iv/forgecraft/src/renderer/src/components/Sidebar.tsx`

**Step 1: Update settings button to call onViewChange**

Replace the current handleSettingsClick and button:

```typescript
const handleSettingsClick = () => {
	// Settings panel will be implemented in Phase 5
	console.log("Settings clicked - not yet implemented");
};
```

And remove the standalone settings button. Instead, add settings to the VIEWS array but keep it separate in the footer:

```typescript
import type { View } from "./Forge";

interface Props {
	activeView: View;
	onViewChange: (view: View) => void;
}

const VIEWS: { id: View; label: string; icon: string }[] = [
	{ id: "themes", label: "Themes", icon: "P" },
	{ id: "templates", label: "Templates", icon: "T" },
	{ id: "history", label: "History", icon: "H" },
	{ id: "queue", label: "Queue", icon: "Q" },
];

export const Sidebar = ({ activeView, onViewChange }: Props) => {
	return (
		<nav className="sidebar">
			<div className="sidebar-header">
				<span className="logo">F</span>
				<span className="title">Forgecraft</span>
			</div>

			<div className="sidebar-nav">
				{VIEWS.map((view) => (
					<button
						key={view.id}
						className={`nav-item ${activeView === view.id ? "active" : ""}`}
						onClick={() => onViewChange(view.id)}
					>
						<span className="icon">{view.icon}</span>
						<span className="label">{view.label}</span>
					</button>
				))}
			</div>

			<div className="sidebar-footer">
				<button
					className={`nav-item ${activeView === "settings" ? "active" : ""}`}
					onClick={() => onViewChange("settings")}
				>
					<span className="icon">S</span>
					<span className="label">Settings</span>
				</button>
			</div>
		</nav>
	);
};
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (Sidebar is fine, Canvas still has issues)

---

## Task 7: Create SettingsView Component and Update Canvas

**Files:**
- Modify: `/Users/cesurhanuygun/iv/forgecraft/src/renderer/src/components/Canvas.tsx`

**Step 1: Add VIEW_TITLES entry for settings**

Update VIEW_TITLES:

```typescript
const VIEW_TITLES: Record<View, string> = {
	themes: "Themes",
	templates: "Templates",
	history: "History",
	queue: "Queue",
	settings: "Settings",
};
```

**Step 2: Add settings view conditional rendering**

In the Canvas component return, add:

```typescript
{view === "settings" && <SettingsView />}
```

**Step 3: Create SettingsView component**

Add the SettingsView component (after QueueView or before the Canvas export):

```typescript
const SettingsView = () => {
	const [settings, setSettings] = useState<AppSettings | null>(null);
	const [installedModels, setInstalledModels] = useState<SdModel[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [saveSuccess, setSaveSuccess] = useState(false);

	// Form state
	const [formModel, setFormModel] = useState("");
	const [formSteps, setFormSteps] = useState("20");
	const [formCfgScale, setFormCfgScale] = useState("7");
	const [formWidth, setFormWidth] = useState("512");
	const [formHeight, setFormHeight] = useState("512");

	const loadSettings = useCallback(async () => {
		try {
			setError(null);
			const [loadedSettings, models] = await Promise.all([
				window.forge.settings.get(),
				window.forge.models.installed(),
			]);
			setSettings(loadedSettings);
			setInstalledModels(models);

			// Initialize form with loaded settings
			setFormModel(loadedSettings.defaultModel);
			setFormSteps(String(loadedSettings.defaultSteps));
			setFormCfgScale(String(loadedSettings.defaultCfgScale));
			setFormWidth(String(loadedSettings.defaultWidth));
			setFormHeight(String(loadedSettings.defaultHeight));
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load settings");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		loadSettings();
	}, [loadSettings]);

	const handleSave = async () => {
		setSaveError(null);
		setSaveSuccess(false);
		setIsSaving(true);

		try {
			const updatedSettings: AppSettings = {
				defaultModel: formModel,
				defaultSteps: parseInt(formSteps, 10),
				defaultCfgScale: parseFloat(formCfgScale),
				defaultWidth: parseInt(formWidth, 10),
				defaultHeight: parseInt(formHeight, 10),
			};

			await window.forge.settings.set(updatedSettings);
			setSettings(updatedSettings);
			setSaveSuccess(true);

			// Clear success message after 3 seconds
			setTimeout(() => setSaveSuccess(false), 3000);
		} catch (err) {
			setSaveError(err instanceof Error ? err.message : "Failed to save settings");
		} finally {
			setIsSaving(false);
		}
	};

	const handleReset = () => {
		if (settings) {
			setFormModel(settings.defaultModel);
			setFormSteps(String(settings.defaultSteps));
			setFormCfgScale(String(settings.defaultCfgScale));
			setFormWidth(String(settings.defaultWidth));
			setFormHeight(String(settings.defaultHeight));
		}
		setSaveError(null);
		setSaveSuccess(false);
	};

	if (isLoading) {
		return (
			<div className="settings-view">
				<div className="loading-state">
					<div className="loading-spinner" />
					<p>Loading settings...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="settings-view">
				<div className="error-state">
					<span className="icon">!</span>
					<h3>Error Loading Settings</h3>
					<p>{error}</p>
					<button className="primary" onClick={loadSettings}>
						Retry
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="settings-view">
			<div className="settings-section">
				<h3 className="section-title">Default Generation Settings</h3>
				<p className="section-description">
					These settings are used when no theme is selected.
				</p>

				<div className="settings-form">
					<div className="form-field">
						<label htmlFor="settings-model">Default Model</label>
						<select
							id="settings-model"
							value={formModel}
							onChange={(e) => setFormModel(e.target.value)}
						>
							{installedModels.length === 0 ? (
								<option value={formModel}>{formModel} (not installed)</option>
							) : (
								installedModels.map((model) => (
									<option key={model.id} value={model.id}>
										{model.name}
									</option>
								))
							)}
						</select>
						{installedModels.length === 0 && (
							<p className="field-hint warning">
								No models installed. Download models from the setup screen.
							</p>
						)}
					</div>

					<div className="form-row">
						<div className="form-field">
							<label htmlFor="settings-steps">Steps</label>
							<input
								id="settings-steps"
								type="number"
								min="1"
								max="150"
								value={formSteps}
								onChange={(e) => setFormSteps(e.target.value)}
							/>
							<p className="field-hint">Range: 1-150</p>
						</div>

						<div className="form-field">
							<label htmlFor="settings-cfg">CFG Scale</label>
							<input
								id="settings-cfg"
								type="number"
								min="1"
								max="30"
								step="0.5"
								value={formCfgScale}
								onChange={(e) => setFormCfgScale(e.target.value)}
							/>
							<p className="field-hint">Range: 1-30</p>
						</div>
					</div>

					<div className="form-row">
						<div className="form-field">
							<label htmlFor="settings-width">Width</label>
							<input
								id="settings-width"
								type="number"
								min="64"
								max="2048"
								step="8"
								value={formWidth}
								onChange={(e) => setFormWidth(e.target.value)}
							/>
							<p className="field-hint">64-2048, divisible by 8</p>
						</div>

						<div className="form-field">
							<label htmlFor="settings-height">Height</label>
							<input
								id="settings-height"
								type="number"
								min="64"
								max="2048"
								step="8"
								value={formHeight}
								onChange={(e) => setFormHeight(e.target.value)}
							/>
							<p className="field-hint">64-2048, divisible by 8</p>
						</div>
					</div>

					{saveError && (
						<div className="form-error">
							<span className="error-icon">!</span>
							{saveError}
						</div>
					)}

					{saveSuccess && (
						<div className="form-success">
							Settings saved successfully!
						</div>
					)}

					<div className="form-actions">
						<button onClick={handleReset} disabled={isSaving}>
							Reset
						</button>
						<button className="primary" onClick={handleSave} disabled={isSaving}>
							{isSaving ? "Saving..." : "Save Settings"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
```

**Step 4: Add imports to Canvas.tsx**

Add at the top of Canvas.tsx:

```typescript
import type { AppSettings } from "@shared/types";
import type { SdModel } from "../../../../preload";
```

**Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add src/renderer/src/components/Forge.tsx src/renderer/src/components/Sidebar.tsx src/renderer/src/components/Canvas.tsx
git commit -m "feat(settings): add SettingsView component and navigation"
```

---

## Task 8: Update GenerationPanel to Use Settings

**Files:**
- Modify: `/Users/cesurhanuygun/iv/forgecraft/src/renderer/src/components/GenerationPanel.tsx`

**Step 1: Add state for settings**

Add import at top:

```typescript
import type { AppSettings } from "@shared/types";
```

Add state after the queueProgress state (around line 55):

```typescript
// App settings for defaults
const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
```

**Step 2: Load settings on mount**

Add a useEffect to load settings (after the load templates effect, around line 82):

```typescript
// Load app settings on mount
useEffect(() => {
	const loadSettings = async () => {
		try {
			const settings = await window.forge.settings.get();
			setAppSettings(settings);
		} catch (err) {
			console.error("Failed to load settings:", err);
		}
	};
	loadSettings();
}, []);
```

**Step 3: Update handleGenerate to use settings**

In handleGenerate function (around line 287-291), change the hardcoded defaults to use appSettings:

```typescript
// Use theme defaults if available, otherwise use app settings, finally hardcoded defaults
const model = currentTheme?.defaults.model || appSettings?.defaultModel || "dreamshaper-xl";
const width = currentTheme?.defaults.width || appSettings?.defaultWidth || 512;
const height = currentTheme?.defaults.height || appSettings?.defaultHeight || 512;
const steps = currentTheme?.defaults.steps || appSettings?.defaultSteps || 20;
const cfgScale = currentTheme?.defaults.cfgScale || appSettings?.defaultCfgScale || 7;
```

**Step 4: Update handleGenerateAll similarly**

In handleGenerateAll function (around line 354-359), apply the same change:

```typescript
// Use theme defaults if available, otherwise use app settings, finally hardcoded defaults
const model = currentTheme?.defaults.model || appSettings?.defaultModel || "dreamshaper-xl";
const width = currentTheme?.defaults.width || appSettings?.defaultWidth || 512;
const height = currentTheme?.defaults.height || appSettings?.defaultHeight || 512;
const steps = currentTheme?.defaults.steps || appSettings?.defaultSteps || 20;
const cfgScale = currentTheme?.defaults.cfgScale || appSettings?.defaultCfgScale || 7;
```

**Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 6: Run all tests**

Run: `npm test`
Expected: PASS

**Step 7: Commit**

```bash
git add src/renderer/src/components/GenerationPanel.tsx
git commit -m "feat(settings): integrate app settings into GenerationPanel defaults"
```

---

## Task 9: Add CSS Styles for Settings View

**Files:**
- Modify: `/Users/cesurhanuygun/iv/forgecraft/src/renderer/src/assets/main.css`

**Step 1: Add settings view styles**

Add to the CSS file (find the appropriate section or add at the end):

```css
/* Settings View */
.settings-view {
	padding: 24px;
	max-width: 600px;
}

.settings-section {
	background: var(--card-bg);
	border-radius: 8px;
	padding: 24px;
}

.section-title {
	font-size: 18px;
	font-weight: 600;
	margin: 0 0 8px 0;
}

.section-description {
	color: var(--text-secondary);
	margin: 0 0 24px 0;
}

.settings-form {
	display: flex;
	flex-direction: column;
	gap: 20px;
}

.form-field {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.form-field label {
	font-weight: 500;
	font-size: 14px;
}

.form-row {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 16px;
}

.field-hint {
	font-size: 12px;
	color: var(--text-secondary);
	margin: 0;
}

.field-hint.warning {
	color: var(--warning-color, #f59e0b);
}

.form-error {
	background: var(--error-bg, rgba(239, 68, 68, 0.1));
	border: 1px solid var(--error-color, #ef4444);
	color: var(--error-color, #ef4444);
	padding: 12px;
	border-radius: 6px;
	display: flex;
	align-items: center;
	gap: 8px;
}

.error-icon {
	font-weight: bold;
}

.form-success {
	background: var(--success-bg, rgba(34, 197, 94, 0.1));
	border: 1px solid var(--success-color, #22c55e);
	color: var(--success-color, #22c55e);
	padding: 12px;
	border-radius: 6px;
}

.form-actions {
	display: flex;
	justify-content: flex-end;
	gap: 12px;
	margin-top: 8px;
}
```

**Step 2: Run dev server to verify styles**

Run: `npm run dev`
Expected: App launches, Settings view displays correctly

**Step 3: Commit**

```bash
git add src/renderer/src/assets/main.css
git commit -m "feat(settings): add CSS styles for SettingsView"
```

---

## Task 10: Final Integration Test and Cleanup

**Step 1: Run all tests**

Run: `npm test`
Expected: PASS

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Run lint**

Run: `npm run lint`
Expected: PASS (fix any issues if present)

**Step 4: Manual testing checklist**

Run: `npm run dev`

Test the following:
- [ ] Navigate to Settings via sidebar
- [ ] Settings form displays with current values
- [ ] Model dropdown shows installed models (or warning if none)
- [ ] Changing values and clicking Save persists settings
- [ ] Invalid values show error messages
- [ ] Reset button restores to last saved values
- [ ] After saving settings, generate an image without a theme selected
- [ ] Verify the generated image uses the saved settings values

**Step 5: Final commit if any cleanup needed**

```bash
git status
# If there are any remaining changes:
git add .
git commit -m "chore(settings): cleanup and final adjustments"
```

---

## Summary

This plan implements the Settings panel feature with:

1. **AppSettings type** - Shared type definition with defaults
2. **Settings module** - JSON file load/save with validation
3. **IPC handlers** - Main process handlers for get/set
4. **Preload API** - Exposed settings methods to renderer
5. **SettingsView** - React component with form inputs
6. **Sidebar navigation** - Updated to include Settings
7. **GenerationPanel integration** - Uses settings as defaults
8. **CSS styles** - Visual styling for the settings form

The settings persist across app restarts via `~/.forgecraft/settings.json`.
