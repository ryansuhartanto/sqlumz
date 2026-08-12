// oxlint-disable vitest/valid-title
import { describe, it, expect, vi, afterEach } from "vite-plus/test";

import { getCurrentTimestamp, nextSequence, slugify, splitSql } from "#/utils";

describe(slugify, () => {
	it("lowercases and hyphenates", () => {
		expect(slugify("Hello World")).toBe("hello-world");
	});

	it("strips punctuation and collapses separators", () => {
		expect(slugify("  Foo -- Bar!  ")).toBe("foo-bar");
	});

	it("trims leading and trailing hyphens", () => {
		expect(slugify("-lead trail-")).toBe("lead-trail");
	});

	it("returns empty string when nothing remains", () => {
		expect(slugify("!!!")).toBe("");
	});
});

describe(getCurrentTimestamp, () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("formats the current time as 10 digits", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2020-10-20T12:34:56.789Z"));

		expect(getCurrentTimestamp()).toBe("201020123456");
	});
});

describe(nextSequence, () => {
	it("defaults to width 10 and 1 for an empty list", () => {
		expect(nextSequence([])).toBe("0000000001");
	});

	it("pads to the given width", () => {
		expect(nextSequence(["1"], 4)).toBe("0002");
	});

	it("takes the max of the parsed prefixes", () => {
		expect(nextSequence(["003abc", "010-abc", "007.abc"], 3)).toBe("011");
	});

	it("treats non-numeric names as zero", () => {
		expect(nextSequence(["abc", "def"], 2)).toBe("01");
	});

	it("ignores minus names", () => {
		expect(nextSequence(["-1", "-2"], 2)).toBe("01");
	});
});

describe(splitSql, () => {
	it("splits on semicolons and trims", () => {
		expect(splitSql("SELECT 1; SELECT 2;")).toStrictEqual([
			"SELECT 1",
			"SELECT 2",
		]);
	});

	it("drops empty statements", () => {
		expect(splitSql(";;  ;")).toStrictEqual([]);
	});
});
