import oxfmt from "@kekkon-nexus/config/oxfmt";
import oxlint from "@kekkon-nexus/config/oxlint";
import vp from "@kekkon-nexus/config/oxlint/vite-plus";
import { defineConfig } from "vite-plus";

export default defineConfig({
	fmt: {
		...oxfmt,
	},
	lint: {
		extends: [oxlint, vp],
		jsPlugins: [
			{
				name: "no-relative-import-paths",
				specifier: "eslint-plugin-no-relative-import-paths",
			},
		],

		rules: {
			"no-relative-import-paths/no-relative-import-paths": [
				"warn",
				{ allowSameFolder: false, rootDir: `./src`, prefix: "#" },
			],
		},
	},
	staged: {
		"*": "vp check --fix --no-error-on-unmatched-pattern",
	},

	run: {
		cache: true,
	},

	resolve: {
		conditions: ["dev"],
	},
	ssr: {
		resolve: {
			conditions: ["dev"],
		},
	},

	pack: [
		{
			entry: ["src/**/*.ts", "!src/**/*.test.ts"],
			fixedExtension: false,
			sourcemap: true,

			deps: {
				neverBundle: [/^#/],
			},
		},
		{
			entry: {
				"bin/index": "bin/index.ts",
			},
			fixedExtension: false,
			sourcemap: true,

			deps: {
				neverBundle: ["sqlumz"],
			},
			dts: false,
		},
	],
	test: {
		experimental: {
			fsModuleCache: true,
		},
	},
});
