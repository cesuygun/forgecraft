// ABOUTME: Main canvas component displaying different views
// ABOUTME: Contains ThemesView, TemplatesView, HistoryView, QueueView

import { useState, useEffect, useCallback } from "react";
import type { View } from "./Forge";
import type { Theme, Template } from "@shared/types";
import { ThemeForm } from "./ThemeForm";
import { TemplateForm } from "./TemplateForm";

interface Props {
	view: View;
}

const VIEW_TITLES: Record<View, string> = {
	themes: "Themes",
	templates: "Templates",
	history: "History",
	queue: "Queue",
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
	return (
		<div className="history-view">
			<div className="empty-state">
				<span className="icon">H</span>
				<h3>No Generations Yet</h3>
				<p>
					Your generated images will appear here. Use the Generation Panel on
					the right to create your first asset.
				</p>
			</div>
		</div>
	);
};

const QueueView = () => {
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
};
