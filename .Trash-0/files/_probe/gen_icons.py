"""Generate src/components/common/icons.ts from @milkdown/crepe's own SVG icons.

The editor menus used to be built from text glyphs (`S\u0336`, `\u232b`, `\u29c9`, `\u25a4`...).
On a plain Deepin/UOS font stack several of those have no glyph at all and render as
tofu boxes, which is how the formatting row became unreadable. Crepe already ships a
complete 24x24 icon set for exactly these actions, so we lift the path data verbatim:
guaranteed to render, consistent stroke weight, and inherits `currentColor`.
"""

import glob
import re

CREPE = "node_modules/@milkdown/crepe"

# Crepe icon name -> key used by <Icon name="..." />
FROM_CREPE = {
    "boldIcon": "bold",
    "italicIcon": "italic",
    "codeIcon": "code",
    "linkIcon": "link",
    "strikethroughIcon": "strike",
    "clearIcon": "clearFormat",
    "bulletListIcon": "bulletList",
    "orderedListIcon": "orderedList",
    "todoListIcon": "taskList",
    "quoteIcon": "quote",
}

# Hand-written Material-style paths for the actions Crepe has no icon for
# (clipboard + insert). Same 24x24 / filled / currentColor convention.
EXTRA = {
    "cut": "M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3h-3z",
    "copy": "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z",
    "paste": "M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z",
    "delete": "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
    "copyAsMarkdown": "M8 5H6c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-2h-2v2H6V7h2V5zm3-2c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8zm8 14h-8V5h8v12zM10.5 15.5l1.4-1.9 1.1 1.3 1.5-1.9 2 2.5h-6z",
    "pastePlain": "M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 16H7v-1.5h3V19zm0-3H7v-1.5h3V16zm0-3H7v-1.5h3V13zm7 6h-5v-1.5h5V19zm0-3h-5v-1.5h5V16zm0-3h-5v-1.5h5V13z",
    "insertImage": "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z",
}


def extract() -> dict:
    found = {}
    for f in glob.glob(f"{CREPE}/lib/esm/**/*.js", recursive=True):
        src = open(f, encoding="utf-8").read()
        for m in re.finditer(r"const (\w*[Ii]con\w*) = `(.*?)`;", src, re.S):
            name, body = m.group(1), m.group(2)
            if name in found or name not in FROM_CREPE:
                continue
            ds = re.findall(r'\sd="([^"]+)"', body)
            if len(ds) != 1:
                raise SystemExit(f"{name}: expected exactly 1 path, got {len(ds)}")
            found[name] = " ".join(ds[0].split())
    missing = set(FROM_CREPE) - set(found)
    if missing:
        raise SystemExit(f"missing icons in crepe bundle: {sorted(missing)}")
    return found


def main() -> None:
    crepe = extract()
    lines = [
        "/**",
        " * 24x24 filled icon paths for the editor menus.",
        " *",
        " * Why not text glyphs: the menus used to be `S\\u0336`, `\\u232b`, `\\u29c9`, `\\u25a4` … On a",
        " * plain Deepin/UOS font stack most of those have no glyph and render as tofu boxes.",
        " * These are real SVG paths, so they render identically everywhere and inherit",
        " * `currentColor` from the button around them.",
        " *",
        " * The formatting paths are lifted verbatim from `@milkdown/crepe`'s own icon set (which",
        " * already matches the toolbar's look); the clipboard/insert ones follow the same",
        " * Material-style 24x24 filled convention.",
        " *",
        " * Regenerate with `_probe/gen_icons.py` if Crepe's icons ever change.",
        " */",
        "export const ICON_PATHS = {",
    ]
    for crepe_name, key in sorted(FROM_CREPE.items(), key=lambda kv: kv[1]):
        lines.append(f"  {key}: '{crepe[crepe_name]}',")
    for key, d in sorted(EXTRA.items()):
        lines.append(f"  {key}: '{d}',")
    lines.append("} as const")
    lines.append("")
    lines.append("export type IconName = keyof typeof ICON_PATHS")
    lines.append("")

    out = "src/components/common/icons.ts"
    import os

    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    print(f"wrote {out}: {len(FROM_CREPE) + len(EXTRA)} icons")


main()
