// tests/outline.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

// src/utils/outline.ts
function nest(flat) {
  const root = [];
  const stack = [];
  for (const item of flat) {
    while (stack.length && stack[stack.length - 1].level >= item.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      root.push(item);
    } else {
      stack[stack.length - 1].children.push(item);
    }
    stack.push(item);
  }
  return root;
}
function buildOutlineFromMarkdown(markdown) {
  const lines = markdown.split("\n");
  const flat = [];
  let inFence = false;
  let index = 0;
  lines.forEach((line) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) {
      const level = m[1].length;
      const text = m[2].trim();
      flat.push({
        id: `heading-${index++}`,
        level,
        text,
        pos: -1,
        children: []
      });
    }
  });
  return nest(flat);
}

// tests/outline.test.ts
test("captures H1\u2013H6 with correct level and text", () => {
  const md = ["# h1", "## h2", "### h3", "#### h4", "##### h5", "###### h6"].join("\n");
  const out = buildOutlineFromMarkdown(md);
  assert.equal(out.length, 1);
  assert.equal(out[0].text, "h1");
  assert.equal(out[0].level, 1);
  let cur = out[0];
  for (let lvl = 2; lvl <= 6; lvl++) {
    assert.equal(cur.children.length, 1);
    cur = cur.children[0];
    assert.equal(cur.level, lvl);
    assert.equal(cur.text, `h${lvl}`);
  }
});
test("nests headings according to their level", () => {
  const md = "# A\n## B\n# C";
  const out = buildOutlineFromMarkdown(md);
  assert.equal(out.length, 2);
  assert.equal(out[0].text, "A");
  assert.equal(out[0].children.length, 1);
  assert.equal(out[0].children[0].text, "B");
  assert.equal(out[0].children[0].level, 2);
  assert.equal(out[1].text, "C");
  assert.equal(out[1].children.length, 0);
});
test("ignores headings inside fenced code blocks", () => {
  const md = "# Real\n\n```\n# Fake heading\n```\n\n## Also real";
  const out = buildOutlineFromMarkdown(md);
  assert.equal(out.length, 2);
  assert.equal(out[0].text, "Real");
  assert.equal(out[1].text, "Also real");
});
test("assigns unique sequential ids and marks pos as -1 for markdown source", () => {
  const md = "# A\n# B\n# C";
  const out = buildOutlineFromMarkdown(md);
  assert.deepEqual(out.map((n) => n.id), ["heading-0", "heading-1", "heading-2"]);
  for (const n of out) assert.equal(n.pos, -1);
});
test("handles headings with trailing spaces and empty documents", () => {
  const out = buildOutlineFromMarkdown("#   Trimmed   \n\nno headings here");
  assert.equal(out.length, 1);
  assert.equal(out[0].text, "Trimmed");
  assert.deepEqual(buildOutlineFromMarkdown(""), []);
});
