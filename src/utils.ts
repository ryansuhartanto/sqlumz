import { readFile } from "node:fs/promises";
import { findPackageJSON } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function slugify(text: string): string {
	return text
		.normalize("NFKD")
		.replaceAll(/[^a-z0-9\s-]/gi, "")
		.replaceAll(/[\s-]+/g, "-")
		.replaceAll(/^-|-$/g, "")
		.toLowerCase();
}

export function getCurrentTimestamp(): string {
	const now = new Date();
	const iso = now.toISOString();

	return iso.slice(2, -5).replaceAll(/\D/g, "").toLowerCase();
}

export function nextSequence(existingNames: string[], width = 10): string {
	const seqs = existingNames.map((name) => {
		// oxlint-disable-next-line unicorn/prefer-number-coercion - handle prefix only
		const val = Number.parseInt(name, 10);
		return !Number.isNaN(val) ? val : 0;
	});

	const next = Math.max(0, ...seqs) + 1;
	return next.toString().padStart(width, "0");
}

export function splitSql(sql: string): string[] {
	return sql
		.split(";")
		.map((statement) => statement.trim())
		.filter(Boolean);
}

export async function isEsmProject(startDir: string): Promise<boolean> {
	try {
		// findPackageJSON returns the resolved base, not undefined, when the walk
		// reaches the filesystem root without finding one, and throws outright on
		// a malformed nearest package.json
		const found = findPackageJSON(
			".",
			pathToFileURL(join(resolve(startDir), "/")),
		);

		if (found?.endsWith("package.json") !== true) {
			return false;
		}

		const raw = await readFile(found, "utf8");

		return (JSON.parse(raw) as { type?: unknown }).type === "module";
	} catch {
		return false;
	}
}
