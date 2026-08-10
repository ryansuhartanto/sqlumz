import oxfmt from "@kekkon-nexus/config/oxfmt";
import oxlint from "@kekkon-nexus/config/oxlint";
import { defineConfig } from "vite-plus";

export default defineConfig({
	fmt: {
		...oxfmt,
		ignorePatterns: ["aube-lock.yaml"],
	},
	lint: {
		extends: [oxlint],
		jsPlugins: [
			{
				name: "vite-plus",
				specifier: "vite-plus/oxlint-plugin",
			},
			{
				name: "no-relative-import-paths",
				specifier: "eslint-plugin-no-relative-import-paths",
			},
		],

		rules: {
			"vite-plus/prefer-vite-plus-imports": "error",
			"no-relative-import-paths/no-relative-import-paths": [
				"warn",
				{ allowSameFolder: false, rootDir: `/src`, prefix: "#" },
			],
		},
	},
	staged: {
		"*": "vp check --fix --no-error-on-unmatched-pattern",
	},

	pack: [
		{
			format: ["esm", "cjs"],
			sourcemap: true,
			unbundle: true,
		},
		{
			entry: {
				"bin/*": "bin/*.ts",
			},
			format: "cjs",
			sourcemap: true,

			dts: false,
		},
	],
});
