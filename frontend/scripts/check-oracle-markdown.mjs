import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { createElement, memo } from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as markdown from "react-markdown";
import * as gfm from "remark-gfm";

const source = await readFile(new URL("../src/components/oracle/OracleMarkdown.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const dependencies = { react: { memo }, "react/jsx-runtime": jsx, "react-markdown": markdown, "remark-gfm": gfm };
const exports = {};
new Function("require", "exports", code)(name => {
  assert.ok(name in dependencies, `Unexpected dependency ${name}`);
  return dependencies[name];
}, exports);
const render = content => renderToStaticMarkup(createElement(exports.OracleMarkdown, { content }));
const checks = [];
const check = (name, run) => { run(); checks.push(name); console.log(`PASS ${name}`); };

check("ferry schedules render seven semantic bullets and bold departure values", () => {
  const times = ["06:00:00", "07:00:00", "08:30:00", "11:20:00", "13:10:00", "15:20:00", "17:40:00"];
  const html = render(`Recorded ferry departures from Sekupang to Harbourfront:\n\n${times.map(time => `* **${time}** - Fast Ferry`).join("\n")}`);
  assert.equal((html.match(/<li\b/g) || []).length, 7);
  for (const time of times) assert.match(html, new RegExp(`<strong[^>]*>${time}</strong>`));
  assert.ok(!html.includes("**"));
});
check("headings, ordered starts, emphasis, quotes and strikethrough retain meaning", () => {
  const html = render("# Route planning\n\n7. First stop\n8. Second stop\n\n> Check *cutoff* and ~~old times~~.");
  assert.match(html, /<h2[^>]*>Route planning<\/h2>/);
  assert.match(html, /<ol[^>]*start="7"/);
  assert.match(html, /<blockquote/);
  assert.match(html, /<em>cutoff<\/em>/);
  assert.match(html, /<del>old times<\/del>/);
});
check("tables are contained and preserve numeric alignment", () => {
  const html = render("| Departure | Capacity |\n| --- | ---: |\n| 06:00 | 0 |");
  assert.match(html, /aria-label="Oracle answer table"/);
  assert.match(html, /overflow-x-auto/);
  assert.match(html, /<th[^>]*scope="col"/);
  assert.match(html, /text-align:right/);
  assert.match(html, />0<\/td>/);
});
check("raw HTML and script payloads remain text with no executable elements", () => {
  const html = render('<img src=x onerror="window.oracleInjected=true">\n\n<script>window.oracleInjected=true</script>\n\n<iframe src="https://example.invalid"></iframe>');
  assert.ok(!/<(?:img|script|iframe)\b/.test(html));
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script/);
});
check("unsafe and encoded URLs do not become clickable links", () => {
  for (const url of ["javascript:alert%281%29", "JaVaScRiPt:alert%281%29", "data:text/html,attack", "vbscript:attack"]) {
    assert.ok(!render(`[unsafe](${url})`).includes("<a "));
  }
});
check("external links preserve labels and use isolated new tabs", () => {
  const html = render("[Ferry operator](https://example.com/schedules)");
  assert.match(html, /href="https:\/\/example.com\/schedules"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /opens in a new tab/);
});
check("remote Markdown images never create requests or image elements", () => {
  const html = render("![Route preview](https://example.invalid/track.png)");
  assert.ok(!html.includes("<img") && !html.includes("src="));
  assert.match(html, /\[Image: Route preview\]/);
});
check("literal escapes and code samples stay literal", () => {
  const html = render("\\* literal asterisk\n\n`**literal**`\n\n```html\n<img onerror=attack>\n```");
  assert.match(html, /\* literal asterisk/);
  assert.ok(!html.includes("<strong"));
  assert.match(html, /<code[^>]*>\*\*literal\*\*<\/code>/);
  assert.match(html, /&lt;img onerror=attack&gt;/);
  assert.match(html, /aria-label="Code block"/);
});
check("task lists remain readable and noninteractive", () => {
  const html = render("- [x] Confirm terminal\n- [ ] Check cutoff");
  assert.equal((html.match(/type="checkbox"/g) || []).length, 2);
  assert.equal((html.match(/disabled=""/g) || []).length, 2);
  assert.match(html, /aria-label="Completed task"/);
  assert.match(html, /aria-label="Incomplete task"/);
});
check("streamed partial formatting settles into the same completed output", () => {
  const completed = "Travel time: **30 min**\n\n- Check terminal cutoff";
  for (let end = 1; end <= completed.length; end++) assert.doesNotThrow(() => render(completed.slice(0, end)));
  assert.match(render(completed), /<strong[^>]*>30 min<\/strong>/);
});
console.log(`${checks.length} Oracle Markdown rendering checks passed.`);
