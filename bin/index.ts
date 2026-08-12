#!/usr/bin/env node
// oxlint-disable no-console

import { bindConfig } from "@optique/config";
import {
	fail,
	flag,
	group,
	map,
	merge,
	message,
	multiple,
	nonEmpty,
	object,
	option,
	optional,
} from "@optique/core";
import { defineProgram } from "@optique/core/program";
import { path, run } from "@optique/run";
import { commands, configContext, execute, loadConfig, pkg } from "sqlumz";
import type { ConfigResult } from "sqlumz";

const globals = object(
	{
		config: optional(option("-c", "--config", path({ metavar: "CONFIG" }))),
		verbosity: map(multiple(flag("-v", "--verbose")), (flags) => flags.length),

		raw: bindConfig(fail<ConfigResult>(), {
			context: configContext,
			key: (config, meta) => ({ config, meta }),
		}),
	},
	{
		hidden: "usage",
	},
);

const parser = merge(group("Global flags", globals), nonEmpty(commands));

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
			console.log(result.raw);
		}

		await execute(result, result.raw);
	})
	// oxlint-disable-next-line promise/prefer-await-to-then
	.catch((error: unknown) => {
		throw error;
	});
