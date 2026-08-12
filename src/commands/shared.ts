// oxlint-disable typescript/explicit-module-boundary-types - optique parser types are unwriteable
import { resolve } from "node:path";

import { bindConfig } from "@optique/config";
import {
	choice,
	command,
	constant,
	fail,
	integer,
	map,
	object,
	option,
	optional,
	or,
	string,
} from "@optique/core";
import type { InferValue, Message } from "@optique/core";
import type { AbstractDialect, Options } from "@sequelize/core";

import { configContext } from "#/config";
import type { ProjectMeta } from "#/config";
import { formatSchema } from "#/generate";
import type { MigrationFormat, MigrationNaming } from "#/generate";

function fromRootDir(meta: ProjectMeta | undefined, path: string): string {
	return resolve(meta?.rootDir ?? process.cwd(), path);
}

export const configOptions = object({
	migrationsPath: bindConfig(fail<string>(), {
		context: configContext,
		key: (config, meta) => fromRootDir(meta, config.path.migrations),
	}),
	seedsPath: bindConfig(fail<string>(), {
		context: configContext,
		key: (config, meta) => fromRootDir(meta, config.path.seeds),
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
function exclusive<T>(mapTarget: (to: string) => T) {
	return optional(
		or(
			object({
				to: map(option("--to", string({ metavar: "NAME" })), mapTarget),
			}),
			object({ step: option("--step", integer({ metavar: "N" })) }),
		),
	);
}

export function runOptions() {
	return exclusive((to) => to);
}

/** `--to 0` reverts everything; umzug spells that as the number `0`. */
export function undoOptions() {
	return exclusive((to) => (to === "0" ? 0 : to));
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
