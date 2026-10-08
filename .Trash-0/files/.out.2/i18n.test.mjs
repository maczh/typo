// tests/i18n.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

// src/i18n/locales/zh-CN.ts
var zh_CN_default = {
  app: {
    name: "Typo",
    untitled: "\u672A\u547D\u540D"
  },
  menu: {
    file: "\u6587\u4EF6",
    edit: "\u7F16\u8F91",
    view: "\u89C6\u56FE",
    format: "\u683C\u5F0F",
    theme: "\u4E3B\u9898",
    help: "\u5E2E\u52A9",
    new: "\u65B0\u5EFA",
    open: "\u6253\u5F00\u2026",
    openFolder: "\u6253\u5F00\u6587\u4EF6\u5939\u2026",
    save: "\u4FDD\u5B58",
    saveAs: "\u53E6\u5B58\u4E3A\u2026",
    export: "\u5BFC\u51FA",
    recent: "\u6700\u8FD1\u6587\u4EF6",
    preferences: "\u504F\u597D\u8BBE\u7F6E",
    undo: "\u64A4\u9500",
    redo: "\u91CD\u505A",
    cut: "\u526A\u5207",
    copy: "\u590D\u5236",
    paste: "\u7C98\u8D34",
    toggleSidebar: "\u5207\u6362\u4FA7\u680F",
    toggleOutline: "\u5207\u6362\u5927\u7EB2",
    focusMode: "\u4E13\u6CE8\u6A21\u5F0F",
    typewriterMode: "\u6253\u5B57\u673A\u6A21\u5F0F",
    sourceMode: "\u6E90\u7801\u6A21\u5F0F",
    normalMode: "\u666E\u901A\u6A21\u5F0F",
    bold: "\u52A0\u7C97",
    italic: "\u659C\u4F53",
    strike: "\u5220\u9664\u7EBF",
    code: "\u884C\u5185\u4EE3\u7801",
    link: "\u94FE\u63A5",
    insertTable: "\u63D2\u5165\u8868\u683C",
    insertImage: "\u63D2\u5165\u56FE\u7247",
    insertMath: "\u63D2\u5165\u516C\u5F0F",
    insertDiagram: "\u63D2\u5165\u56FE\u8868",
    about: "\u5173\u4E8E",
    documentation: "\u6587\u6863",
    commandPalette: "\u547D\u4EE4\u9762\u677F"
  },
  theme: {
    "github-light": "GitHub \u4EAE\u8272",
    "nord-dark": "Nord \u6697\u8272"
  },
  sidebar: {
    files: "\u6587\u4EF6",
    outline: "\u5927\u7EB2",
    openFolder: "\u6253\u5F00\u6587\u4EF6\u5939",
    newFile: "\u65B0\u5EFA\u6587\u4EF6",
    empty: "\uFF08\u7A7A\uFF09",
    recent: "\u6700\u8FD1"
  },
  outline: {
    empty: "\u6682\u65E0\u6807\u9898"
  },
  statusbar: {
    words: "\u5B57\u6570",
    line: "\u884C",
    col: "\u5217",
    saved: "\u5DF2\u4FDD\u5B58",
    unsaved: "\u672A\u4FDD\u5B58",
    autosaved: "\u5DF2\u81EA\u52A8\u4FDD\u5B58",
    theme: "\u4E3B\u9898",
    lang: "\u8BED\u8A00"
  },
  dialog: {
    settings: {
      title: "\u8BBE\u7F6E",
      theme: "\u4E3B\u9898",
      language: "\u8BED\u8A00",
      fontSize: "\u5B57\u53F7",
      lineHeight: "\u884C\u9AD8",
      fontFamily: "\u5B57\u4F53",
      autoSave: "\u81EA\u52A8\u4FDD\u5B58",
      autoSaveInterval: "\u81EA\u52A8\u4FDD\u5B58\u95F4\u9694\uFF08\u6BEB\u79D2\uFF09",
      mode: "\u7F16\u8F91\u6A21\u5F0F",
      customCss: "\u81EA\u5B9A\u4E49 CSS",
      save: "\u4FDD\u5B58",
      cancel: "\u53D6\u6D88"
    },
    recovery: {
      title: "\u6062\u590D\u672A\u4FDD\u5B58\u7684\u6587\u6863",
      message: "\u68C0\u6D4B\u5230\u4EE5\u4E0B\u6587\u6863\u6709\u81EA\u52A8\u4FDD\u5B58\u7684\u5907\u4EFD\uFF0C\u662F\u5426\u6062\u590D\uFF1F",
      recover: "\u6062\u590D",
      ignore: "\u5FFD\u7565"
    }
  },
  command: {
    placeholder: "\u8F93\u5165\u547D\u4EE4\u2026",
    empty: "\u65E0\u5339\u914D\u547D\u4EE4",
    title: "\u547D\u4EE4\u9762\u677F"
  },
  export: {
    success: "\u5DF2\u5BFC\u51FA",
    fail: "\u5BFC\u51FA\u5931\u8D25",
    html: "HTML",
    word: "Word",
    pdf: "PDF",
    markdown: "Markdown"
  },
  image: {
    paste: "\u7C98\u8D34\u56FE\u7247",
    drop: "\u62D6\u62FD\u56FE\u7247\u5230\u6B64",
    failed: "\u56FE\u7247\u63D2\u5165\u5931\u8D25"
  },
  common: {
    confirm: "\u786E\u5B9A",
    cancel: "\u53D6\u6D88",
    close: "\u5173\u95ED"
  }
};

// src/i18n/locales/en.ts
var en_default = {
  app: {
    name: "Typo",
    untitled: "Untitled"
  },
  menu: {
    file: "File",
    edit: "Edit",
    view: "View",
    format: "Format",
    theme: "Theme",
    help: "Help",
    new: "New",
    open: "Open\u2026",
    openFolder: "Open Folder\u2026",
    save: "Save",
    saveAs: "Save As\u2026",
    export: "Export",
    recent: "Recent",
    preferences: "Preferences",
    undo: "Undo",
    redo: "Redo",
    cut: "Cut",
    copy: "Copy",
    paste: "Paste",
    toggleSidebar: "Toggle Sidebar",
    toggleOutline: "Toggle Outline",
    focusMode: "Focus Mode",
    typewriterMode: "Typewriter Mode",
    sourceMode: "Source Mode",
    normalMode: "Normal Mode",
    bold: "Bold",
    italic: "Italic",
    strike: "Strikethrough",
    code: "Inline Code",
    link: "Link",
    insertTable: "Insert Table",
    insertImage: "Insert Image",
    insertMath: "Insert Math",
    insertDiagram: "Insert Diagram",
    about: "About",
    documentation: "Documentation",
    commandPalette: "Command Palette"
  },
  theme: {
    "github-light": "GitHub Light",
    "nord-dark": "Nord Dark"
  },
  sidebar: {
    files: "Files",
    outline: "Outline",
    openFolder: "Open Folder",
    newFile: "New File",
    empty: "(empty)",
    recent: "Recent"
  },
  outline: {
    empty: "No headings yet"
  },
  statusbar: {
    words: "Words",
    line: "Line",
    col: "Col",
    saved: "Saved",
    unsaved: "Unsaved",
    autosaved: "Autosaved",
    theme: "Theme",
    lang: "Lang"
  },
  dialog: {
    settings: {
      title: "Settings",
      theme: "Theme",
      language: "Language",
      fontSize: "Font Size",
      lineHeight: "Line Height",
      fontFamily: "Font Family",
      autoSave: "Auto Save",
      autoSaveInterval: "Auto Save Interval (ms)",
      mode: "Editor Mode",
      customCss: "Custom CSS",
      save: "Save",
      cancel: "Cancel"
    },
    recovery: {
      title: "Recover Unsaved Document",
      message: "Backups were found for the following documents. Recover them?",
      recover: "Recover",
      ignore: "Ignore"
    }
  },
  command: {
    placeholder: "Type a command\u2026",
    empty: "No matching command",
    title: "Command Palette"
  },
  export: {
    success: "Exported",
    fail: "Export failed",
    html: "HTML",
    word: "Word",
    pdf: "PDF",
    markdown: "Markdown"
  },
  image: {
    paste: "Paste Image",
    drop: "Drop image here",
    failed: "Failed to insert image"
  },
  common: {
    confirm: "OK",
    cancel: "Cancel",
    close: "Close"
  }
};

// src/i18n/locales/zh-TW.ts
var zh_TW_default = {
  app: {
    name: "Typo",
    untitled: "\u672A\u547D\u540D"
  },
  menu: {
    file: "\u6A94\u6848",
    edit: "\u7DE8\u8F2F",
    view: "\u6AA2\u8996",
    format: "\u683C\u5F0F",
    theme: "\u4E3B\u984C",
    help: "\u8AAA\u660E",
    new: "\u65B0\u5EFA",
    open: "\u958B\u555F\u2026",
    openFolder: "\u958B\u555F\u8CC7\u6599\u593E\u2026",
    save: "\u5132\u5B58",
    saveAs: "\u53E6\u5B58\u70BA\u2026",
    export: "\u532F\u51FA",
    recent: "\u6700\u8FD1\u6A94\u6848",
    preferences: "\u504F\u597D\u8A2D\u5B9A",
    undo: "\u5FA9\u539F",
    redo: "\u91CD\u505A",
    cut: "\u526A\u4E0B",
    copy: "\u8907\u88FD",
    paste: "\u8CBC\u4E0A",
    toggleSidebar: "\u5207\u63DB\u5074\u6B04",
    toggleOutline: "\u5207\u63DB\u5927\u7DB1",
    focusMode: "\u5C08\u6CE8\u6A21\u5F0F",
    typewriterMode: "\u6253\u5B57\u6A5F\u6A21\u5F0F",
    sourceMode: "\u539F\u59CB\u78BC\u6A21\u5F0F",
    normalMode: "\u4E00\u822C\u6A21\u5F0F",
    bold: "\u7C97\u9AD4",
    italic: "\u659C\u9AD4",
    strike: "\u522A\u9664\u7DDA",
    code: "\u884C\u5167\u7A0B\u5F0F\u78BC",
    link: "\u9023\u7D50",
    insertTable: "\u63D2\u5165\u8868\u683C",
    insertImage: "\u63D2\u5165\u5716\u7247",
    insertMath: "\u63D2\u5165\u516C\u5F0F",
    insertDiagram: "\u63D2\u5165\u5716\u8868",
    about: "\u95DC\u65BC",
    documentation: "\u6587\u4EF6",
    commandPalette: "\u547D\u4EE4\u9762\u677F"
  },
  theme: {
    "github-light": "GitHub \u4EAE\u8272",
    "nord-dark": "Nord \u6697\u8272"
  },
  sidebar: {
    files: "\u6A94\u6848",
    outline: "\u5927\u7DB1",
    openFolder: "\u958B\u555F\u8CC7\u6599\u593E",
    newFile: "\u65B0\u5EFA\u6A94\u6848",
    empty: "\uFF08\u7A7A\uFF09",
    recent: "\u6700\u8FD1"
  },
  outline: {
    empty: "\u5C1A\u7121\u6A19\u984C"
  },
  statusbar: {
    words: "\u5B57\u6578",
    line: "\u884C",
    col: "\u5217",
    saved: "\u5DF2\u5132\u5B58",
    unsaved: "\u672A\u5132\u5B58",
    autosaved: "\u5DF2\u81EA\u52D5\u5132\u5B58",
    theme: "\u4E3B\u984C",
    lang: "\u8A9E\u8A00"
  },
  dialog: {
    settings: {
      title: "\u8A2D\u5B9A",
      theme: "\u4E3B\u984C",
      language: "\u8A9E\u8A00",
      fontSize: "\u5B57\u865F",
      lineHeight: "\u884C\u9AD8",
      fontFamily: "\u5B57\u578B",
      autoSave: "\u81EA\u52D5\u5132\u5B58",
      autoSaveInterval: "\u81EA\u52D5\u5132\u5B58\u9593\u9694\uFF08\u6BEB\u79D2\uFF09",
      mode: "\u7DE8\u8F2F\u6A21\u5F0F",
      customCss: "\u81EA\u8A02 CSS",
      save: "\u5132\u5B58",
      cancel: "\u53D6\u6D88"
    },
    recovery: {
      title: "\u5FA9\u539F\u672A\u5132\u5B58\u7684\u6587\u4EF6",
      message: "\u5075\u6E2C\u5230\u4EE5\u4E0B\u6587\u4EF6\u6709\u81EA\u52D5\u5132\u5B58\u7684\u5099\u4EFD\uFF0C\u662F\u5426\u5FA9\u539F\uFF1F",
      recover: "\u5FA9\u539F",
      ignore: "\u5FFD\u7565"
    }
  },
  command: {
    placeholder: "\u8F38\u5165\u547D\u4EE4\u2026",
    empty: "\u7121\u7B26\u5408\u7684\u547D\u4EE4",
    title: "\u547D\u4EE4\u9762\u677F"
  },
  export: {
    success: "\u5DF2\u532F\u51FA",
    fail: "\u532F\u51FA\u5931\u6557",
    html: "HTML",
    word: "Word",
    pdf: "PDF",
    markdown: "Markdown"
  },
  image: {
    paste: "\u8CBC\u4E0A\u5716\u7247",
    drop: "\u5C07\u5716\u7247\u62D6\u66F3\u5230\u6B64",
    failed: "\u5716\u7247\u63D2\u5165\u5931\u6557"
  },
  common: {
    confirm: "\u78BA\u5B9A",
    cancel: "\u53D6\u6D88",
    close: "\u95DC\u9589"
  }
};

// tests/i18n.test.ts
function collectKeys(obj, prefix = "") {
  const keys = [];
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object") keys.push(...collectKeys(v, path));
      else keys.push(path);
    }
  }
  return keys.sort();
}
test("the three language packs share an identical key set", () => {
  const zh = collectKeys(zh_CN_default);
  const enKeys = collectKeys(en_default);
  const tw = collectKeys(zh_TW_default);
  assert.deepEqual(enKeys, zh, "en should have the same keys as zh-CN");
  assert.deepEqual(tw, zh, "zh-TW should have the same keys as zh-CN");
  assert.ok(zh.length > 50, "expected a reasonably complete locale (>50 keys)");
});
test("every value is a non-empty string", () => {
  for (const [name, pack] of [["zh-CN", zh_CN_default], ["en", en_default], ["zh-TW", zh_TW_default]]) {
    const keys = collectKeys(pack);
    for (const k of keys) {
      const val = k.split(".").reduce((o, p) => o?.[p], pack);
      assert.equal(typeof val, "string", `${name}.${k} should be a string`);
      assert.ok(val.trim().length > 0, `${name}.${k} should not be empty`);
    }
  }
});
