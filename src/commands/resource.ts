import {
	argument,
	choice,
	command,
	constant,
	message,
	object,
	option,
	optional,
	or,
	string,
	text,
} from "@optique/core";
import type { InferValue } from "@optique/core";
import { print } from "@optique/run";

import { runOptions, undoOptions } from "#/commands/shared";
import type { ConfigValues } from "#/commands/shared";
import { formatSchema, generate } from "#/generate";
import { run, status, undo } from "#/umzug";

function resourceCommand<const TAction extends string>(action: TAction) {
	const many = `${action}s`;

	return command(
		action,
		or(
			command(
				"run",
				object({
					action: constant(action),
					operation: constant("run"),
					migrate: runOptions(),
				}),
				{ description: message`Apply pending ${text(many)}` },
			),
			command(
				"undo",
				object({
					action: constant(action),
					operation: constant("undo"),
					migrate: undoOptions(),
				}),
				{ description: message`Revert executed ${text(many)}` },
			),
			command(
				"status",
				object({ action: constant(action), operation: constant("status") }),
				{ description: message`Show executed and pending ${text(many)}` },
			),
			command(
				"generate",
				object({
					action: constant(action),
					operation: constant("generate"),
					name: argument(string({ metavar: "NAME" })),
					formatOverride: optional(
						option("--format", choice(formatSchema.options), {
							hidden: "usage",
						}),
					),
				}),
				{ description: message`Scaffold a new ${text(action)}` },
			),
		),
		{ description: message`Manage ${text(many)}` },
	);
}

export const migrationCommand = resourceCommand("migration");

export const seedCommand = resourceCommand("seed");

export type ResourceResult =
	| InferValue<typeof migrationCommand>
	| InferValue<typeof seedCommand>;

/** Which umzug storage table records the resource as executed. */
export type ResourceStore = {
	folder: string;
	modelName?: string;
};

function printNames(names: Array<{ name: string }>, empty: string): void {
	if (names.length === 0) {
		print(message`  ${text(empty)}`);
		return;
	}

	for (const { name } of names) {
		print(message`  ${text(name)}`);
	}
}

export async function executeResource(
	result: ResourceResult & ConfigValues,
	{ folder, modelName }: ResourceStore,
): Promise<void> {
	const sequelizeOptions = result.sequelize.options;
	const store = { sequelizeOptions, folder, modelName };

	switch (result.operation) {
		case "run":
			printNames(
				await run({ ...store, ...result.migrate }),
				"(nothing to run)",
			);

			return;

		case "undo":
			printNames(
				await undo({ ...store, ...result.migrate }),
				"(nothing to undo)",
			);

			return;

		case "status": {
			const { executed, pending } = await status(store);

			print(message`Executed:`);
			printNames(executed, "(none)");
			print(message`Pending:`);
			printNames(pending, "(none)");

			return;
		}

		case "generate": {
			const created = await generate({
				format: result.formatOverride ?? result.format,
				name: result.name,
				naming: result.naming,
				emptyName: result.emptyName,
				targetPath: folder,
			});

			print(message`${text(created)}`);
		}
	}
}
