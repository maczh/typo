// tests/exporter-toMarkdown.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

// src/utils/exporter/toMarkdown.ts
function toMarkdown(markdown) {
  return markdown.replace(/\n+\s*$/, "") + "\n";
}

// tests/exporter-toMarkdown.test.ts
test("toMarkdown trims trailing blank lines to a single newline", () => {
  assert.equal(toMarkdown("hello"), "hello\n");
  assert.equal(toMarkdown("hello\n"), "hello\n");
  assert.equal(toMarkdown("hello\n\n\n"), "hello\n");
  assert.equal(toMarkdown("hello\n\n  \n	\n"), "hello\n");
});
test("toMarkdown preserves internal structure and adds one trailing newline", () => {
  const md = "# Title\n\nSome paragraph.\n\n- a\n- b";
  assert.equal(toMarkdown(md), "# Title\n\nSome paragraph.\n\n- a\n- b\n");
});
test("toMarkdown round-trips an empty document to a single newline", () => {
  assert.equal(toMarkdown(""), "\n");
});
