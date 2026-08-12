#!/usr/bin/env node

import { configure } from "@logtape/logtape";
import { message } from "@optique/core";
import { defineProgram } from "@optique/core/program";
import { createLoggingConfig } from "@optique/logtape";
import { run } from "@optique/run";
import { configContext, execute, loadConfig, parser, pkg } from "sqlumz";

const program = defineProgram({
	parser,
	metadata: {
		name: pkg.name,
		version: pkg.version,
		description: message`${pkg.description}`,
	},
});

// oxlint-disable-next-line unicorn/prefer-top-level-await
run(program, {
	contexts: [configContext],
	contextOptions: {
		load: loadConfig,
	},

	help: "option",
	version: "option",
	completion: "option",
})
	// oxlint-disable-next-line promise/prefer-await-to-then promise/always-return
	.then(async (result) => {
		await configure(await createLoggingConfig(result.logging));

		await execute(result);
	})
	// oxlint-disable-next-line promise/prefer-await-to-then
	.catch((error: unknown) => {
		throw error;
	});
