// ABOUTME: Image preview modal component for viewing full-size generated images
// ABOUTME: Displays image with all generation details, supports keyboard and click-to-close

import { useEffect, useCallback } from "react";
import type { GenerationRecord, Theme, Template } from "@shared/types";

interface Props {
	record: GenerationRecord;
	themes: Theme[];
	templates: Template[];
	onClose: () => void;
}

export const ImagePreview = ({ record, themes, templates, onClose }: Props) => {
	// Handle Escape key to close
	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		},
		[onClose]
	);

	useEffect(() => {
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [handleKeyDown]);

	const getThemeName = (themeId: string | null): string | null => {
		if (!themeId) return null;
		const theme = themes.find((t) => t.id === themeId);
		return theme?.name ?? themeId;
	};

	const getTemplateName = (templateId: string | null): string | null => {
		if (!templateId) return null;
		const template = templates.find((t) => t.id === templateId);
		return template?.name ?? templateId;
	};

	const formatDate = (timestamp: number): string => {
		const date = new Date(timestamp);
		return date.toLocaleDateString(undefined, {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const formatGenerationTime = (ms: number | null): string => {
		if (ms === null) return "N/A";
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(2)}s`;
	};

	const formatTemplateValues = (
		values: Record<string, string> | null
	): string => {
		if (!values) return "";
		return Object.entries(values)
			.map(([key, value]) => `${key}: ${value}`)
			.join(", ");
	};

	const themeName = getThemeName(record.themeId);
	const templateName = getTemplateName(record.templateId);

	const handleShowInFolder = () => {
		window.forge.shell.showItemInFolder(record.outputPath);
	};

	return (
		<div
			className="modal-overlay image-preview-overlay"
			onClick={onClose}
			data-testid="image-preview-overlay"
		>
			<div
				className="image-preview-modal"
				onClick={(e) => e.stopPropagation()}
				data-testid="image-preview-modal"
			>
				<button
					className="image-preview-close"
					onClick={onClose}
					aria-label="Close preview"
					data-testid="image-preview-close"
				>
					&times;
				</button>

				<div className="image-preview-content">
					<div className="image-preview-image-container checkerboard-bg">
						<img
							src={`forge-file://${record.transparentPath || record.outputPath}`}
							alt={record.prompt}
							className="image-preview-image"
							data-testid="image-preview-image"
						/>
					</div>

					<div className="image-preview-details">
						<div className="preview-section">
							<h4>Prompt</h4>
							<p className="preview-prompt" data-testid="preview-prompt">
								{record.prompt}
							</p>
						</div>

						{record.negativePrompt && (
							<div className="preview-section">
								<h4>Negative Prompt</h4>
								<p
									className="preview-negative-prompt"
									data-testid="preview-negative-prompt"
								>
									{record.negativePrompt}
								</p>
							</div>
						)}

						{(themeName || templateName) && (
							<div className="preview-section">
								<h4>Source</h4>
								<div className="preview-source-tags">
									{themeName && (
										<span
											className="preview-tag theme-tag"
											data-testid="preview-theme-tag"
										>
											{themeName}
										</span>
									)}
									{templateName && (
										<span
											className="preview-tag template-tag"
											data-testid="preview-template-tag"
										>
											{templateName}
										</span>
									)}
								</div>
								{record.templateValues && (
									<p
										className="preview-template-values"
										data-testid="preview-template-values"
									>
										{formatTemplateValues(record.templateValues)}
									</p>
								)}
							</div>
						)}

						<div className="preview-section">
							<h4>Generation Settings</h4>
							<div className="preview-settings-grid">
								<div className="preview-setting">
									<span className="setting-label">Model</span>
									<span
										className="setting-value"
										data-testid="preview-model"
									>
										{record.model}
									</span>
								</div>
								<div className="preview-setting">
									<span className="setting-label">Dimensions</span>
									<span
										className="setting-value"
										data-testid="preview-dimensions"
									>
										{record.width} x {record.height}
									</span>
								</div>
								<div className="preview-setting">
									<span className="setting-label">Steps</span>
									<span
										className="setting-value"
										data-testid="preview-steps"
									>
										{record.steps}
									</span>
								</div>
								<div className="preview-setting">
									<span className="setting-label">CFG Scale</span>
									<span
										className="setting-value"
										data-testid="preview-cfg"
									>
										{record.cfgScale}
									</span>
								</div>
								<div className="preview-setting">
									<span className="setting-label">Seed</span>
									<span
										className="setting-value mono"
										data-testid="preview-seed"
									>
										{record.seed}
									</span>
								</div>
								<div className="preview-setting">
									<span className="setting-label">Generation Time</span>
									<span
										className="setting-value"
										data-testid="preview-gen-time"
									>
										{formatGenerationTime(record.generationTimeMs)}
									</span>
								</div>
							</div>
						</div>

						<div className="preview-section">
							<h4>Created</h4>
							<p className="preview-date" data-testid="preview-date">
								{formatDate(record.createdAt)}
							</p>
						</div>

						<div className="preview-actions">
							<button
								className="primary"
								onClick={handleShowInFolder}
								data-testid="preview-show-in-folder"
							>
								Show in Finder
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
