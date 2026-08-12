// oxlint-disable typescript/explicit-module-boundary-types - optique parser types are unwriteable
import { resolve } from "node:path";

import { bindConfig } from "@optique/config";
import type { ConfigMeta } from "@optique/config";
import {
	choice,
	command,
	constant,
	fail,
	integer,
	object,
	option,
	optional,
	string,
	withDefault,
} from "@optique/core";
import type { InferValue, Message } from "@optique/core";
import type { AbstractDialect, Options } from "@sequelize/core";

import { configContext } from "#/config";
import type { MigrationFormat, MigrationNaming } from "#/generate";

// TODO: relative paths resolve against the config file's directory, which is wrong
// when the config lives at `.config/sqlumzrc.ts` — it should resolve against the
// project root. Fixing it belongs in config loading, not here.
function fromConfigDir(meta: ConfigMeta | undefined, path: string): string {
	return resolve(meta?.configDir ?? process.cwd(), path);
}

export const configOptions = object({
	migrationsPath: bindConfig(fail<string>(), {
		context: configContext,
		key: (config, meta) => fromConfigDir(meta, config.path.migrations),
	}),
	seedsPath: bindConfig(fail<string>(), {
		context: configContext,
		key: (config, meta) => fromConfigDir(meta, config.path.seeds),
	}),
	naming: bindConfig(fail<MigrationNaming>(), {
		context: configContext,
		key: "naming",
	}),
	// wrapped: bindConfig reads an `undefined` accessor result as "missing" and
	// fails the parse, but `sequelize` is legitimately absent when scaffolding
	sequelize: bindConfig(
		fail<{ options: Options<AbstractDialect> | undefined }>(),
		{
			context: configContext,
			key: (config) => ({ options: config.sequelize }),
		},
	),
});

export type ConfigValues = InferValue<typeof configOptions>;

export function stepOptions() {
	return {
		to: optional(option("--to", string({ metavar: "NAME" }))),
		step: optional(option("--step", integer({ metavar: "N" }))),
	};
}

export function generateCommand<const TAction extends string>(
	action: TAction,
	description: Message,
) {
	return command(
		"generate",
		object({
			action: constant(action),
			name: option("--name", string({ metavar: "NAME" })),
			// TODO: default to "ts" only when the project has a tsconfig, "js" otherwise.
			format: withDefault(
				option("--format", choice<MigrationFormat>(["sql", "ts", "js"])),
				"ts" as const,
			),
		}),
		{ description },
	);
}
