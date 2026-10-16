// Run with playwright-cli run-code --filename against oracle-ui-fixture.mjs.
async (page) => {
  const origin = new URL(page.url()).origin;
  const fixture = "http://127.0.0.1:9010";
  const id = "00000000-0000-4000-8000-000000000102";
  const checks = [];
  const log = page.getByRole("log", { name: "Conversation messages" });
  const input = page.getByRole("textbox", { name: "Message Oracle" });
  const reply = () => log.getByRole("article", { name: "Oracle response", exact: true }).last();
  const control = async data => {
    const response = await page.request.post(`${fixture}/__control`, { data });
    if (!response.ok()) throw new Error("Fixture control failed");
  };
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const ready = () => page.waitForFunction(() => document.querySelector('[aria-label="Message Oracle"]')?.disabled === false);
  const saved = async content => {
    await control({ savedAnswer: { conversationId: id, content }, savedResults: { conversationId: id, results: [], status: "completed" } });
    await page.goto(`${origin}/oracle?conversation=${id}`);
    await reply().waitFor();
    await ready();
  };
  const check = async (name, run) => {
    try { await run(); checks.push(name); }
    catch (error) { throw new Error(`After ${checks.length} checks, failed ${name}: ${error.message}`); }
  };
  const times = [["06:00:00", "05:30:00"], ["07:00:00", "06:30:00"], ["08:30:00", "08:00:00"], ["11:20:00", "10:50:00"], ["13:10:00", "12:40:00"], ["15:20:00", "14:50:00"], ["17:40:00", "17:10:00"]];
  const ferry = "Here are the recorded ferry departures from **Sekupang Ferry Terminal** to **Harbourfront Singapore**:\n\n" + times.map(([departure, cutoff]) => `* **${departure}** (Cutoff: ${cutoff}) - Fast Ferry (Passenger/Hand-Carry)`).join("\n");
  await page.setViewportSize({ width: 1440, height: 1000 });

  await check("recorded schedules render real bullets and bold departure times", async () => {
    await saved(ferry);
    await reply().getByRole("list").waitFor();
    assert(await reply().getByRole("listitem").count() === 7, "Missing schedule rows");
    for (const [departure] of times) await reply().locator("strong").filter({ hasText: departure }).waitFor();
    assert(!(await reply().textContent()).includes("**"), "Bold markers leaked into the completed response");
    await page.screenshot({ path: "output/playwright/oracle-markdown-desktop.png", fullPage: true });
  });

  await check("saved formatting survives reloading", async () => {
    await page.reload();
    await reply().getByRole("list").waitFor();
    await ready();
    assert(await reply().getByRole("listitem").count() === 7, "Reload lost formatted lists");
    await reply().getByText(/17:40:00/).waitFor();
  });

  await check("headings, numbered steps, quotes, and code have readable semantic structure", async () => {
    await saved("## Departure checklist\n\n1. Confirm **terminal cutoff**.\n2. Review *travel time*.\n\n> Recorded times may be outdated.\n\nUse `FAST_FREIGHT`.\n\n```text\n**literal code**\n```");
    await reply().getByRole("heading", { name: "Departure checklist" }).waitFor();
    assert(await reply().locator("ol > li").count() === 2, "Numbered list was flattened");
    await reply().locator("blockquote").waitFor();
    await reply().getByLabel("Code block", { exact: true }).waitFor();
    await reply().locator("code").filter({ hasText: "**literal code**" }).waitFor();
  });

  await check("HTML, unsafe links and image syntax cannot execute or load media", async () => {
    let imageRequests = 0;
    await page.route("**/oracle-markdown-tracker/**", route => { imageRequests++; return route.abort(); });
    await saved('<img src="https://example.invalid/oracle-markdown-tracker/pixel.png" onerror="window.oracleMarkdownInjected=true">\n\n<script>window.oracleMarkdownInjected=true</script>\n\n[Bad link](javascript:alert%281%29)\n\n![Map preview](https://example.invalid/oracle-markdown-tracker/markdown.png)\n\n[Operator schedules](https://example.com/schedules)');
    assert(await reply().locator("img,script,iframe").count() === 0, "Unsafe elements were rendered");
    assert(!await page.evaluate(() => window.oracleMarkdownInjected), "Generated script executed");
    assert(imageRequests === 0, "Generated text loaded external media");
    assert(await reply().getByRole("link", { name: "Bad link", exact: true }).count() === 0, "Unsafe URL remained clickable");
    const external = reply().getByRole("link", { name: /Operator schedules/ });
    assert(await external.getAttribute("target") === "_blank" && (await external.getAttribute("rel")).includes("noreferrer"), "External link isolation was missing");
    await page.unroute("**/oracle-markdown-tracker/**");
  });

  await check("streamed partial Markdown becomes formatted while user text stays literal", async () => {
    await page.getByRole("button", { name: "New conversation", exact: true }).click();
    await ready();
    const text = "Estimated time: **30 min**\n\n- Confirm terminal cutoff";
    await control({ mode: "markdown-slow", nextAnswer: text, nextResults: [] });
    await input.fill("Please keep **my message** literal");
    await page.getByRole("button", { name: "Send message", exact: true }).click();
    await page.getByRole("button", { name: "Stop response", exact: true }).waitFor();
    await reply().getByText(/Estimated time:/).waitFor();
    const user = log.getByRole("article", { name: "Your message", exact: true }).last();
    assert((await user.textContent()).includes("**my message**") && await user.locator("strong").count() === 0, "User text was unexpectedly interpreted as Markdown");
    await reply().locator("strong").filter({ hasText: "30 min" }).waitFor();
    await ready();
    assert(await reply().getByRole("listitem").count() === 1, "Streamed list did not finish rendering");
    await page.reload();
    await ready();
    await reply().locator("strong").filter({ hasText: "30 min" }).waitFor();
    assert(!(await reply().textContent()).includes("**"), "Saved replay exposed formatting markers");
  });

  await check("wide tables and long code scroll inside the reply on narrow screens", async () => {
    await saved("| Departure | Cutoff | Terminal | Destination | Cargo |\n| --- | --- | --- | --- | --- |\n| **06:00** | 05:30 | Sekupang Ferry Terminal | Harbourfront Singapore | Passenger/Hand-Carry |\n\n```text\n" + "route-detail-".repeat(40) + "\n```");
    for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 820, height: 700 }]) {
      await page.setViewportSize(size);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Formatted response overflowed the page");
      const table = reply().getByRole("region", { name: "Oracle answer table" });
      assert(await table.evaluate(element => getComputedStyle(element).overflowX === "auto" && element.scrollWidth >= element.clientWidth), "Table has no local scroll container");
      const code = reply().getByLabel("Code block", { exact: true });
      assert(await code.evaluate(element => getComputedStyle(element).overflowX === "auto" && element.scrollWidth > element.clientWidth), "Code has no local scroll container");
    }
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await saved(ferry);
  await page.screenshot({ path: "output/playwright/oracle-markdown-mobile.png", fullPage: true });
  await control({ savedAnswer: { conversationId: id, content: "Saved answer: Road question" } });
  await page.setViewportSize({ width: 1440, height: 1000 });
  return { checks_passed: checks.length, checks, scope: "Chromium with synthetic saved and streamed replies; no real accounts or provider calls" };
}
