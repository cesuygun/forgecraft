// ABOUTME: Generation panel component for creating images
// ABOUTME: Handles theme/template selection and image generation via queue

import { useState, useEffect, useMemo } from "react";
import type {
	Theme,
	Template,
	QueueStatusMessage,
	GenerationProgressMessage,
	GenerationCompleteMessage,
	GenerationFailedMessage,
	AppSettings,
} from "@shared/types";
import {
	computeCombinations,
	countCombinations,
	type VariableAxis,
} from "@shared/generate-all";

interface GenerationPanelProps {
	onNavigateToQueue?: () => void;
}

export const GenerationPanel = ({ onNavigateToQueue }: GenerationPanelProps) => {
	const [selectedTheme, setSelectedTheme] = useState<string>("");
	const [selectedTemplate, setSelectedTemplate] = useState<string>("");
	const [rawPrompt, setRawPrompt] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);
	const [progress, setProgress] = useState(0);

	// Theme data from API
	const [themes, setThemes] = useState<Theme[]>([]);
	const [currentTheme, setCurrentTheme] = useState<Theme | null>(null);

	// Template data from API
	const [templates, setTemplates] = useState<Template[]>([]);
	const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null);
	const [variableSelections, setVariableSelections] = useState<
		Record<string, string>
	>({});
	// Track which variables have "All" selected for Generate All feature
	const [allSelections, setAllSelections] = useState<Record<string, boolean>>(
		{}
	);

	// Queue status from events
	const [queueStatus, setQueueStatus] = useState<QueueStatusMessage>({
		pending: 0,
		generating: null,
		completed: 0,
		failed: 0,
	});
	// Track the ID of the current generation request for progress tracking
	const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
	// Track progress of the currently generating queue item (for mini status display)
	const [queueProgress, setQueueProgress] = useState<number>(0);

	// App settings for defaults
	const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

	// Load themes on mount
	useEffect(() => {
		const loadThemes = async () => {
			try {
				const list = await window.forge.themes.list();
				setThemes(list);
			} catch (err) {
				console.error("Failed to load themes:", err);
			}
		};
		loadThemes();
	}, []);

	// Load templates on mount
	useEffect(() => {
		const loadTemplates = async () => {
			try {
				const list = await window.forge.templates.list();
				setTemplates(list);
			} catch (err) {
				console.error("Failed to load templates:", err);
			}
		};
		loadTemplates();
	}, []);

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

	// Update current theme when selection changes
	useEffect(() => {
		if (selectedTheme) {
			const theme = themes.find((t) => t.id === selectedTheme);
			setCurrentTheme(theme || null);
		} else {
			setCurrentTheme(null);
		}
	}, [selectedTheme, themes]);

	// Update current template and reset variable selections when selection changes
	useEffect(() => {
		if (selectedTemplate) {
			const template = templates.find((t) => t.id === selectedTemplate);
			setCurrentTemplate(template || null);
			// Initialize variable selections with first option for each variable
			// Initialize all selections to false (specific value selected, not "All")
			if (template) {
				const initialSelections: Record<string, string> = {};
				const initialAllSelections: Record<string, boolean> = {};
				template.variables.forEach((variable) => {
					if (variable.options.length > 0) {
						initialSelections[variable.name] = variable.options[0].id;
					}
					initialAllSelections[variable.name] = false;
				});
				setVariableSelections(initialSelections);
				setAllSelections(initialAllSelections);
			} else {
				setVariableSelections({});
				setAllSelections({});
			}
		} else {
			setCurrentTemplate(null);
			setVariableSelections({});
			setAllSelections({});
		}
	}, [selectedTemplate, templates]);

	// Subscribe to queue events
	useEffect(() => {
		// Load initial queue status
		const loadQueueStatus = async () => {
			try {
				const status = await window.forge.queue.getStatus();
				setQueueStatus(status);
				setIsGenerating(status.generating !== null);
			} catch (err) {
				console.error("Failed to load queue status:", err);
			}
		};
		loadQueueStatus();

		// Subscribe to queue status changes
		const unsubStatus = window.forge.queue.onStatusChange((status) => {
			setQueueStatus(status);
			setIsGenerating(status.generating !== null);
			// Reset queue progress when a new generation starts
			if (status.generating !== null) {
				setQueueProgress(0);
			}
		});

		// Subscribe to generation progress - track for both our request and overall queue
		const unsubProgress = window.forge.queue.onProgress(
			(progressMsg: GenerationProgressMessage) => {
				// Track progress for our own request
				if (progressMsg.requestId === currentRequestId) {
					setProgress(progressMsg.percent);
				}
				// Track progress for the mini queue status display
				setQueueProgress(progressMsg.percent);
			}
		);

		// Subscribe to generation complete
		const unsubComplete = window.forge.queue.onComplete(
			(data: GenerationCompleteMessage) => {
				if (data.requestId === currentRequestId) {
					console.log("Generation complete:", data.outputPath);
					setCurrentRequestId(null);
					setProgress(0);
				}
				// Reset queue progress on completion
				setQueueProgress(0);
			}
		);

		// Subscribe to generation failed
		const unsubFailed = window.forge.queue.onFailed(
			(data: GenerationFailedMessage) => {
				if (data.requestId === currentRequestId) {
					console.error("Generation failed:", data.error);
					setCurrentRequestId(null);
					setProgress(0);
				}
				// Reset queue progress on failure
				setQueueProgress(0);
			}
		);

		return () => {
			unsubStatus();
			unsubProgress();
			unsubComplete();
			unsubFailed();
		};
	}, [currentRequestId]);

	const showRawPromptInput = !selectedTemplate;
	const canGenerate = showRawPromptInput ? rawPrompt.trim() : selectedTemplate;

	// Build prompt from template pattern and variable selections
	const buildPromptFromTemplate = (): string => {
		if (!currentTemplate) return "";

		let prompt = currentTemplate.promptPattern;
		currentTemplate.variables.forEach((variable) => {
			const selectedOptionId = variableSelections[variable.name];
			const selectedOption = variable.options.find(
				(o) => o.id === selectedOptionId
			);
			if (selectedOption) {
				prompt = prompt.replace(
					new RegExp(`\\{${variable.name}\\}`, "g"),
					selectedOption.promptFragment
				);
			}
		});
		return prompt;
	};

	const handleVariableChange = (variableName: string, optionId: string) => {
		setVariableSelections((prev) => ({
			...prev,
			[variableName]: optionId,
		}));
	};

	const handleAllChange = (variableName: string, isAll: boolean) => {
		setAllSelections((prev) => ({
			...prev,
			[variableName]: isAll,
		}));
	};

	// Build variable axes for combination calculation
	const variableAxes: VariableAxis[] = useMemo(() => {
		if (!currentTemplate) return [];
		return currentTemplate.variables.map((variable) => ({
			name: variable.name,
			options: variable.options,
			selectAll: allSelections[variable.name] ?? false,
			selectedId: variableSelections[variable.name],
		}));
	}, [currentTemplate, allSelections, variableSelections]);

	// Calculate combination count for Generate All button
	const combinationCount = useMemo(() => {
		return countCombinations(variableAxes);
	}, [variableAxes]);

	// Check if any variable has "All" selected
	const hasAnyAllSelected = useMemo(() => {
		return Object.values(allSelections).some((v) => v);
	}, [allSelections]);

	// Build prompt from template pattern and specific variable values
	const buildPromptFromVariableValues = (
		templateValues: Record<string, string>
	): string => {
		if (!currentTemplate) return "";

		let prompt = currentTemplate.promptPattern;
		currentTemplate.variables.forEach((variable) => {
			const selectedOptionId = templateValues[variable.name];
			const selectedOption = variable.options.find(
				(o) => o.id === selectedOptionId
			);
			if (selectedOption) {
				prompt = prompt.replace(
					new RegExp(`\\{${variable.name}\\}`, "g"),
					selectedOption.promptFragment
				);
			}
		});
		return prompt;
	};

	const handleGenerate = async () => {
		if (!canGenerate || isGenerating) return;

		try {
			// Build final prompt: from template or raw prompt, combined with theme style
			const basePrompt = selectedTemplate
				? buildPromptFromTemplate()
				: rawPrompt.trim();
			let finalPrompt = basePrompt;
			if (currentTheme && currentTheme.stylePrompt) {
				// Theme stylePrompt is prepended per design doc
				finalPrompt = `${currentTheme.stylePrompt}, ${basePrompt}`;
			}

			// Use theme defaults if available, otherwise use app settings, finally hardcoded defaults
			const model = currentTheme?.defaults.model || appSettings?.defaultModel || "dreamshaper-xl";
			const width = currentTheme?.defaults.width || appSettings?.defaultWidth || 512;
			const height = currentTheme?.defaults.height || appSettings?.defaultHeight || 512;
			const steps = currentTheme?.defaults.steps || appSettings?.defaultSteps || 20;
			const cfgScale = currentTheme?.defaults.cfgScale || appSettings?.defaultCfgScale || 7;
			const negativePrompt = currentTheme?.negativePrompt || "";

			// Generate a unique request ID
			const requestId = `gen-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

			// Build templateValues if using a template
			const templateValues = selectedTemplate ? variableSelections : null;

			// Get variable order from the template for consistent path generation
			const variableOrder = currentTemplate
				? currentTemplate.variables.map((v) => v.name)
				: undefined;

			// Use a random seed for now (null means the queue service will generate one)
			const seed = Math.floor(Math.random() * 2147483647);
			const timestamp = Date.now();

			// Build output path via IPC
			const outputPath = await window.forge.output.buildPath({
				themeId: selectedTheme || null,
				templateId: selectedTemplate || null,
				templateValues,
				variableOrder,
				seed,
				timestamp,
			});

			// Build the generation request
			const request = {
				id: requestId,
				themeId: selectedTheme || null,
				templateId: selectedTemplate || null,
				templateValues,
				prompt: finalPrompt,
				negativePrompt,
				model,
				width,
				height,
				steps,
				cfgScale,
				seed,
				outputPath,
			};

			// Add to queue
			const result = await window.forge.queue.add(request);
			setCurrentRequestId(result.id);
			setProgress(0);
			console.log("Added to queue:", result.id);
		} catch (err) {
			console.error("Failed to add to queue:", err);
		}
	};

	const handleGenerateAll = async () => {
		if (!currentTemplate || !hasAnyAllSelected) return;

		try {
			// Compute all combinations based on current selections
			const combinations = computeCombinations(variableAxes);

			// Use theme defaults if available, otherwise use app settings, finally hardcoded defaults
			const model = currentTheme?.defaults.model || appSettings?.defaultModel || "dreamshaper-xl";
			const width = currentTheme?.defaults.width || appSettings?.defaultWidth || 512;
			const height = currentTheme?.defaults.height || appSettings?.defaultHeight || 512;
			const steps = currentTheme?.defaults.steps || appSettings?.defaultSteps || 20;
			const cfgScale = currentTheme?.defaults.cfgScale || appSettings?.defaultCfgScale || 7;
			const negativePrompt = currentTheme?.negativePrompt || "";

			// Get variable order from the template for consistent path generation
			const variableOrder = currentTemplate.variables.map((v) => v.name);

			// Queue each combination
			for (const templateValues of combinations) {
				// Build prompt for this combination
				const basePrompt = buildPromptFromVariableValues(templateValues);
				let finalPrompt = basePrompt;
				if (currentTheme && currentTheme.stylePrompt) {
					finalPrompt = `${currentTheme.stylePrompt}, ${basePrompt}`;
				}

				// Generate a unique request ID
				const requestId = `gen-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

				// Use a random seed for each image
				const seed = Math.floor(Math.random() * 2147483647);
				const timestamp = Date.now();

				// Build output path via IPC
				const outputPath = await window.forge.output.buildPath({
					themeId: selectedTheme || null,
					templateId: selectedTemplate || null,
					templateValues,
					variableOrder,
					seed,
					timestamp,
				});

				// Build the generation request
				const request = {
					id: requestId,
					themeId: selectedTheme || null,
					templateId: selectedTemplate || null,
					templateValues,
					prompt: finalPrompt,
					negativePrompt,
					model,
					width,
					height,
					steps,
					cfgScale,
					seed,
					outputPath,
				};

				// Add to queue
				await window.forge.queue.add(request);
				console.log("Added to queue:", requestId);
			}

			console.log(`Added ${combinations.length} items to queue`);
		} catch (err) {
			console.error("Failed to add to queue:", err);
		}
	};

	return (
		<aside className="generation-panel">
			<div className="panel-header">
				<h3>Generate</h3>
			</div>

			<div className="panel-content">
				<div className="field">
					<label>Theme</label>
					<select
						value={selectedTheme}
						onChange={(e) => setSelectedTheme(e.target.value)}
					>
						<option value="">None</option>
						{themes.map((theme) => (
							<option key={theme.id} value={theme.id}>
								{theme.name}
							</option>
						))}
					</select>
					{currentTheme && (
						<p className="field-note theme-hint">
							Style: {currentTheme.stylePrompt.length > 50
								? `${currentTheme.stylePrompt.substring(0, 50)}...`
								: currentTheme.stylePrompt}
						</p>
					)}
				</div>

				<div className="field">
					<label>Template</label>
					<select
						value={selectedTemplate}
						onChange={(e) => setSelectedTemplate(e.target.value)}
					>
						<option value="">None (Raw Prompt)</option>
						{templates.map((template) => (
							<option key={template.id} value={template.id}>
								{template.name}
							</option>
						))}
					</select>
				</div>

				{showRawPromptInput && (
					<div className="field">
						<label>Prompt</label>
						<textarea
							value={rawPrompt}
							onChange={(e) => setRawPrompt(e.target.value)}
							placeholder="Describe what you want to generate..."
							rows={4}
						/>
					</div>
				)}

				{/* Dynamic variables when template is selected */}
				{currentTemplate && currentTemplate.variables.length > 0 && (
					<div className="template-variables-section">
						<label className="section-label">Template Variables</label>
						{currentTemplate.variables.map((variable) => (
							<div key={variable.name} className="field variable-field">
								<div className="variable-header">
									<label>{variable.name}</label>
									<label className="all-checkbox">
										<input
											type="checkbox"
											checked={allSelections[variable.name] ?? false}
											onChange={(e) =>
												handleAllChange(variable.name, e.target.checked)
											}
										/>
										All
									</label>
								</div>
								<select
									value={variableSelections[variable.name] || ""}
									onChange={(e) =>
										handleVariableChange(variable.name, e.target.value)
									}
									disabled={allSelections[variable.name] ?? false}
								>
									{variable.options.map((option) => (
										<option key={option.id} value={option.id}>
											{option.label}
										</option>
									))}
								</select>
							</div>
						))}
						<p className="field-note template-preview">
							Preview: {buildPromptFromTemplate()}
						</p>
					</div>
				)}

				{currentTheme && (
					<div className="theme-defaults-preview">
						<label>Theme Settings</label>
						<div className="defaults-grid">
							<span className="default-item">
								<span className="default-label">Model:</span>
								<span className="default-value">{currentTheme.defaults.model}</span>
							</span>
							<span className="default-item">
								<span className="default-label">Size:</span>
								<span className="default-value">
									{currentTheme.defaults.width}x{currentTheme.defaults.height}
								</span>
							</span>
							<span className="default-item">
								<span className="default-label">Steps:</span>
								<span className="default-value">{currentTheme.defaults.steps}</span>
							</span>
							<span className="default-item">
								<span className="default-label">CFG:</span>
								<span className="default-value">{currentTheme.defaults.cfgScale}</span>
							</span>
						</div>
					</div>
				)}

				{isGenerating && (
					<div className="generation-progress">
						<div className="progress-bar">
							<div
								className="progress-fill"
								style={{ width: `${progress}%` }}
							/>
						</div>
						<span>{progress}%</span>
					</div>
				)}

				<div className="generate-buttons">
					<button
						className="generate-btn primary"
						onClick={handleGenerate}
						disabled={!canGenerate || isGenerating}
					>
						{isGenerating ? "Generating..." : "Generate"}
					</button>

					{selectedTemplate && (
						<button
							className="generate-btn"
							onClick={handleGenerateAll}
							disabled={!hasAnyAllSelected || isGenerating}
						>
							Generate All{hasAnyAllSelected ? `: ${combinationCount}` : ""}
						</button>
					)}
				</div>
			</div>

			<div className="panel-footer">
				<div
					className={`queue-status-mini ${onNavigateToQueue ? "clickable" : ""}`}
					onClick={onNavigateToQueue}
					role={onNavigateToQueue ? "button" : undefined}
					tabIndex={onNavigateToQueue ? 0 : undefined}
					onKeyDown={
						onNavigateToQueue
							? (e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										onNavigateToQueue();
									}
								}
							: undefined
					}
				>
					<div className="queue-status-header">
						<span className="queue-label">Queue</span>
						{onNavigateToQueue && <span className="queue-nav-arrow">&rarr;</span>}
					</div>

					{queueStatus.generating !== null && (
						<div className="queue-progress-mini">
							<div className="progress-bar">
								<div
									className="progress-fill"
									style={{ width: `${queueProgress}%` }}
								/>
							</div>
							<span className="progress-percent">{queueProgress}%</span>
						</div>
					)}

					<div className="queue-stats">
						{queueStatus.pending > 0 && (
							<span className="queue-stat pending">
								{queueStatus.pending} pending
							</span>
						)}
						{queueStatus.generating !== null && (
							<span className="queue-stat generating">1 generating</span>
						)}
						{queueStatus.completed > 0 && (
							<span className="queue-stat completed">
								{queueStatus.completed} completed
							</span>
						)}
						{queueStatus.failed > 0 && (
							<span className="queue-stat failed">
								{queueStatus.failed} failed
							</span>
						)}
						{queueStatus.pending === 0 &&
							queueStatus.generating === null &&
							queueStatus.completed === 0 &&
							queueStatus.failed === 0 && (
								<span className="queue-empty">No items in queue</span>
							)}
					</div>
				</div>
			</div>
		</aside>
	);
};
