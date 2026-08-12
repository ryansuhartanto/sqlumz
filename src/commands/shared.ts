// oxlint-disable typescript/explicit-module-boundary-types - optique parser types are unwriteable
import { resolve } from "node:path";

import {
	choice,
	command,
	constant,
	integer,
	object,
	option,
	optional,
	string,
	withDefault,
} from "@optique/core";
import type { Message } from "@optique/core";

import type { ConfigResult } from "#/config";
import type { MigrationFormat } from "#/generate";

// TODO: relative paths resolve against the config file's directory, which is wrong
// when the config lives at `.config/sqlumzrc.ts` — it should resolve against the
// project root. Fixing it belongs in config loading, not here.
export function targetPath(
	raw: ConfigResult,
	key: "migrations" | "seeds",
): string {
	return resolve(raw.meta?.configDir ?? process.cwd(), raw.config.path[key]);
}

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
			format: withDefault(
				option(
					"--format",
					choice<MigrationFormat>(["sql", "typescript", "esm"]),
				),
				"typescript" as const,
			),
		}),
		{ description },
	);
}
