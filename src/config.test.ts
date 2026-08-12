// oxlint-disable vitest/valid-title
import { dirname } from "node:path";

import { AbstractDialect } from "@sequelize/core";
import { SUPPORTED_DIALECTS } from "@sequelize/core/_non-semver-use-at-your-own-risk_/sequelize-typescript.js";
import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { ZodError } from "zod";

import { configSchema, defineConfig, loadConfig } from "#/config";

const { mockExplorer } = vi.hoisted(() => ({
	mockExplorer: {
		search: vi.fn(),
		load: vi.fn(),
	},
}));

vi.mock("cosmiconfig", () => ({
	cosmiconfig: vi.fn().mockReturnValue(mockExplorer),
}));

beforeEach(() => {
	vi.clearAllMocks();
});

describe(configSchema.parse, () => {
	it("parses dialect with default", () => {
		const config = { sequelize: { dialect: "postgres" } };

		expect(configSchema.parse(config)).toStrictEqual({
			naming: "timestamp",
			path: {
				migrations: "migrations",
				seeds: "seeds",
			},
			sequelize: { dialect: "postgres" },
		});
	});

	it.each(SUPPORTED_DIALECTS)("validates dialect name: %s", (dialect) => {
		const config = { sequelize: { dialect } };

		expect(configSchema.parse(config)).toBeDefined();
	});

	it("validates custom dialect class", () => {
		// @ts-expect-error
		class MockDialect extends AbstractDialect {}
		const config = { sequelize: { dialect: MockDialect } };

		expect(configSchema.parse(config)).toBeDefined();
	});

	it("rejects invalid dialects", () => {
		const config = { sequelize: { dialect: "?" } };

		expect(() => configSchema.parse(config)).toThrow(ZodError);
	});
});

describe(defineConfig, () => {
	it("returns configuration as is", () => {
		const config = { sequelize: { dialect: "mysql" } } as const;

		expect(defineConfig(config)).toStrictEqual(config);
	});
});

describe(loadConfig, () => {
	it("returns undefined if configuration is not found", async () => {
		mockExplorer.search = vi.fn().mockResolvedValueOnce(null);
		mockExplorer.load = vi.fn().mockResolvedValueOnce(null);

		await expect(loadConfig({})).resolves.toBeUndefined();
		await expect(loadConfig({ config: "?" })).resolves.toBeUndefined();
	});

	it("returns undefined if configuration is empty", async () => {
		mockExplorer.search = vi.fn().mockResolvedValueOnce({ isEmpty: true });
		mockExplorer.load = vi.fn().mockResolvedValueOnce({ isEmpty: true });

		await expect(loadConfig({})).resolves.toBeUndefined();
		await expect(loadConfig({ config: "?" })).resolves.toBeUndefined();
	});

	it("loads configuration", async () => {
		const config = { sequelize: { dialect: "postgres" } };
		const filepath = "sqlumz.config.ts";

		mockExplorer.search = vi.fn().mockResolvedValueOnce({
			config,
			filepath,
			isEmpty: false,
		});
		mockExplorer.load = vi.fn().mockResolvedValueOnce({
			config,
			filepath,
			isEmpty: false,
		});

		await expect(loadConfig({})).resolves.toStrictEqual({
			config,
			meta: {
				configPath: filepath,
				configDir: dirname(filepath),
			},
		});
		await expect(loadConfig({ config: filepath })).resolves.toStrictEqual({
			config,
			meta: {
				configPath: filepath,
				configDir: dirname(filepath),
			},
		});
	});
});
