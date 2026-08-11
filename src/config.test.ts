// oxlint-disable jest/valid-title
import { AbstractDialect } from "@sequelize/core";
import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { ZodError } from "zod";

import { defineConfig, getConfig } from "#/config";

const { mockSearch } = vi.hoisted(() => ({
	mockSearch: vi.fn(),
}));

vi.mock("cosmiconfig", () => ({
	cosmiconfig: vi.fn(() => ({
		search: mockSearch,
	})),
}));

beforeEach(() => {
	vi.clearAllMocks();
});

describe(defineConfig, () => {
	it("parses and returns configuration with defaults", () => {
		const input = {
			sequelize: { dialect: "postgres" as const },
		};

		const result = defineConfig(input);

		expect(result).toStrictEqual({
			path: {
				migrations: "migrations",
				seeds: "seeds",
			},
			sequelize: { dialect: "postgres" },
		});
	});

	it("accepts custom migration and seed paths", () => {
		const input = {
			path: {
				migrations: "custom-migrations",
				seeds: "custom-seeds",
			},
			sequelize: { dialect: "mysql" as const },
		};

		expect(defineConfig(input)).toStrictEqual(input);
	});

	it("accepts custom dialect class", () => {
		// @ts-expect-error
		class MyCustomDialect extends AbstractDialect {}
		const input = {
			sequelize: { dialect: MyCustomDialect },
		};

		const result = defineConfig(input);
		expect(result.sequelize.dialect).toBe(MyCustomDialect);
	});

	it("throws on invalid dialect string", () => {
		const input = {
			sequelize: { dialect: "mongodb" },
		};

		expect(() => defineConfig(input as any)).toThrow(ZodError);
	});
});

describe(getConfig, () => {
	it("fetches and parses configuration", async () => {
		const config = {
			sequelize: { dialect: "mysql" },
		};
		mockSearch.mockResolvedValue({ config });

		const result = await getConfig();

		expect(mockSearch).toHaveBeenCalledTimes(1);
		expect(result).toStrictEqual({
			path: {
				migrations: "migrations",
				seeds: "seeds",
			},
			sequelize: { dialect: "mysql" },
		});
	});

	it("throws on invalid configuration", async () => {
		const config = {
			sequelize: { dialect: "invalid-db" },
		};
		mockSearch.mockResolvedValue({ config });

		await expect(getConfig()).rejects.toThrow(ZodError);
	});
});
