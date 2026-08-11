import { dirname } from "node:path";

import { createConfigContext } from "@optique/config";
import type { ConfigLoadResult } from "@optique/config";
import { AbstractDialect } from "@sequelize/core";
import type { DialectName, Options } from "@sequelize/core";
import { cosmiconfig } from "cosmiconfig";
import type { Class, UnionToTuple } from "type-fest";
import z from "zod";

import * as pkg from "#/pkg";

const dialectNameSchema = z.enum([
	"mysql",
	"postgres",
	"sqlite3",
	"mariadb",
	"mssql",
	"db2",
	"snowflake",
	"ibmi",
	"oracle",
] satisfies UnionToTuple<DialectName>);

const dialectClassSchema = z.custom<Class<AbstractDialect>>(
	(val) =>
		typeof val === "function" && val.prototype instanceof AbstractDialect,
);

const sequelizeSchema = z.object({
	dialect: z.union([dialectNameSchema, dialectClassSchema]),
}) satisfies z.ZodType<Options<AbstractDialect>>;

export const configSchema = z.strictObject({
	path: z
		.object({
			migrations: z.string().default("migrations"),
			seeds: z.string().default("seeds"),
		})
		.prefault({}),
	sequelize: sequelizeSchema satisfies z.ZodType<Options<AbstractDialect>>,
});

export function defineConfig(config: Config): Config {
	return config;
}

export type Config = z.input<typeof configSchema>;

export const configContext = createConfigContext({
	schema: configSchema,
});

const explorer = cosmiconfig(pkg.name, {
	searchStrategy: "project",
});

export async function loadConfig(parsed: {
	config?: string;
}): Promise<ConfigLoadResult | undefined> {
	const found = await (parsed.config
		? explorer.load(parsed.config)
		: explorer.search());

	if (!found || found.isEmpty) {
		return;
	}

	return {
		config: found.config as unknown,
		meta: {
			configPath: found.filepath,
			configDir: dirname(found.filepath),
		},
	};
}
