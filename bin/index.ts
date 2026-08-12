#!/usr/bin/env node
// oxlint-disable no-console

import { message } from "@optique/core";
import { defineProgram } from "@optique/core/program";
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
		if (result.verbosity >= 2) {
			console.log(result);
		}

		await execute(result);
	})
	// oxlint-disable-next-line promise/prefer-await-to-then
	.catch((error: unknown) => {
		throw error;
	});
