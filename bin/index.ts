#!/usr/bin/env node
// oxlint-disable no-console

import { bindConfig } from "@optique/config";
import type { ConfigLoadResult } from "@optique/config";
import {
	command,
	fail,
	group,
	merge,
	message,
	multiple,
	nonEmpty,
	object,
	option,
	map,
	optional,
	or,
	flag,
} from "@optique/core";
import { defineProgram } from "@optique/core/program";
import { path, run } from "@optique/run";
import { configContext, loadConfig, pkg } from "sqlumz";

const globals = object(
	{
		config: optional(option("-c", "--config", path({ metavar: "CONFIG" }))),
		verbosity: map(multiple(flag("-v", "--verbose")), (flags) => flags.length),

		raw: bindConfig(fail<ConfigLoadResult>(), {
			context: configContext,
			key: (config, meta) => ({ config, meta }),
		}),
	},
	{
		hidden: "usage",
	},
);

const commands = group(
	"Commands",
	or(
		command("init", object({}), {
			description: message`Initialize configuration`,
		}),
	),
);

const parser = merge(group("Global flags", globals), nonEmpty(commands));

const program = defineProgram({
	parser,
	metadata: {
		name: pkg.name,
		version: pkg.version,
		description: pkg.description,
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
	.then((result) => {
		if (result.verbosity >= 2) {
			console.log(result.raw);
		}
	})
	// oxlint-disable-next-line promise/prefer-await-to-then
	.catch((error: unknown) => {
		throw error;
	});
