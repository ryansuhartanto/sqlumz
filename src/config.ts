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

import { emptyNameSchema, formatSchema, namingSchema } from "#/generate";
import * as pkg from "#/pkg";

const dialectNameSchema = z.enum(sequelizeTypescript.SUPPORTED_DIALECTS);

const dialectClassSchema = z.custom<Class<AbstractDialect>>(
	(val) =>
		typeof val === "function" && val.prototype instanceof AbstractDialect,
);

// looseObject: dialect-specific connection options (`storage`, `host`, `port`,
// ...) aren't known to this schema, so unknown keys must pass through instead
// of being stripped. Annotated (rather than `satisfies`) so the exported type
// carries real `Options<AbstractDialect>` fields instead of the schema's own
// index-signature type.
const sequelizeSchema: z.ZodType<
	Options<AbstractDialect>,
	Options<AbstractDialect>
> = z.looseObject({
	dialect: z.union([dialectNameSchema, dialectClassSchema]),
});

export const configSchema = z.strictObject({
	format: formatSchema.default("ts"),
	naming: namingSchema.default("timestamp"),
	emptyName: emptyNameSchema.default("warn"),
	path: z
		.object({
			migrations: z.string().default("migrations"),
			seeds: z.string().default("seeds"),
		})
		.prefault({}),
	sequelize: sequelizeSchema.optional(),
});

// `Omit<Config, "sequelize">` rather than plain `Config &`: intersecting two
// `Options<...>` instantiations for the same property (the base `Config`'s and
// this function's generic one) blows up to "type instantiation is excessively
// deep" during inference.
export function defineConfig<Dialect extends AbstractDialect = AbstractDialect>(
	config: Omit<Config, "sequelize"> & { sequelize?: Options<Dialect> },
): Config {
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

// `init` writes a config file after searching for one in the same process;
// call this right after so a later `loadConfig` doesn't see the stale
// "not found" cosmiconfig cached from before the write.
export function clearConfigSearchCache(): void {
	explorer.clearSearchCache();
}

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
