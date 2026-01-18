import { useState } from "react";
import type { View } from "./Forge";

interface Props {
	view: View;
}

export const GenerationPanel = ({ view }: Props) => {
	const [prompt, setPrompt] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);
	const [progress, setProgress] = useState(0);

	const handleGenerate = async () => {
		if (!prompt.trim() || isGenerating) return;

		setIsGenerating(true);
		setProgress(0);

		const cleanup = window.forge.generate.onProgress((p) => {
			setProgress(p.percent);
		});

		try {
			const result = await window.forge.generate.image({
				prompt,
				model: "dreamshaper-xl", // Uses model ID, resolved to path in backend
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
					<label>Prompt</label>
					<textarea
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						placeholder={getPlaceholder(view)}
						rows={4}
					/>
				</div>

				<div className="field">
					<label>Style</label>
					<select disabled>
						<option>No theme selected</option>
					</select>
				</div>

				<div className="field">
					<label>Size</label>
					<div className="size-options">
						<button className="active">64×64</button>
						<button>128×128</button>
						<button>256×256</button>
						<button>512×512</button>
					</div>
				</div>

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

				<button
					className="generate-btn primary"
					onClick={handleGenerate}
					disabled={!prompt.trim() || isGenerating}
				>
					{isGenerating ? "Generating..." : "Generate"}
				</button>
			</div>
		</aside>
	);
};

const getPlaceholder = (view: View): string => {
	switch (view) {
		case "themes":
			return "Describe your art style: dark fantasy, pixel art, glowing effects...";
		case "characters":
			return "A warrior in heavy armor with a glowing sword, idle pose";
		case "ui":
			return "Ornate health bar frame with gold filigree and gem decorations";
		case "items":
			return "A legendary fire sword with orange glow and flame particles";
		case "effects":
			return "Magical explosion with purple and blue sparks";
		default:
			return "Describe what you want to generate...";
	}
};
