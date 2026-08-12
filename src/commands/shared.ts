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
	or,
	string,
} from "@optique/core";
import type { InferValue, Message, Mode, Parser } from "@optique/core";
import type { AbstractDialect, Options } from "@sequelize/core";

import { configContext } from "#/config";
import { formatSchema } from "#/generate";
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
	// bound here rather than on the `generate` subcommand: bindConfig's config
	// fallback does not resolve inside a command branch, only at the top level
	format: bindConfig(fail<MigrationFormat>(), {
		context: configContext,
		key: "format",
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

/** `or` makes `--to` and `--step` mutually exclusive at parse time, matching
 * umzug's `MergeExclusive` option shape so the value forwards as-is. */
export function migrateOptions<M extends Mode, T, S>(to: Parser<M, T, S>) {
	return optional(
		or(
			object({ to }),
			object({ step: option("--step", integer({ metavar: "N" })) }),
		),
	);
}

export function targetOption() {
	return option("--to", string({ metavar: "NAME" }));
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
			formatOverride: optional(
				option("--format", choice(formatSchema.options)),
			),
		}),
		{ description },
	);
}
