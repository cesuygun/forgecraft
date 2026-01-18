// ABOUTME: Generation panel component for creating images
// ABOUTME: Handles theme/template selection and image generation

import { useState, useEffect } from "react";
import type { Theme, Template } from "@shared/types";

export const GenerationPanel = () => {
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

	const queueStatus = { pending: 0, generating: false };

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
			if (template) {
				const initialSelections: Record<string, string> = {};
				template.variables.forEach((variable) => {
					if (variable.options.length > 0) {
						initialSelections[variable.name] = variable.options[0].id;
					}
				});
				setVariableSelections(initialSelections);
			} else {
				setVariableSelections({});
			}
		} else {
			setCurrentTemplate(null);
			setVariableSelections({});
		}
	}, [selectedTemplate, templates]);

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

	const handleGenerate = async () => {
		if (!canGenerate || isGenerating) return;

		setIsGenerating(true);
		setProgress(0);

		const cleanup = window.forge.generate.onProgress((p) => {
			setProgress(p.percent);
		});

		try {
			// Build final prompt: from template or raw prompt, combined with theme style
			let basePrompt = selectedTemplate
				? buildPromptFromTemplate()
				: rawPrompt.trim();
			let finalPrompt = basePrompt;
			if (currentTheme && currentTheme.stylePrompt) {
				finalPrompt = `${basePrompt}, ${currentTheme.stylePrompt}`;
			}

			// Use theme defaults if available, otherwise use hardcoded defaults
			const model = currentTheme?.defaults.model || "dreamshaper-xl";
			const width = currentTheme?.defaults.width || 512;
			const height = currentTheme?.defaults.height || 512;
			const steps = currentTheme?.defaults.steps || 20;
			const cfgScale = currentTheme?.defaults.cfgScale || 7;
			const negativePrompt = currentTheme?.negativePrompt || "";

			const result = await window.forge.generate.image({
				prompt: finalPrompt,
				negativePrompt: negativePrompt || undefined,
				model,
				outputPath: `/tmp/forgecraft-test-${Date.now()}.png`,
				width,
				height,
				steps,
				cfgScale,
			});

			if (!result.success) {
				console.error("Generation failed:", result.error);
			} else {
				console.log("Generated:", result.outputPath);
			}
		} finally {
			cleanup();
			setIsGenerating(false);
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
							<div key={variable.name} className="field">
								<label>{variable.name}</label>
								<select
									value={variableSelections[variable.name] || ""}
									onChange={(e) =>
										handleVariableChange(variable.name, e.target.value)
									}
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
						<button className="generate-btn" disabled>
							Generate All
						</button>
					)}
				</div>
			</div>

			<div className="panel-footer">
				<div className="queue-status">
					<span className="queue-label">Queue</span>
					{queueStatus.pending > 0 ? (
						<span className="queue-count">{queueStatus.pending} pending</span>
					) : queueStatus.generating ? (
						<span className="queue-count">Generating...</span>
					) : (
						<span className="queue-empty">No items in queue</span>
					)}
				</div>
			</div>
		</aside>
	);
};
