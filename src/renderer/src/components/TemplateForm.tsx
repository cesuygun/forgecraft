// ABOUTME: Template create/edit form modal component
// ABOUTME: Handles validation and CRUD operations for templates with variable management

import { useState, useEffect } from "react";
import type {
	Template,
	TemplateVariable,
	VariableOption,
	CreateTemplateInput,
	UpdateTemplateInput,
} from "@shared/types";
import { VALIDATION } from "@shared/types";

interface Props {
	template: Template | null; // null = create mode, Template = edit mode
	onSave: (template: Template) => void;
	onCancel: () => void;
}

interface FormData {
	id: string;
	name: string;
	promptPattern: string;
	variables: TemplateVariable[];
}

interface FormErrors {
	id?: string;
	name?: string;
	promptPattern?: string;
	variables?: string;
	variableErrors?: Record<number, VariableErrors>;
}

interface VariableErrors {
	name?: string;
	options?: Record<number, OptionErrors>;
}

interface OptionErrors {
	id?: string;
	label?: string;
	promptFragment?: string;
}

const DEFAULT_FORM_DATA: FormData = {
	id: "",
	name: "",
	promptPattern: "",
	variables: [],
};

const createEmptyOption = (): VariableOption => ({
	id: "",
	label: "",
	promptFragment: "",
});

const createEmptyVariable = (): TemplateVariable => ({
	name: "",
	options: [createEmptyOption()],
});

export const TemplateForm = ({ template, onSave, onCancel }: Props) => {
	const isEditMode = template !== null;
	const [formData, setFormData] = useState<FormData>(DEFAULT_FORM_DATA);
	const [errors, setErrors] = useState<FormErrors>({});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

	// Initialize form data when editing
	useEffect(() => {
		if (template) {
			setFormData({
				id: template.id,
				name: template.name,
				promptPattern: template.promptPattern,
				variables: template.variables.map((v) => ({
					...v,
					options: v.options.map((o) => ({ ...o })),
				})),
			});
		}
	}, [template]);

	const validateForm = (): boolean => {
		const newErrors: FormErrors = {};
		const v = VALIDATION.template;

		// ID validation (only for create mode)
		if (!isEditMode) {
			if (formData.id.length < v.id.minLength) {
				newErrors.id = "ID is required";
			} else if (formData.id.length > v.id.maxLength) {
				newErrors.id = `ID must be ${v.id.maxLength} characters or less`;
			} else if (!v.id.pattern.test(formData.id)) {
				newErrors.id =
					"ID must be lowercase letters, numbers, and hyphens only";
			}
		}

		// Name validation
		if (formData.name.length < v.name.minLength) {
			newErrors.name = "Name is required";
		} else if (formData.name.length > v.name.maxLength) {
			newErrors.name = `Name must be ${v.name.maxLength} characters or less`;
		}

		// Prompt pattern validation
		if (formData.promptPattern.length < v.promptPattern.minLength) {
			newErrors.promptPattern = "Prompt pattern is required";
		} else if (formData.promptPattern.length > v.promptPattern.maxLength) {
			newErrors.promptPattern = `Prompt pattern must be ${v.promptPattern.maxLength} characters or less`;
		} else {
			// Check if pattern contains at least one {variable}
			const variablePattern = /\{[a-z0-9_]+\}/g;
			const matches = formData.promptPattern.match(variablePattern);
			if (!matches || matches.length === 0) {
				newErrors.promptPattern =
					"Pattern must contain at least one {variable} placeholder";
			}
		}

		// Variables validation
		if (formData.variables.length === 0) {
			newErrors.variables = "At least one variable is required";
		} else if (formData.variables.length > v.maxVariables) {
			newErrors.variables = `Maximum ${v.maxVariables} variables allowed`;
		} else {
			const variableErrors: Record<number, VariableErrors> = {};
			const variableNames = new Set<string>();

			formData.variables.forEach((variable, varIndex) => {
				const varErrors: VariableErrors = {};

				// Variable name validation
				if (variable.name.length < v.variableName.minLength) {
					varErrors.name = "Name is required";
				} else if (variable.name.length > v.variableName.maxLength) {
					varErrors.name = `Name must be ${v.variableName.maxLength} characters or less`;
				} else if (!v.variableName.pattern.test(variable.name)) {
					varErrors.name =
						"Name must be lowercase letters, numbers, and underscores only";
				} else if (variableNames.has(variable.name)) {
					varErrors.name = "Variable names must be unique";
				}
				variableNames.add(variable.name);

				// Options validation
				if (variable.options.length === 0) {
					varErrors.options = { 0: { id: "At least one option is required" } };
				} else if (variable.options.length > v.maxOptions) {
					varErrors.options = {
						0: { id: `Maximum ${v.maxOptions} options allowed` },
					};
				} else {
					const optionErrors: Record<number, OptionErrors> = {};
					const optionIds = new Set<string>();

					variable.options.forEach((option, optIndex) => {
						const optErrs: OptionErrors = {};

						// Option ID validation
						if (option.id.length < v.optionId.minLength) {
							optErrs.id = "ID required";
						} else if (option.id.length > v.optionId.maxLength) {
							optErrs.id = `Max ${v.optionId.maxLength} chars`;
						} else if (!v.optionId.pattern.test(option.id)) {
							optErrs.id = "Lowercase + underscores only";
						} else if (optionIds.has(option.id)) {
							optErrs.id = "Option IDs must be unique";
						}
						optionIds.add(option.id);

						// Option label validation
						if (option.label.length < v.optionLabel.minLength) {
							optErrs.label = "Label required";
						} else if (option.label.length > v.optionLabel.maxLength) {
							optErrs.label = `Max ${v.optionLabel.maxLength} chars`;
						}

						// Option prompt fragment validation
						if (option.promptFragment.length < v.promptFragment.minLength) {
							optErrs.promptFragment = "Prompt required";
						} else if (
							option.promptFragment.length > v.promptFragment.maxLength
						) {
							optErrs.promptFragment = `Max ${v.promptFragment.maxLength} chars`;
						}

						if (Object.keys(optErrs).length > 0) {
							optionErrors[optIndex] = optErrs;
						}
					});

					if (Object.keys(optionErrors).length > 0) {
						varErrors.options = optionErrors;
					}
				}

				if (Object.keys(varErrors).length > 0) {
					variableErrors[varIndex] = varErrors;
				}
			});

			if (Object.keys(variableErrors).length > 0) {
				newErrors.variableErrors = variableErrors;
			}
		}

		// Validate that pattern references defined variables
		if (!newErrors.promptPattern && formData.variables.length > 0) {
			const variablePattern = /\{([a-z0-9_]+)\}/g;
			const definedNames = new Set(formData.variables.map((v) => v.name));
			let match;
			const undefinedVars: string[] = [];

			while ((match = variablePattern.exec(formData.promptPattern)) !== null) {
				if (!definedNames.has(match[1])) {
					undefinedVars.push(match[1]);
				}
			}

			if (undefinedVars.length > 0) {
				newErrors.promptPattern = `Pattern references undefined variable(s): ${undefinedVars.join(", ")}`;
			}
		}

		setErrors(newErrors);
		return (
			Object.keys(newErrors).filter((k) => k !== "variableErrors").length ===
				0 && !newErrors.variableErrors
		);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitError(null);

		if (!validateForm()) {
			return;
		}

		setIsSubmitting(true);

		try {
			let savedTemplate: Template;

			if (isEditMode) {
				const input: UpdateTemplateInput = {
					name: formData.name,
					promptPattern: formData.promptPattern,
					variables: formData.variables,
				};
				savedTemplate = await window.forge.templates.update(template.id, input);
			} else {
				const input: CreateTemplateInput = {
					id: formData.id,
					name: formData.name,
					promptPattern: formData.promptPattern,
					variables: formData.variables,
				};
				savedTemplate = await window.forge.templates.create(input);
			}

			onSave(savedTemplate);
		} catch (err) {
			setSubmitError(
				err instanceof Error ? err.message : "Failed to save template"
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleChange = (field: keyof FormData, value: string) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
		// Clear error for this field when user starts typing
		if (errors[field as keyof FormErrors]) {
			setErrors((prev) => ({ ...prev, [field]: undefined }));
		}
	};

	// Variable management
	const addVariable = () => {
		if (formData.variables.length >= VALIDATION.template.maxVariables) return;
		setFormData((prev) => ({
			...prev,
			variables: [...prev.variables, createEmptyVariable()],
		}));
	};

	const removeVariable = (index: number) => {
		setFormData((prev) => ({
			...prev,
			variables: prev.variables.filter((_, i) => i !== index),
		}));
		// Clear variable errors
		if (errors.variableErrors) {
			const newVarErrors = { ...errors.variableErrors };
			delete newVarErrors[index];
			setErrors((prev) => ({ ...prev, variableErrors: newVarErrors }));
		}
	};

	const updateVariableName = (index: number, name: string) => {
		setFormData((prev) => ({
			...prev,
			variables: prev.variables.map((v, i) => (i === index ? { ...v, name } : v)),
		}));
	};

	// Option management
	const addOption = (varIndex: number) => {
		const variable = formData.variables[varIndex];
		if (variable.options.length >= VALIDATION.template.maxOptions) return;

		setFormData((prev) => ({
			...prev,
			variables: prev.variables.map((v, i) =>
				i === varIndex ? { ...v, options: [...v.options, createEmptyOption()] } : v
			),
		}));
	};

	const removeOption = (varIndex: number, optIndex: number) => {
		setFormData((prev) => ({
			...prev,
			variables: prev.variables.map((v, i) =>
				i === varIndex
					? { ...v, options: v.options.filter((_, j) => j !== optIndex) }
					: v
			),
		}));
	};

	const updateOption = (
		varIndex: number,
		optIndex: number,
		field: keyof VariableOption,
		value: string
	) => {
		setFormData((prev) => ({
			...prev,
			variables: prev.variables.map((v, i) =>
				i === varIndex
					? {
							...v,
							options: v.options.map((o, j) =>
								j === optIndex ? { ...o, [field]: value } : o
							),
						}
					: v
			),
		}));
	};

	const getVariableError = (varIndex: number): VariableErrors | undefined => {
		return errors.variableErrors?.[varIndex];
	};

	const getOptionError = (
		varIndex: number,
		optIndex: number
	): OptionErrors | undefined => {
		return errors.variableErrors?.[varIndex]?.options?.[optIndex];
	};

	return (
		<div className="modal-overlay" onClick={onCancel}>
			<div
				className="modal-content template-form"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="modal-header">
					<h3>{isEditMode ? "Edit Template" : "Create Template"}</h3>
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
									<label htmlFor="template-id">ID</label>
									<input
										id="template-id"
										type="text"
										value={formData.id}
										onChange={(e) => handleChange("id", e.target.value)}
										placeholder="my-template-id"
									/>
									{errors.id && <span className="field-error">{errors.id}</span>}
								</div>
							)}

							<div className="field">
								<label htmlFor="template-name">Name</label>
								<input
									id="template-name"
									type="text"
									value={formData.name}
									onChange={(e) => handleChange("name", e.target.value)}
									placeholder="Hero Characters"
								/>
								{errors.name && (
									<span className="field-error">{errors.name}</span>
								)}
							</div>

							<div className="field">
								<label htmlFor="template-pattern">Prompt Pattern</label>
								<textarea
									id="template-pattern"
									value={formData.promptPattern}
									onChange={(e) => handleChange("promptPattern", e.target.value)}
									placeholder="{race} {job}, {rarity} quality, idle pose"
									rows={3}
								/>
								<p className="field-note">
									Use {"{variable_name}"} to reference variables defined below
								</p>
								{errors.promptPattern && (
									<span className="field-error">{errors.promptPattern}</span>
								)}
							</div>
						</div>

						{/* Variables Section */}
						<div className="form-section">
							<h4>Variables</h4>
							{errors.variables && (
								<span className="field-error">{errors.variables}</span>
							)}

							<div className="variables-list">
								{formData.variables.map((variable, varIndex) => {
									const varErrors = getVariableError(varIndex);
									return (
										<div key={varIndex} className="variable-item">
											<div className="variable-header">
												<div className="field variable-name-field">
													<label>Variable Name</label>
													<input
														type="text"
														value={variable.name}
														onChange={(e) =>
															updateVariableName(varIndex, e.target.value)
														}
														placeholder="race"
													/>
													{varErrors?.name && (
														<span className="field-error">{varErrors.name}</span>
													)}
												</div>
												<button
													type="button"
													className="remove-btn"
													onClick={() => removeVariable(varIndex)}
													title="Remove variable"
												>
													&times;
												</button>
											</div>

											<div className="options-list">
												<label className="options-label">Options</label>
												{variable.options.map((option, optIndex) => {
													const optErrors = getOptionError(varIndex, optIndex);
													return (
														<div key={optIndex} className="option-row">
															<div className="option-fields">
																<div className="option-field">
																	<input
																		type="text"
																		value={option.id}
																		onChange={(e) =>
																			updateOption(
																				varIndex,
																				optIndex,
																				"id",
																				e.target.value
																			)
																		}
																		placeholder="orc"
																		className={optErrors?.id ? "has-error" : ""}
																	/>
																	{optErrors?.id && (
																		<span className="field-error mini">
																			{optErrors.id}
																		</span>
																	)}
																</div>
																<div className="option-field">
																	<input
																		type="text"
																		value={option.label}
																		onChange={(e) =>
																			updateOption(
																				varIndex,
																				optIndex,
																				"label",
																				e.target.value
																			)
																		}
																		placeholder="Orc"
																		className={optErrors?.label ? "has-error" : ""}
																	/>
																	{optErrors?.label && (
																		<span className="field-error mini">
																			{optErrors.label}
																		</span>
																	)}
																</div>
																<div className="option-field option-prompt">
																	<input
																		type="text"
																		value={option.promptFragment}
																		onChange={(e) =>
																			updateOption(
																				varIndex,
																				optIndex,
																				"promptFragment",
																				e.target.value
																			)
																		}
																		placeholder="orc, green skin, tusks..."
																		className={
																			optErrors?.promptFragment ? "has-error" : ""
																		}
																	/>
																	{optErrors?.promptFragment && (
																		<span className="field-error mini">
																			{optErrors.promptFragment}
																		</span>
																	)}
																</div>
															</div>
															<button
																type="button"
																className="remove-option-btn"
																onClick={() => removeOption(varIndex, optIndex)}
																title="Remove option"
																disabled={variable.options.length <= 1}
															>
																&times;
															</button>
														</div>
													);
												})}
												<button
													type="button"
													className="add-option-btn"
													onClick={() => addOption(varIndex)}
													disabled={
														variable.options.length >=
														VALIDATION.template.maxOptions
													}
												>
													+ Add Option
												</button>
											</div>
										</div>
									);
								})}
							</div>

							<button
								type="button"
								className="add-variable-btn"
								onClick={addVariable}
								disabled={
									formData.variables.length >= VALIDATION.template.maxVariables
								}
							>
								+ Add Variable
							</button>
						</div>
					</div>

					{submitError && <div className="form-error">{submitError}</div>}

					<div className="form-actions">
						<button type="button" onClick={onCancel} disabled={isSubmitting}>
							Cancel
						</button>
						<button type="submit" className="primary" disabled={isSubmitting}>
							{isSubmitting
								? "Saving..."
								: isEditMode
									? "Save Changes"
									: "Create Template"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};
