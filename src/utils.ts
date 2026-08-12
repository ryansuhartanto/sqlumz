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
