import { command, message, text } from "@optique/core";
import type { InferValue } from "@optique/core";
import { print } from "@optique/run";

import { generateCommand } from "#/commands/shared";
import type { ConfigValues } from "#/commands/shared";
import { generate } from "#/generate";

export const seedCommand = command(
	"seed",
	generateCommand("seed:generate", message`Scaffold a new seed`),
	{ description: message`Manage seeds` },
);

export type SeedResult = InferValue<typeof seedCommand>;

export async function executeSeed(
	result: SeedResult & ConfigValues,
): Promise<void> {
	const created = await generate({
		format: result.formatOverride ?? result.format,
		name: result.name,
		naming: result.naming,
		targetPath: result.seedsPath,
	});

	print(message`${text(created)}`);
}
