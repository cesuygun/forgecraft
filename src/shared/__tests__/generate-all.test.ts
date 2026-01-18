// ABOUTME: Tests for Generate All utility functions
// ABOUTME: Verifies cartesian product calculation and combination counting

import { describe, it, expect } from "vitest";
import {
	computeCombinations,
	countCombinations,
	type VariableAxis,
} from "../generate-all";

describe("Generate All utilities", () => {
	describe("computeCombinations", () => {
		it("returns single combination when no variables", () => {
			const result = computeCombinations([]);
			expect(result).toEqual([{}]);
		});

		it("returns all options for single variable with all selected", () => {
			const axes: VariableAxis[] = [
				{
					name: "slot",
					options: [
						{ id: "boots", label: "Boots", promptFragment: "boots" },
						{ id: "helmet", label: "Helmet", promptFragment: "helmet" },
					],
					selectAll: true,
				},
			];

			const result = computeCombinations(axes);

			expect(result).toEqual([{ slot: "boots" }, { slot: "helmet" }]);
		});

		it("returns single option for single variable with specific selection", () => {
			const axes: VariableAxis[] = [
				{
					name: "slot",
					options: [
						{ id: "boots", label: "Boots", promptFragment: "boots" },
						{ id: "helmet", label: "Helmet", promptFragment: "helmet" },
					],
					selectAll: false,
					selectedId: "helmet",
				},
			];

			const result = computeCombinations(axes);

			expect(result).toEqual([{ slot: "helmet" }]);
		});

		it("computes cartesian product for multiple variables with all selected", () => {
			const axes: VariableAxis[] = [
				{
					name: "slot",
					options: [
						{ id: "boots", label: "Boots", promptFragment: "boots" },
						{ id: "helmet", label: "Helmet", promptFragment: "helmet" },
					],
					selectAll: true,
				},
				{
					name: "rarity",
					options: [
						{ id: "common", label: "Common", promptFragment: "common" },
						{ id: "epic", label: "Epic", promptFragment: "epic" },
					],
					selectAll: true,
				},
			];

			const result = computeCombinations(axes);

			// 2 slots x 2 rarities = 4 combinations
			expect(result).toHaveLength(4);
			expect(result).toEqual([
				{ slot: "boots", rarity: "common" },
				{ slot: "boots", rarity: "epic" },
				{ slot: "helmet", rarity: "common" },
				{ slot: "helmet", rarity: "epic" },
			]);
		});

		it("handles partial selection (some All, some specific)", () => {
			const axes: VariableAxis[] = [
				{
					name: "slot",
					options: [
						{ id: "boots", label: "Boots", promptFragment: "boots" },
						{ id: "helmet", label: "Helmet", promptFragment: "helmet" },
						{ id: "shield", label: "Shield", promptFragment: "shield" },
					],
					selectAll: true,
				},
				{
					name: "rarity",
					options: [
						{ id: "common", label: "Common", promptFragment: "common" },
						{ id: "epic", label: "Epic", promptFragment: "epic" },
						{ id: "legendary", label: "Legendary", promptFragment: "legendary" },
					],
					selectAll: false,
					selectedId: "epic",
				},
			];

			const result = computeCombinations(axes);

			// 3 slots x 1 rarity = 3 combinations
			expect(result).toHaveLength(3);
			expect(result).toEqual([
				{ slot: "boots", rarity: "epic" },
				{ slot: "helmet", rarity: "epic" },
				{ slot: "shield", rarity: "epic" },
			]);
		});

		it("generates combinations in correct order (first variable outer loop)", () => {
			const axes: VariableAxis[] = [
				{
					name: "slot",
					options: [
						{ id: "boots", label: "Boots", promptFragment: "boots" },
						{ id: "helmet", label: "Helmet", promptFragment: "helmet" },
					],
					selectAll: true,
				},
				{
					name: "rarity",
					options: [
						{ id: "common", label: "Common", promptFragment: "common" },
						{ id: "uncommon", label: "Uncommon", promptFragment: "uncommon" },
						{ id: "epic", label: "Epic", promptFragment: "epic" },
					],
					selectAll: true,
				},
			];

			const result = computeCombinations(axes);

			// First variable (slot) changes slowest, last variable (rarity) changes fastest
			// boots: common, uncommon, epic
			// helmet: common, uncommon, epic
			expect(result[0]).toEqual({ slot: "boots", rarity: "common" });
			expect(result[1]).toEqual({ slot: "boots", rarity: "uncommon" });
			expect(result[2]).toEqual({ slot: "boots", rarity: "epic" });
			expect(result[3]).toEqual({ slot: "helmet", rarity: "common" });
		});

		it("handles three variables", () => {
			const axes: VariableAxis[] = [
				{
					name: "slot",
					options: [
						{ id: "boots", label: "Boots", promptFragment: "boots" },
						{ id: "helmet", label: "Helmet", promptFragment: "helmet" },
					],
					selectAll: true,
				},
				{
					name: "rarity",
					options: [
						{ id: "common", label: "Common", promptFragment: "common" },
						{ id: "epic", label: "Epic", promptFragment: "epic" },
					],
					selectAll: true,
				},
				{
					name: "material",
					options: [
						{ id: "iron", label: "Iron", promptFragment: "iron" },
						{ id: "gold", label: "Gold", promptFragment: "gold" },
					],
					selectAll: true,
				},
			];

			const result = computeCombinations(axes);

			// 2 x 2 x 2 = 8 combinations
			expect(result).toHaveLength(8);
			expect(result[0]).toEqual({ slot: "boots", rarity: "common", material: "iron" });
			expect(result[7]).toEqual({ slot: "helmet", rarity: "epic", material: "gold" });
		});
	});

	describe("computeCombinations edge cases", () => {
		it("returns empty array when selectAll=false and no selectedId", () => {
			const axes: VariableAxis[] = [
				{
					name: "slot",
					options: [
						{ id: "boots", label: "Boots", promptFragment: "boots" },
						{ id: "helmet", label: "Helmet", promptFragment: "helmet" },
					],
					selectAll: false,
					// No selectedId - edge case
				},
			];

			const result = computeCombinations(axes);

			expect(result).toEqual([]);
		});

		it("returns empty array when any variable has no selected options", () => {
			const axes: VariableAxis[] = [
				{
					name: "slot",
					options: [
						{ id: "boots", label: "Boots", promptFragment: "boots" },
					],
					selectAll: true,
				},
				{
					name: "rarity",
					options: [
						{ id: "common", label: "Common", promptFragment: "common" },
					],
					selectAll: false,
					// No selectedId - this makes the entire product 0
				},
			];

			const result = computeCombinations(axes);

			expect(result).toEqual([]);
		});
	});

	describe("countCombinations", () => {
		it("returns 1 when no variables", () => {
			expect(countCombinations([])).toBe(1);
		});

		it("returns option count for single variable with all selected", () => {
			const axes: VariableAxis[] = [
				{
					name: "slot",
					options: [
						{ id: "boots", label: "Boots", promptFragment: "boots" },
						{ id: "helmet", label: "Helmet", promptFragment: "helmet" },
						{ id: "shield", label: "Shield", promptFragment: "shield" },
					],
					selectAll: true,
				},
			];

			expect(countCombinations(axes)).toBe(3);
		});

		it("returns 1 for single variable with specific selection", () => {
			const axes: VariableAxis[] = [
				{
					name: "slot",
					options: [
						{ id: "boots", label: "Boots", promptFragment: "boots" },
						{ id: "helmet", label: "Helmet", promptFragment: "helmet" },
					],
					selectAll: false,
					selectedId: "boots",
				},
			];

			expect(countCombinations(axes)).toBe(1);
		});

		it("returns product for multiple variables with all selected", () => {
			const axes: VariableAxis[] = [
				{
					name: "slot",
					options: [
						{ id: "boots", label: "Boots", promptFragment: "boots" },
						{ id: "helmet", label: "Helmet", promptFragment: "helmet" },
						{ id: "shield", label: "Shield", promptFragment: "shield" },
						{ id: "sword", label: "Sword", promptFragment: "sword" },
						{ id: "staff", label: "Staff", promptFragment: "staff" },
					],
					selectAll: true,
				},
				{
					name: "rarity",
					options: [
						{ id: "common", label: "Common", promptFragment: "common" },
						{ id: "uncommon", label: "Uncommon", promptFragment: "uncommon" },
						{ id: "rare", label: "Rare", promptFragment: "rare" },
						{ id: "epic", label: "Epic", promptFragment: "epic" },
						{ id: "legendary", label: "Legendary", promptFragment: "legendary" },
					],
					selectAll: true,
				},
			];

			// 5 slots x 5 rarities = 25 combinations
			expect(countCombinations(axes)).toBe(25);
		});

		it("returns correct count for partial selection", () => {
			const axes: VariableAxis[] = [
				{
					name: "slot",
					options: [
						{ id: "boots", label: "Boots", promptFragment: "boots" },
						{ id: "helmet", label: "Helmet", promptFragment: "helmet" },
						{ id: "shield", label: "Shield", promptFragment: "shield" },
						{ id: "sword", label: "Sword", promptFragment: "sword" },
						{ id: "staff", label: "Staff", promptFragment: "staff" },
					],
					selectAll: true,
				},
				{
					name: "rarity",
					options: [
						{ id: "common", label: "Common", promptFragment: "common" },
						{ id: "epic", label: "Epic", promptFragment: "epic" },
					],
					selectAll: false,
					selectedId: "epic",
				},
			];

			// 5 slots x 1 rarity = 5 combinations
			expect(countCombinations(axes)).toBe(5);
		});

		it("returns 0 when selectAll=false and no selectedId", () => {
			const axes: VariableAxis[] = [
				{
					name: "slot",
					options: [
						{ id: "boots", label: "Boots", promptFragment: "boots" },
						{ id: "helmet", label: "Helmet", promptFragment: "helmet" },
					],
					selectAll: false,
					// No selectedId - edge case
				},
			];

			expect(countCombinations(axes)).toBe(0);
		});

		it("returns 0 when any variable has no selected options", () => {
			const axes: VariableAxis[] = [
				{
					name: "slot",
					options: [
						{ id: "boots", label: "Boots", promptFragment: "boots" },
					],
					selectAll: true,
				},
				{
					name: "rarity",
					options: [
						{ id: "common", label: "Common", promptFragment: "common" },
					],
					selectAll: false,
					// No selectedId - this makes the entire count 0
				},
			];

			expect(countCombinations(axes)).toBe(0);
		});
	});
});
