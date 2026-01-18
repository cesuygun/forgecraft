// ABOUTME: Main canvas component displaying different views
// ABOUTME: Contains ThemesView, TemplatesView, HistoryView, QueueView

import { useState, useEffect, useCallback } from "react";
import type { View } from "./Forge";
import type {
	Theme,
	Template,
	GenerationRecord,
	QueueItem,
	GenerationProgressMessage,
	AppSettings,
} from "@shared/types";
import type { SdModel } from "@shared/sd-models";
import { ThemeForm } from "./ThemeForm";
import { TemplateForm } from "./TemplateForm";
import { ImagePreview } from "./ImagePreview";

interface Props {
	view: View;
}

const VIEW_TITLES: Record<View, string> = {
	themes: "Themes",
	templates: "Templates",
	history: "History",
	queue: "Queue",
	settings: "Settings",
};

export const Canvas = ({ view }: Props) => {
	return (
		<main className="canvas">
			<div className="canvas-header">
				<h2>{VIEW_TITLES[view]}</h2>
			</div>

			<div className="canvas-content">
				{view === "themes" && <ThemesView />}
				{view === "templates" && <TemplatesView />}
				{view === "history" && <HistoryView />}
				{view === "queue" && <QueueView />}
				{view === "settings" && <SettingsView />}
			</div>
		</main>
	);
};

const ThemesView = () => {
	const [themes, setThemes] = useState<Theme[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showForm, setShowForm] = useState(false);
	const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

	const loadThemes = useCallback(async () => {
		try {
			setError(null);
			const list = await window.forge.themes.list();
			setThemes(list);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load themes");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		loadThemes();
	}, [loadThemes]);

	const handleCreateClick = () => {
		setEditingTheme(null);
		setShowForm(true);
	};

	const handleEditClick = (theme: Theme) => {
		setEditingTheme(theme);
		setShowForm(true);
	};

	const handleDeleteClick = (themeId: string) => {
		setDeleteConfirm(themeId);
	};

	const handleConfirmDelete = async () => {
		if (!deleteConfirm) return;

		try {
			await window.forge.themes.delete(deleteConfirm);
			setThemes((prev) => prev.filter((t) => t.id !== deleteConfirm));
			setDeleteConfirm(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete theme");
		}
	};

	const handleFormSave = (savedTheme: Theme) => {
		if (editingTheme) {
			// Update existing theme in list
			setThemes((prev) =>
				prev.map((t) => (t.id === savedTheme.id ? savedTheme : t))
			);
		} else {
			// Add new theme to list
			setThemes((prev) => [...prev, savedTheme]);
		}
		setShowForm(false);
		setEditingTheme(null);
	};

	const handleFormCancel = () => {
		setShowForm(false);
		setEditingTheme(null);
	};

	if (isLoading) {
		return (
			<div className="themes-view">
				<div className="loading-state">
					<div className="loading-spinner" />
					<p>Loading themes...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="themes-view">
				<div className="error-state">
					<span className="icon">!</span>
					<h3>Error Loading Themes</h3>
					<p>{error}</p>
					<button className="primary" onClick={loadThemes}>
						Retry
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="themes-view">
			{themes.length === 0 ? (
				<div className="empty-state">
					<span className="icon">P</span>
					<h3>No Themes Yet</h3>
					<p>
						Themes define your visual style. Create one to ensure consistent
						generation across all your assets.
					</p>
					<button className="primary" onClick={handleCreateClick}>
						Create Theme
					</button>
				</div>
			) : (
				<>
					<div className="view-toolbar">
						<button className="primary" onClick={handleCreateClick}>
							+ Create Theme
						</button>
					</div>

					<div className="themes-grid">
						{themes.map((theme) => (
							<div key={theme.id} className="theme-card">
								<div className="theme-card-header">
									<span className="theme-icon">P</span>
									<h4 className="theme-name">{theme.name}</h4>
								</div>
								<p className="theme-style-preview">
									{theme.stylePrompt.length > 80
										? `${theme.stylePrompt.substring(0, 80)}...`
										: theme.stylePrompt}
								</p>
								<div className="theme-card-meta">
									<span className="meta-item">{theme.defaults.model}</span>
									<span className="meta-item">{theme.defaults.width}x{theme.defaults.height}</span>
								</div>
								<div className="theme-card-actions">
									<button onClick={() => handleEditClick(theme)}>Edit</button>
									<button
										className="danger"
										onClick={() => handleDeleteClick(theme.id)}
									>
										Delete
									</button>
								</div>
							</div>
						))}
					</div>
				</>
			)}

			{showForm && (
				<ThemeForm
					theme={editingTheme}
					onSave={handleFormSave}
					onCancel={handleFormCancel}
				/>
			)}

			{deleteConfirm && (
				<div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
					<div
						className="modal-content confirm-dialog"
						onClick={(e) => e.stopPropagation()}
					>
						<h3>Delete Theme?</h3>
						<p>
							Are you sure you want to delete this theme? This action cannot be
							undone.
						</p>
						<div className="confirm-actions">
							<button onClick={() => setDeleteConfirm(null)}>Cancel</button>
							<button className="danger" onClick={handleConfirmDelete}>
								Delete
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

const TemplatesView = () => {
	const [templates, setTemplates] = useState<Template[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showForm, setShowForm] = useState(false);
	const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

	const loadTemplates = useCallback(async () => {
		try {
			setError(null);
			const list = await window.forge.templates.list();
			setTemplates(list);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load templates");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		loadTemplates();
	}, [loadTemplates]);

	const handleCreateClick = () => {
		setEditingTemplate(null);
		setShowForm(true);
	};

	const handleEditClick = (template: Template) => {
		setEditingTemplate(template);
		setShowForm(true);
	};

	const handleDeleteClick = (templateId: string) => {
		setDeleteConfirm(templateId);
	};

	const handleConfirmDelete = async () => {
		if (!deleteConfirm) return;

		try {
			await window.forge.templates.delete(deleteConfirm);
			setTemplates((prev) => prev.filter((t) => t.id !== deleteConfirm));
			setDeleteConfirm(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete template");
		}
	};

	const handleFormSave = (savedTemplate: Template) => {
		if (editingTemplate) {
			// Update existing template in list
			setTemplates((prev) =>
				prev.map((t) => (t.id === savedTemplate.id ? savedTemplate : t))
			);
		} else {
			// Add new template to list
			setTemplates((prev) => [...prev, savedTemplate]);
		}
		setShowForm(false);
		setEditingTemplate(null);
	};

	const handleFormCancel = () => {
		setShowForm(false);
		setEditingTemplate(null);
	};

	const getVariableSummary = (template: Template): string => {
		const names = template.variables.map((v) => v.name);
		if (names.length === 0) return "No variables";
		return `${names.length} variable${names.length === 1 ? "" : "s"}: ${names.join(", ")}`;
	};

	const truncatePattern = (pattern: string, maxLength = 60): string => {
		return pattern.length > maxLength
			? `${pattern.substring(0, maxLength)}...`
			: pattern;
	};

	if (isLoading) {
		return (
			<div className="templates-view">
				<div className="loading-state">
					<div className="loading-spinner" />
					<p>Loading templates...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="templates-view">
				<div className="error-state">
					<span className="icon">!</span>
					<h3>Error Loading Templates</h3>
					<p>{error}</p>
					<button className="primary" onClick={loadTemplates}>
						Retry
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="templates-view">
			{templates.length === 0 ? (
				<div className="empty-state">
					<span className="icon">T</span>
					<h3>No Templates Yet</h3>
					<p>
						Templates define generation structure with variable axes. Create one
						to generate consistent asset variations.
					</p>
					<button className="primary" onClick={handleCreateClick}>
						Create Template
					</button>
				</div>
			) : (
				<>
					<div className="view-toolbar">
						<button className="primary" onClick={handleCreateClick}>
							+ Create Template
						</button>
					</div>

					<div className="templates-grid">
						{templates.map((template) => (
							<div key={template.id} className="template-card">
								<div className="template-card-header">
									<span className="template-icon">T</span>
									<h4 className="template-name">{template.name}</h4>
								</div>
								<p className="template-variables">
									{getVariableSummary(template)}
								</p>
								<p className="template-pattern-preview">
									{truncatePattern(template.promptPattern)}
								</p>
								<div className="template-card-actions">
									<button onClick={() => handleEditClick(template)}>Edit</button>
									<button
										className="danger"
										onClick={() => handleDeleteClick(template.id)}
									>
										Delete
									</button>
								</div>
							</div>
						))}
					</div>
				</>
			)}

			{showForm && (
				<TemplateForm
					template={editingTemplate}
					onSave={handleFormSave}
					onCancel={handleFormCancel}
				/>
			)}

			{deleteConfirm && (
				<div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
					<div
						className="modal-content confirm-dialog"
						onClick={(e) => e.stopPropagation()}
					>
						<h3>Delete Template?</h3>
						<p>
							Are you sure you want to delete this template? This action cannot be
							undone.
						</p>
						<div className="confirm-actions">
							<button onClick={() => setDeleteConfirm(null)}>Cancel</button>
							<button className="danger" onClick={handleConfirmDelete}>
								Delete
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

const HistoryView = () => {
	const [generations, setGenerations] = useState<GenerationRecord[]>([]);
	const [themes, setThemes] = useState<Theme[]>([]);
	const [templates, setTemplates] = useState<Template[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [filterThemeId, setFilterThemeId] = useState<string>("");
	const [filterTemplateId, setFilterTemplateId] = useState<string>("");
	const [previewRecord, setPreviewRecord] = useState<GenerationRecord | null>(
		null
	);

	// Load themes and templates for filter dropdowns
	const loadFilters = useCallback(async () => {
		try {
			const [themeList, templateList] = await Promise.all([
				window.forge.themes.list(),
				window.forge.templates.list(),
			]);
			setThemes(themeList);
			setTemplates(templateList);
		} catch (err) {
			console.error("Failed to load filters:", err);
		}
	}, []);

	// Load generations with current filters
	const loadGenerations = useCallback(async () => {
		try {
			setError(null);
			const options: { themeId?: string; templateId?: string } = {};
			if (filterThemeId) options.themeId = filterThemeId;
			if (filterTemplateId) options.templateId = filterTemplateId;

			const list = await window.forge.history.list(options);
			setGenerations(list);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to load generations"
			);
		} finally {
			setIsLoading(false);
		}
	}, [filterThemeId, filterTemplateId]);

	useEffect(() => {
		loadFilters();
	}, [loadFilters]);

	useEffect(() => {
		loadGenerations();
	}, [loadGenerations]);

	const formatDate = (timestamp: number): string => {
		const date = new Date(timestamp);
		return date.toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const truncatePrompt = (prompt: string, maxLength = 50): string => {
		return prompt.length > maxLength
			? `${prompt.substring(0, maxLength)}...`
			: prompt;
	};

	const getThemeName = (themeId: string | null): string => {
		if (!themeId) return "Raw Prompt";
		const theme = themes.find((t) => t.id === themeId);
		return theme?.name ?? themeId;
	};

	const getTemplateName = (templateId: string | null): string => {
		if (!templateId) return "Raw Prompt";
		const template = templates.find((t) => t.id === templateId);
		return template?.name ?? templateId;
	};

	if (isLoading) {
		return (
			<div className="history-view">
				<div className="loading-state">
					<div className="loading-spinner" />
					<p>Loading history...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="history-view">
				<div className="error-state">
					<span className="icon">!</span>
					<h3>Error Loading History</h3>
					<p>{error}</p>
					<button className="primary" onClick={loadGenerations}>
						Retry
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="history-view">
			<div className="history-toolbar">
				<div className="history-filters">
					<div className="filter-field">
						<label htmlFor="filter-theme">Theme</label>
						<select
							id="filter-theme"
							value={filterThemeId}
							onChange={(e) => setFilterThemeId(e.target.value)}
						>
							<option value="">All Themes</option>
							{themes.map((theme) => (
								<option key={theme.id} value={theme.id}>
									{theme.name}
								</option>
							))}
						</select>
					</div>

					<div className="filter-field">
						<label htmlFor="filter-template">Template</label>
						<select
							id="filter-template"
							value={filterTemplateId}
							onChange={(e) => setFilterTemplateId(e.target.value)}
						>
							<option value="">All Templates</option>
							{templates.map((template) => (
								<option key={template.id} value={template.id}>
									{template.name}
								</option>
							))}
						</select>
					</div>
				</div>

				<span className="history-count">
					{generations.length} generation{generations.length !== 1 ? "s" : ""}
				</span>
			</div>

			{generations.length === 0 ? (
				<div className="empty-state">
					<span className="icon">H</span>
					<h3>No Generations Yet</h3>
					<p>
						{filterThemeId || filterTemplateId
							? "No generations match the current filters. Try adjusting your filter settings."
							: "Your generated images will appear here. Use the Generation Panel on the right to create your first asset."}
					</p>
				</div>
			) : (
				<div className="history-grid">
					{generations.map((gen) => (
						<div
							key={gen.id}
							className="history-card"
							onClick={() => setPreviewRecord(gen)}
							data-testid={`history-card-${gen.id}`}
						>
							<div className="history-card-image">
								<img
									src={`forge-file://${gen.outputPath}`}
									alt={gen.prompt}
									loading="lazy"
								/>
							</div>
							<div className="history-card-info">
								<p className="history-prompt">{truncatePrompt(gen.prompt)}</p>
								<div className="history-meta">
									{gen.themeId && (
										<span className="meta-tag theme-tag">
											{getThemeName(gen.themeId)}
										</span>
									)}
									{gen.templateId && (
										<span className="meta-tag template-tag">
											{getTemplateName(gen.templateId)}
										</span>
									)}
								</div>
								<div className="history-details">
									<span className="history-date">{formatDate(gen.createdAt)}</span>
									<span className="history-seed">Seed: {gen.seed}</span>
								</div>
							</div>
						</div>
					))}
				</div>
			)}

			{previewRecord && (
				<ImagePreview
					record={previewRecord}
					themes={themes}
					templates={templates}
					onClose={() => setPreviewRecord(null)}
				/>
			)}
		</div>
	);
};

const QueueView = () => {
	const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
	const [themes, setThemes] = useState<Theme[]>([]);
	const [templates, setTemplates] = useState<Template[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [currentProgress, setCurrentProgress] = useState<number>(0);
	const [generatingId, setGeneratingId] = useState<string | null>(null);
	const [previewItem, setPreviewItem] = useState<QueueItem | null>(null);

	// Load themes and templates for preview
	const loadFilters = useCallback(async () => {
		try {
			const [themeList, templateList] = await Promise.all([
				window.forge.themes.list(),
				window.forge.templates.list(),
			]);
			setThemes(themeList);
			setTemplates(templateList);
		} catch (err) {
			console.error("Failed to load filters:", err);
		}
	}, []);

	const loadQueue = useCallback(async () => {
		try {
			setError(null);
			const items = await window.forge.queue.list();
			setQueueItems(items);
			// Find the currently generating item
			const generating = items.find((item) => item.status === "generating");
			setGeneratingId(generating?.id ?? null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load queue");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		loadFilters();
	}, [loadFilters]);

	useEffect(() => {
		loadQueue();
	}, [loadQueue]);

	// Subscribe to queue events for real-time updates
	useEffect(() => {
		// Subscribe to queue status changes to reload the list
		const unsubStatus = window.forge.queue.onStatusChange(() => {
			loadQueue();
		});

		// Subscribe to generation progress
		const unsubProgress = window.forge.queue.onProgress(
			(progressMsg: GenerationProgressMessage) => {
				setCurrentProgress(progressMsg.percent);
				setGeneratingId(progressMsg.requestId);
			}
		);

		// Subscribe to generation complete
		const unsubComplete = window.forge.queue.onComplete(() => {
			setCurrentProgress(0);
			loadQueue();
		});

		// Subscribe to generation failed
		const unsubFailed = window.forge.queue.onFailed(() => {
			setCurrentProgress(0);
			loadQueue();
		});

		return () => {
			unsubStatus();
			unsubProgress();
			unsubComplete();
			unsubFailed();
		};
	}, [loadQueue]);

	const handleCancel = async (id: string) => {
		try {
			await window.forge.queue.cancel(id);
			// Update local state optimistically
			setQueueItems((prev) => prev.filter((item) => item.id !== id));
		} catch (err) {
			console.error("Failed to cancel item:", err);
			// Reload to get actual state
			loadQueue();
		}
	};

	const handleRetry = async (id: string) => {
		try {
			await window.forge.queue.retry(id);
			// Update local state optimistically
			setQueueItems((prev) =>
				prev.map((item) =>
					item.id === id
						? { ...item, status: "pending" as const, error: null }
						: item
				)
			);
		} catch (err) {
			console.error("Failed to retry item:", err);
			// Reload to get actual state
			loadQueue();
		}
	};

	const formatTime = (timestamp: number | null): string => {
		if (!timestamp) return "-";
		const date = new Date(timestamp);
		return date.toLocaleTimeString(undefined, {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const formatDuration = (item: QueueItem): string | null => {
		if (!item.startedAt) return null;
		const endTime = item.completedAt ?? Date.now();
		const durationMs = endTime - item.startedAt;
		const seconds = Math.floor(durationMs / 1000);
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}m ${remainingSeconds}s`;
	};

	const handleRemove = async (id: string) => {
		try {
			await window.forge.queue.cancel(id);
			setQueueItems((prev) => prev.filter((item) => item.id !== id));
		} catch (err) {
			console.error("Failed to remove item:", err);
			loadQueue();
		}
	};

	const truncatePrompt = (prompt: string, maxLength = 60): string => {
		return prompt.length > maxLength
			? `${prompt.substring(0, maxLength)}...`
			: prompt;
	};

	const getStatusIcon = (status: QueueItem["status"]): string => {
		switch (status) {
			case "pending":
				return "...";
			case "generating":
				return "~";
			case "complete":
				return "V";
			case "failed":
				return "X";
			default:
				return "?";
		}
	};

	// Convert a completed QueueItem to GenerationRecord for preview
	const queueItemToRecord = (item: QueueItem): GenerationRecord => ({
		id: item.id,
		themeId: item.request.themeId,
		templateId: item.request.templateId,
		templateValues: item.request.templateValues,
		prompt: item.request.prompt,
		negativePrompt: item.request.negativePrompt || null,
		seed: item.resultSeed ?? item.request.seed ?? 0,
		outputPath: item.request.outputPath,
		model: item.request.model,
		width: item.request.width,
		height: item.request.height,
		steps: item.request.steps,
		cfgScale: item.request.cfgScale,
		generationTimeMs:
			item.completedAt && item.startedAt
				? item.completedAt - item.startedAt
				: null,
		createdAt: item.createdAt,
	});

	// Group items by status for better organization
	const generatingItems = queueItems.filter(
		(item) => item.status === "generating"
	);
	const pendingItems = queueItems.filter((item) => item.status === "pending");
	const failedItems = queueItems.filter((item) => item.status === "failed");
	const completedItems = queueItems.filter(
		(item) => item.status === "complete"
	);

	// Combine in display order: generating first, then pending, failed, completed
	const sortedItems = [
		...generatingItems,
		...pendingItems,
		...failedItems,
		...completedItems,
	];

	if (isLoading) {
		return (
			<div className="queue-view">
				<div className="loading-state">
					<div className="loading-spinner" />
					<p>Loading queue...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="queue-view">
				<div className="error-state">
					<span className="icon">!</span>
					<h3>Error Loading Queue</h3>
					<p>{error}</p>
					<button className="primary" onClick={loadQueue}>
						Retry
					</button>
				</div>
			</div>
		);
	}

	if (sortedItems.length === 0) {
		return (
			<div className="queue-view">
				<div className="empty-state">
					<span className="icon">Q</span>
					<h3>Queue Empty</h3>
					<p>
						No pending generations. Add items to the queue from the Generation
						Panel or use &quot;Generate All&quot; on a template.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="queue-view">
			<div className="queue-toolbar">
				<span className="queue-summary">
					{pendingItems.length > 0 && (
						<span className="summary-stat pending">
							{pendingItems.length} pending
						</span>
					)}
					{generatingItems.length > 0 && (
						<span className="summary-stat generating">1 generating</span>
					)}
					{failedItems.length > 0 && (
						<span className="summary-stat failed">
							{failedItems.length} failed
						</span>
					)}
					{completedItems.length > 0 && (
						<span className="summary-stat completed">
							{completedItems.length} completed
						</span>
					)}
				</span>
			</div>

			<div className="queue-list">
				{sortedItems.map((item) => (
					<div
						key={item.id}
						className={`queue-item queue-item-${item.status}`}
						data-testid={`queue-item-${item.id}`}
					>
						<div className="queue-item-status">
							<span
								className={`status-icon status-${item.status}`}
								title={item.status}
							>
								{getStatusIcon(item.status)}
							</span>
						</div>

						{item.status === "complete" && (
							<div
								className="queue-item-thumbnail"
								onClick={() => setPreviewItem(item)}
								title="Click to preview"
								data-testid={`queue-thumbnail-${item.id}`}
							>
								<img
									src={`forge-file://${item.request.outputPath}`}
									alt={item.request.prompt}
								/>
							</div>
						)}

						<div className="queue-item-content">
							<p className="queue-item-prompt">
								{truncatePrompt(item.request.prompt)}
							</p>

							{item.status === "generating" && (
								<div className="queue-item-progress">
									<div className="progress-bar">
										<div
											className="progress-fill"
											style={{
												width: `${item.id === generatingId ? currentProgress : 0}%`,
											}}
										/>
									</div>
									<span className="progress-percent">
										{item.id === generatingId ? currentProgress : 0}%
									</span>
								</div>
							)}

							{item.status === "failed" && item.error && (
								<p className="queue-item-error">{item.error}</p>
							)}

							<div className="queue-item-meta">
								<span className="queue-item-time">
									Added: {formatTime(item.createdAt)}
								</span>
								{item.startedAt && (
									<span className="queue-item-time">
										Started: {formatTime(item.startedAt)}
									</span>
								)}
								{(item.status === "complete" || item.status === "failed") && formatDuration(item) && (
									<span className="queue-item-duration">
										{formatDuration(item)}
									</span>
								)}
								<span className="queue-item-model">{item.request.model}</span>
								<span className="queue-item-size">
									{item.request.width}x{item.request.height}
								</span>
							</div>
						</div>

						<div className="queue-item-actions">
							{item.status === "pending" && (
								<button
									className="danger queue-action-btn"
									onClick={() => handleCancel(item.id)}
									title="Cancel"
								>
									Cancel
								</button>
							)}
							{item.status === "failed" && (
								<>
									<button
										className="primary queue-action-btn"
										onClick={() => handleRetry(item.id)}
										title="Retry"
									>
										Retry
									</button>
									<button
										className="danger queue-action-btn"
										onClick={() => handleRemove(item.id)}
										title="Remove"
									>
										Remove
									</button>
								</>
							)}
							{item.status === "complete" && (
								<button
									className="queue-action-btn"
									onClick={() => handleRemove(item.id)}
									title="Remove from queue"
								>
									Remove
								</button>
							)}
						</div>
					</div>
				))}
			</div>

			{previewItem && (
				<ImagePreview
					record={queueItemToRecord(previewItem)}
					themes={themes}
					templates={templates}
					onClose={() => setPreviewItem(null)}
				/>
			)}
		</div>
	);
};

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
						<div className="form-error settings-error">
							<span className="error-icon">!</span>
							{saveError}
						</div>
					)}

					{saveSuccess && (
						<div className="form-success">
							Settings saved successfully!
						</div>
					)}

					<div className="form-actions settings-actions">
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
