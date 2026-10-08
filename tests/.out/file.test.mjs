// tests/file.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

// src/utils/file.ts
function dirname(path) {
  const norm = path.replace(/\\/g, "/");
  const idx = norm.lastIndexOf("/");
  return idx <= 0 ? "." : norm.slice(0, idx);
}
function basename(path) {
  const norm = path.replace(/\\/g, "/");
  const idx = norm.lastIndexOf("/");
  return idx < 0 ? norm : norm.slice(idx + 1);
}
function replaceExtension(path, ext) {
  const base = basename(path);
  const dot = base.lastIndexOf(".");
  const name = dot > 0 ? base.slice(0, dot) : base;
  const prefix = path.slice(0, path.length - base.length);
  const extWithDot = ext.startsWith(".") ? ext : `.${ext}`;
  return `${prefix}${name}${extWithDot}`;
}
function resolveAssetPath(docPath, assetRel) {
  const dir = dirname(docPath);
  return `${dir}/${assetRel}`.replace(/\/+/g, "/");
}

// tests/file.test.ts
test("basename extracts the file name on posix and windows separators", () => {
  assert.equal(basename("/a/b/c.md"), "c.md");
  assert.equal(basename("a/b/c.md"), "c.md");
  assert.equal(basename("C:\\Users\\me\\doc.md"), "doc.md");
  assert.equal(basename("no-slash"), "no-slash");
});
test("dirname returns the parent directory", () => {
  assert.equal(dirname("/a/b/c.md"), "/a/b");
  assert.equal(dirname("a/b/c.md"), "a/b");
  assert.equal(dirname("c.md"), ".");
  assert.equal(dirname("/c.md"), ".");
});
test("replaceExtension swaps the extension (with or without leading dot)", () => {
  assert.equal(replaceExtension("/a/b/c.md", "html"), "/a/b/c.html");
  assert.equal(replaceExtension("/a/b/c.md", ".html"), "/a/b/c.html");
  assert.equal(replaceExtension("/a/b/c.md", "DOCX"), "/a/b/c.DOCX");
});
test("replaceExtension handles missing / dotfile extensions", () => {
  assert.equal(replaceExtension("/a/b/README", "md"), "/a/b/README.md");
  assert.equal(replaceExtension("/a/b/.gitignore", "txt"), "/a/b/.gitignore.txt");
});
test("resolveAssetPath joins doc dir with the asset-relative path", () => {
  assert.equal(resolveAssetPath("/docs/note.md", "assets/x.png"), "/docs/assets/x.png");
  assert.equal(resolveAssetPath("note.md", "assets/x.png"), "./assets/x.png");
  assert.equal(resolveAssetPath("/docs/", "assets/x.png"), "/docs/assets/x.png");
});
