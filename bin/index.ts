#!/usr/bin/env node
// oxlint-disable no-console

import { cli, define } from "gunshi";
import { getConfig } from "sqlumz";
import packageJson from "sqlumz/package.json" with { type: "json" };

const command = define({
	args: {
		"config": {
			type: "string",
			short: "c",
			description: "Specify custom configuration file",
		},
		"dump-config": {
			type: "boolean",
			short: "d",
			description: "Dump parsed configuration",
		},
	},
	async run(ctx) {
		const config = await getConfig(ctx.values.config);

		if (ctx.values["dump-config"]) {
			console.log(config);
		}
	},
});

await cli(process.argv.slice(2), command, {
	name: packageJson.name,
	description: packageJson.description,
	version: packageJson.version,
});
