import { basename, dirname } from "node:path";

import { createConfigContext } from "@optique/config";
import type { ConfigLoadResult, ConfigMeta } from "@optique/config";
import { AbstractDialect } from "@sequelize/core";
import type { Options } from "@sequelize/core";
// default import: the module is CJS, so Node cannot detect its named exports
import sequelizeTypescript from "@sequelize/core/_non-semver-use-at-your-own-risk_/sequelize-typescript.js";
import { cosmiconfig } from "cosmiconfig";
import type { Class } from "type-fest";
import z from "zod";

import { formatSchema, namingSchema } from "#/generate";
import * as pkg from "#/pkg";

const dialectNameSchema = z.enum(sequelizeTypescript.SUPPORTED_DIALECTS);

const dialectClassSchema = z.custom<Class<AbstractDialect>>(
	(val) =>
		typeof val === "function" && val.prototype instanceof AbstractDialect,
);

// looseObject: dialect-specific connection options (`storage`, `host`, `port`,
// ...) aren't known to this schema, so unknown keys must pass through instead
// of being stripped
const sequelizeSchema = z.looseObject({
	dialect: z.union([dialectNameSchema, dialectClassSchema]),
}) satisfies z.ZodType<Options<AbstractDialect>>;

export const configSchema = z.strictObject({
	// TODO: default to "ts" only when the project has a tsconfig, "js" otherwise.
	format: formatSchema.default("ts"),
	naming: namingSchema.default("timestamp"),
	path: z
		.object({
			migrations: z.string().default("migrations"),
			seeds: z.string().default("seeds"),
		})
		.prefault({}),
	sequelize: sequelizeSchema.optional(),
});

export function defineConfig(config: Config): Config {
	return config;
}

export type Config = z.input<typeof configSchema>;

export type ResolvedConfig = z.output<typeof configSchema>;

export type ProjectMeta = {
	/** Base for relative `path` entries. Not always `configDir`. */
	rootDir: string;
} & ConfigMeta;

export const configContext = createConfigContext<ResolvedConfig, ProjectMeta>({
	schema: configSchema,
});

const explorer = cosmiconfig(pkg.name, {
	searchStrategy: "project",
});

export async function loadConfig(parsed: {
	config?: string;
}): Promise<ConfigLoadResult<ProjectMeta> | undefined> {
	const found = await (parsed.config
		? explorer.load(parsed.config)
		: explorer.search());

	if (!found || found.isEmpty) {
		return;
	}

	const configDir = dirname(found.filepath);

	return {
		config: found.config as unknown,
		meta: {
			configPath: found.filepath,
			configDir,
			// cosmiconfig also searches `<root>/.config/`, so the file's own
			// directory is a directory below the project root there
			rootDir:
				basename(configDir) === ".config" ? dirname(configDir) : configDir,
		},
	};
}
