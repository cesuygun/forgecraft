// ABOUTME: Theme create/edit form modal component
// ABOUTME: Handles validation and CRUD operations for themes

import { useState, useEffect } from "react";
import type {
	Theme,
	CreateThemeInput,
	UpdateThemeInput,
	ThemeDefaults,
} from "@shared/types";
import { VALIDATION } from "@shared/types";
import type { SdModel } from "@shared/sd-models";

interface Props {
	theme: Theme | null; // null = create mode, Theme = edit mode
	onSave: (theme: Theme) => void;
	onCancel: () => void;
}

interface FormData {
	id: string;
	name: string;
	stylePrompt: string;
	negativePrompt: string;
	model: string;
	steps: number;
	cfgScale: number;
	width: number;
	height: number;
}

interface FormErrors {
	id?: string;
	name?: string;
	stylePrompt?: string;
	negativePrompt?: string;
	steps?: string;
	cfgScale?: string;
	width?: string;
	height?: string;
}

const DEFAULT_FORM_DATA: FormData = {
	id: "",
	name: "",
	stylePrompt: "",
	negativePrompt: "",
	model: "dreamshaper-xl",
	steps: 20,
	cfgScale: 7,
	width: 512,
	height: 512,
};

const toSlug = (text: string): string => {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 50);
};

export const ThemeForm = ({ theme, onSave, onCancel }: Props) => {
	const isEditMode = theme !== null;
	const [formData, setFormData] = useState<FormData>(DEFAULT_FORM_DATA);
	const [errors, setErrors] = useState<FormErrors>({});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [models, setModels] = useState<SdModel[]>([]);
	const [idManuallyEdited, setIdManuallyEdited] = useState(false);

	// Load models on mount
	useEffect(() => {
		const loadModels = async () => {
			try {
				const installedModels = await window.forge.models.installed();
				setModels(installedModels);
			} catch (err) {
				console.error("Failed to load models:", err);
			}
		};
		loadModels();
	}, []);

	// Initialize form data when editing
	useEffect(() => {
		if (theme) {
			setFormData({
				id: theme.id,
				name: theme.name,
				stylePrompt: theme.stylePrompt,
				negativePrompt: theme.negativePrompt,
				model: theme.defaults.model,
				steps: theme.defaults.steps,
				cfgScale: theme.defaults.cfgScale,
				width: theme.defaults.width,
				height: theme.defaults.height,
			});
		}
	}, [theme]);

	const validateForm = (): boolean => {
		const newErrors: FormErrors = {};
		const v = VALIDATION.theme;

		// ID validation (only for create mode)
		if (!isEditMode) {
			if (formData.id.length < v.id.minLength) {
				newErrors.id = "ID is required";
			} else if (formData.id.length > v.id.maxLength) {
				newErrors.id = `ID must be ${v.id.maxLength} characters or less`;
			} else if (!v.id.pattern.test(formData.id)) {
				newErrors.id = "ID must be lowercase letters, numbers, and hyphens only";
			}
		}

		// Name validation
		if (formData.name.length < v.name.minLength) {
			newErrors.name = "Name is required";
		} else if (formData.name.length > v.name.maxLength) {
			newErrors.name = `Name must be ${v.name.maxLength} characters or less`;
		}

		// Style prompt validation
		if (formData.stylePrompt.length < v.stylePrompt.minLength) {
			newErrors.stylePrompt = "Style prompt is required";
		} else if (formData.stylePrompt.length > v.stylePrompt.maxLength) {
			newErrors.stylePrompt = `Style prompt must be ${v.stylePrompt.maxLength} characters or less`;
		}

		// Negative prompt validation (optional)
		if (formData.negativePrompt.length > v.negativePrompt.maxLength) {
			newErrors.negativePrompt = `Negative prompt must be ${v.negativePrompt.maxLength} characters or less`;
		}

		// Steps validation
		if (formData.steps < v.steps.min || formData.steps > v.steps.max) {
			newErrors.steps = `Steps must be between ${v.steps.min} and ${v.steps.max}`;
		}

		// CFG Scale validation
		if (formData.cfgScale < v.cfgScale.min || formData.cfgScale > v.cfgScale.max) {
			newErrors.cfgScale = `CFG Scale must be between ${v.cfgScale.min} and ${v.cfgScale.max}`;
		}

		// Width validation
		if (
			formData.width < v.dimensions.min ||
			formData.width > v.dimensions.max ||
			formData.width % v.dimensions.divisibleBy !== 0
		) {
			newErrors.width = `Width must be ${v.dimensions.min}-${v.dimensions.max}, divisible by ${v.dimensions.divisibleBy}`;
		}

		// Height validation
		if (
			formData.height < v.dimensions.min ||
			formData.height > v.dimensions.max ||
			formData.height % v.dimensions.divisibleBy !== 0
		) {
			newErrors.height = `Height must be ${v.dimensions.min}-${v.dimensions.max}, divisible by ${v.dimensions.divisibleBy}`;
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitError(null);

		if (!validateForm()) {
			return;
		}

		setIsSubmitting(true);

		try {
			const defaults: ThemeDefaults = {
				model: formData.model,
				steps: formData.steps,
				cfgScale: formData.cfgScale,
				width: formData.width,
				height: formData.height,
			};

			let savedTheme: Theme;

			if (isEditMode) {
				const input: UpdateThemeInput = {
					name: formData.name,
					stylePrompt: formData.stylePrompt,
					negativePrompt: formData.negativePrompt,
					defaults,
				};
				savedTheme = await window.forge.themes.update(theme.id, input);
			} else {
				const input: CreateThemeInput = {
					id: formData.id,
					name: formData.name,
					stylePrompt: formData.stylePrompt,
					negativePrompt: formData.negativePrompt || undefined,
					defaults,
				};
				savedTheme = await window.forge.themes.create(input);
			}

			onSave(savedTheme);
		} catch (err) {
			setSubmitError(err instanceof Error ? err.message : "Failed to save theme");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleChange = (
		field: keyof FormData,
		value: string | number
	) => {
		setFormData((prev) => {
			const updated = { ...prev, [field]: value };
			// Auto-generate ID from name (only in create mode, if ID hasn't been manually edited)
			if (field === "name" && !isEditMode && !idManuallyEdited) {
				updated.id = toSlug(value as string);
			}
			return updated;
		});
		// Clear error for this field when user starts typing
		if (errors[field as keyof FormErrors]) {
			setErrors((prev) => ({ ...prev, [field]: undefined }));
		}
		// Track manual ID edits
		if (field === "id") {
			setIdManuallyEdited(true);
		}
	};

	return (
		<div className="modal-overlay" onClick={onCancel}>
			<div className="modal-content theme-form" onClick={(e) => e.stopPropagation()}>
				<div className="modal-header">
					<h3>{isEditMode ? "Edit Theme" : "Create Theme"}</h3>
					<button className="close-btn" onClick={onCancel}>
						&times;
					</button>
				</div>

				<form onSubmit={handleSubmit}>
					<div className="form-body">
						{/* Basic Info Section */}
						<div className="form-section">
							<h4>Basic Info</h4>

							{!isEditMode && (
								<div className="field">
									<label htmlFor="theme-id">ID</label>
									<input
										id="theme-id"
										type="text"
										value={formData.id}
										onChange={(e) => handleChange("id", e.target.value)}
										placeholder="my-theme-id"
									/>
									{errors.id && <span className="field-error">{errors.id}</span>}
								</div>
							)}

							<div className="field">
								<label htmlFor="theme-name">Name</label>
								<input
									id="theme-name"
									type="text"
									value={formData.name}
									onChange={(e) => handleChange("name", e.target.value)}
									placeholder="My Theme Name"
								/>
								{errors.name && <span className="field-error">{errors.name}</span>}
							</div>
						</div>

						{/* Prompts Section */}
						<div className="form-section">
							<h4>Prompts</h4>

							<div className="field">
								<label htmlFor="theme-style-prompt">Style Prompt</label>
								<textarea
									id="theme-style-prompt"
									value={formData.stylePrompt}
									onChange={(e) => handleChange("stylePrompt", e.target.value)}
									placeholder="pixel art, chibi style, dark fantasy..."
									rows={3}
								/>
								{errors.stylePrompt && (
									<span className="field-error">{errors.stylePrompt}</span>
								)}
							</div>

							<div className="field">
								<label htmlFor="theme-negative-prompt">Negative Prompt (optional)</label>
								<textarea
									id="theme-negative-prompt"
									value={formData.negativePrompt}
									onChange={(e) => handleChange("negativePrompt", e.target.value)}
									placeholder="blurry, low quality, watermark..."
									rows={2}
								/>
								{errors.negativePrompt && (
									<span className="field-error">{errors.negativePrompt}</span>
								)}
							</div>
						</div>

						{/* Defaults Section */}
						<div className="form-section">
							<h4>Default Settings</h4>

							<div className="field">
								<label htmlFor="theme-model">Model</label>
								<select
									id="theme-model"
									value={formData.model}
									onChange={(e) => handleChange("model", e.target.value)}
								>
									{models.length === 0 ? (
										<option value="dreamshaper-xl">dreamshaper-xl (default)</option>
									) : (
										models.map((model) => (
											<option key={model.id} value={model.id}>
												{model.name}
											</option>
										))
									)}
								</select>
							</div>

							<div className="form-row">
								<div className="field">
									<label htmlFor="theme-steps">Steps</label>
									<input
										id="theme-steps"
										type="number"
										value={formData.steps}
										onChange={(e) => handleChange("steps", parseInt(e.target.value) || 0)}
										min={1}
										max={150}
									/>
									{errors.steps && <span className="field-error">{errors.steps}</span>}
								</div>

								<div className="field">
									<label htmlFor="theme-cfg">CFG Scale</label>
									<input
										id="theme-cfg"
										type="number"
										value={formData.cfgScale}
										onChange={(e) => handleChange("cfgScale", parseFloat(e.target.value) || 0)}
										min={1}
										max={30}
										step={0.5}
									/>
									{errors.cfgScale && (
										<span className="field-error">{errors.cfgScale}</span>
									)}
								</div>
							</div>

							<div className="form-row">
								<div className="field">
									<label htmlFor="theme-width">Width</label>
									<input
										id="theme-width"
										type="number"
										value={formData.width}
										onChange={(e) => handleChange("width", parseInt(e.target.value) || 0)}
										min={64}
										max={2048}
										step={8}
									/>
									{errors.width && <span className="field-error">{errors.width}</span>}
								</div>

								<div className="field">
									<label htmlFor="theme-height">Height</label>
									<input
										id="theme-height"
										type="number"
										value={formData.height}
										onChange={(e) => handleChange("height", parseInt(e.target.value) || 0)}
										min={64}
										max={2048}
										step={8}
									/>
									{errors.height && (
										<span className="field-error">{errors.height}</span>
									)}
								</div>
							</div>
						</div>
					</div>

					{submitError && (
						<div className="form-error">
							{submitError}
						</div>
					)}

					<div className="form-actions">
						<button type="button" onClick={onCancel} disabled={isSubmitting}>
							Cancel
						</button>
						<button type="submit" className="primary" disabled={isSubmitting}>
							{isSubmitting ? "Saving..." : isEditMode ? "Save Changes" : "Create Theme"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};
