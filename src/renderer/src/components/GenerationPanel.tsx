import { useState } from "react";

export const GenerationPanel = () => {
	const [selectedTheme, setSelectedTheme] = useState<string>("");
	const [selectedTemplate, setSelectedTemplate] = useState<string>("");
	const [rawPrompt, setRawPrompt] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);
	const [progress, setProgress] = useState(0);

	// Placeholder data - will be populated from actual data in next task
	const themes: { id: string; name: string }[] = [];
	const templates: { id: string; name: string }[] = [];
	const queueStatus = { pending: 0, generating: false };

	const showRawPromptInput = !selectedTemplate;
	const canGenerate = showRawPromptInput ? rawPrompt.trim() : selectedTemplate;

	const handleGenerate = async () => {
		if (!canGenerate || isGenerating) return;

		setIsGenerating(true);
		setProgress(0);

		const cleanup = window.forge.generate.onProgress((p) => {
			setProgress(p.percent);
		});

		try {
			const prompt = rawPrompt.trim();
			const result = await window.forge.generate.image({
				prompt,
				model: "dreamshaper-xl",
				outputPath: `/tmp/forgecraft-test-${Date.now()}.png`,
				width: 512,
				height: 512,
				steps: 20,
				cfgScale: 7,
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

				{/* Dynamic variables will appear here when template is selected */}
				{selectedTemplate && (
					<div className="field">
						<label>Variables</label>
						<p className="field-note">
							Template variables will appear here when templates are loaded.
						</p>
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
