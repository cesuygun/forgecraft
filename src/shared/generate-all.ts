// ABOUTME: Utilities for Generate All feature
// ABOUTME: Computes cartesian product of template variable options

import type { VariableOption } from "./types";

/**
 * Represents a variable axis for combination generation.
 * Can be set to "select all" or have a specific selected option.
 */
export interface VariableAxis {
	name: string;
	options: VariableOption[];
	selectAll: boolean;
	selectedId?: string; // Used when selectAll is false
}

/**
 * Computes all combinations of variable selections.
 * For variables with selectAll=true, all options are used.
 * For variables with selectAll=false, only the selectedId is used.
 *
 * @param axes - Array of variable axes with their options and selection state
 * @returns Array of combination objects mapping variable names to option IDs
 */
export const computeCombinations = (
	axes: VariableAxis[]
): Record<string, string>[] => {
	if (axes.length === 0) {
		return [{}];
	}

	// Start with a single empty combination
	let combinations: Record<string, string>[] = [{}];

	// For each variable axis, expand combinations
	for (const axis of axes) {
		const optionIds = axis.selectAll
			? axis.options.map((opt) => opt.id)
			: axis.selectedId
				? [axis.selectedId]
				: [];

		const newCombinations: Record<string, string>[] = [];

		for (const combo of combinations) {
			for (const optionId of optionIds) {
				newCombinations.push({
					...combo,
					[axis.name]: optionId,
				});
			}
		}

		combinations = newCombinations;
	}

	return combinations;
};

/**
 * Counts the number of combinations without generating them.
 * More efficient than computeCombinations(axes).length for large sets.
 *
 * @param axes - Array of variable axes with their options and selection state
 * @returns Total number of combinations
 */
export const countCombinations = (axes: VariableAxis[]): number => {
	if (axes.length === 0) {
		return 1;
	}

	return axes.reduce((total, axis) => {
		const count = axis.selectAll ? axis.options.length : 1;
		return total * count;
	}, 1);
};
