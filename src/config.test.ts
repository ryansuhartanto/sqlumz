// oxlint-disable vitest/valid-title
import { dirname } from "node:path";

import { AbstractDialect } from "@sequelize/core";
import { SUPPORTED_DIALECTS } from "@sequelize/core/_non-semver-use-at-your-own-risk_/sequelize-typescript.js";
import { SqliteDialect } from "@sequelize/sqlite3";
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
			format: "ts",
			naming: "timestamp",
			emptyName: "warn",
			path: {
				migrations: "migrations",
				seeds: "seeds",
			},
			sequelize: { dialect: "postgres" },
		});
	});

	it.each(["warn", "silent", "error"])("accepts emptyName: %s", (emptyName) => {
		const config = { sequelize: { dialect: "postgres" }, emptyName };

		expect(configSchema.parse(config).emptyName).toBe(emptyName);
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

	it("retains dialect-specific connection options instead of stripping them", () => {
		const config = {
			sequelize: { dialect: "sqlite3", storage: "/tmp/x.sqlite" },
		};

		expect(configSchema.parse(config).sequelize).toStrictEqual({
			dialect: "sqlite3",
			storage: "/tmp/x.sqlite",
		});
	});

	it("retains multiple dialect-specific connection options", () => {
		const config = {
			sequelize: { dialect: "postgres", host: "db.example", port: 5432 },
		};

		expect(configSchema.parse(config).sequelize).toStrictEqual({
			dialect: "postgres",
			host: "db.example",
			port: 5432,
		});
	});

	it("rejects unknown top-level keys", () => {
		const config = { notAConfigKey: true };

		expect(() => configSchema.parse(config)).toThrow(ZodError);
	});
});

describe(defineConfig, () => {
	it("returns configuration as is", () => {
		const config = { sequelize: { dialect: "mysql" } } as const;

		expect(defineConfig(config)).toStrictEqual(config);
	});

	it("accepts a dialect class with its connection options", () => {
		const config = defineConfig({
			sequelize: { dialect: SqliteDialect, storage: "./db.sqlite" },
		});

		expect(config.sequelize).toStrictEqual({
			dialect: SqliteDialect,
			storage: "./db.sqlite",
		});
	});

	it("accepts a dialect name with its connection options", () => {
		const config = defineConfig({
			sequelize: { dialect: "postgres", host: "localhost", port: 5432 },
		});

		expect(config.sequelize).toStrictEqual({
			dialect: "postgres",
			host: "localhost",
			port: 5432,
		});
	});

	it("accepts an empty configuration", () => {
		expect(defineConfig({})).toStrictEqual({});
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
				rootDir: dirname(filepath),
			},
		});
		await expect(loadConfig({ config: filepath })).resolves.toStrictEqual({
			config,
			meta: {
				configPath: filepath,
				configDir: dirname(filepath),
				rootDir: dirname(filepath),
			},
		});
	});

	it("roots a `.config/` layout at the project directory", async () => {
		const filepath = "/project/.config/sqlumzrc.ts";

		mockExplorer.search = vi.fn().mockResolvedValueOnce({
			config: {},
			filepath,
			isEmpty: false,
		});

		await expect(loadConfig({})).resolves.toStrictEqual({
			config: {},
			meta: {
				configPath: filepath,
				configDir: "/project/.config",
				rootDir: "/project",
			},
		});
	});
});
