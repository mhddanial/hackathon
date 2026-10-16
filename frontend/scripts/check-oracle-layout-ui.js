// Run with playwright-cli run-code --filename against oracle-ui-fixture.mjs.
async (page) => {
  const origin = new URL(page.url()).origin;
  const fixture = "http://127.0.0.1:9010";
  const checks = [];
  const input = page.getByRole("textbox", { name: "Message Oracle" });
  const history = page.getByRole("complementary", { name: "Conversation history" });
  const log = page.getByRole("log", { name: "Conversation messages" });
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const stats = async () => (await page.request.get(`${fixture}/__stats`)).json();
  const ready = () => page.waitForFunction(() => document.querySelector('[aria-label="Message Oracle"]')?.disabled === false);
  const check = async (name, run) => { try { await run(); checks.push(name); } catch (error) { throw new Error(`After ${checks.length} checks, failed ${name}: ${error.message}`); } };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/oracle`);
  await ready();

  await check("chat fills the section with its title inside and history closed by default", async () => {
    const workspace = page.getByRole("region", { name: "Oracle workspace" });
    assert(await workspace.getByRole("heading", { name: "Logistics Oracle", exact: true }).count() === 1, "Title is outside the chat");
    assert(await history.count() === 0, "History starts open on desktop");
    const content = await page.locator("#dashboard-content").boundingBox();
    const box = await workspace.boundingBox();
    assert(box.y - content.y <= 25, "External heading still consumes space above the chat");
    assert(await page.getByRole("button", { name: "Open conversation history" }).isVisible(), "Desktop cannot reopen history");
  });

  await check("welcome prompts fill and focus the composer without sending", async () => {
    const before = (await stats()).executions;
    await page.getByRole("button", { name: "Plan a route", exact: true }).click();
    assert((await input.inputValue()).includes("Batamindo Industrial Park"), "Named-location prompt was not inserted");
    assert(await input.evaluate(element => element === document.activeElement), "Composer was not focused");
    assert((await stats()).executions === before, "Prompt card submitted immediately");
  });

  await check("history search filters loaded titles locally and clears its empty state", async () => {
    await page.getByRole("button", { name: "Open conversation history" }).click();
    await page.waitForFunction(() => !document.querySelector('button[aria-label="Reload conversations"]').disabled);
    const search = history.getByRole("searchbox", { name: "Search conversations" });
    const title = await history.locator("button[title]").first().getAttribute("title");
    const before = (await stats()).requests.length;
    await search.fill("no-conversation-can-match-this-query");
    await history.getByText("No matching conversations. Try a different search.", { exact: true }).waitFor();
    await history.getByRole("button", { name: "Clear conversation search" }).click();
    await search.fill(title);
    await history.locator("button[title]").first().waitFor();
    assert(await history.locator("button[title]").count() >= 1, "Matching title was hidden");
    assert((await stats()).requests.length === before, "Local search made an API request");
    await history.getByRole("button", { name: "Clear conversation search" }).click();
    await page.getByRole("dialog", { name: "Your conversations" }).getByRole("button", { name: "Close", exact: true }).click();
    await history.waitFor({ state: "hidden" });
  });

  await check("multiline and IME input do not send until Enter is committed", async () => {
    const before = (await stats()).executions;
    await input.fill("Multiline route request");
    await input.press("Shift+Enter");
    await input.pressSequentially("Second line");
    await input.evaluate(element => element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, isComposing: true })));
    assert((await input.inputValue()).includes("\nSecond line"), "Shift+Enter lost the new line");
    assert((await stats()).executions === before, "A newline or IME composition sent a request");
    await input.press("Enter");
    await log.getByText("Saved answer: Multiline route request\nSecond line", { exact: true }).waitFor();
    await ready();
    assert((await stats()).executions === before + 1, "Committed Enter did not send exactly once");
  });

  await check("long drafts stay bounded and expose the character limit", async () => {
    await input.fill("a".repeat(7900));
    await page.getByText("7,900 / 8,000", { exact: true }).waitFor();
    const bounds = await input.boundingBox();
    assert(bounds.height <= 145, "Long draft expanded beyond the composer limit");
    assert(await input.getAttribute("maxlength") === "8000", "Input limit was removed");
    await input.fill("");
  });

  await check("stream updates preserve reading position and Jump to latest restores following", async () => {
    await page.getByRole("button", { name: "New conversation", exact: true }).click();
    await ready();
    const long = Array.from({ length: 65 }, (_, n) => `Route planning detail ${n + 1}`).join("\n");
    await input.fill(long);
    await input.press("Enter");
    await log.getByText(`Saved answer: ${long}`, { exact: true }).waitFor();
    await ready();
    await page.request.post(`${fixture}/__control`, { data: { mode: "slow" } });
    await input.fill("Scroll retention check");
    await input.press("Enter");
    await log.getByText("Partial old-conversation response", { exact: false }).waitFor();
    await log.evaluate(element => { element.scrollTop = 0; element.dispatchEvent(new Event("scroll")); });
    await page.getByRole("button", { name: "Jump to latest", exact: true }).waitFor();
    await log.getByText("Partial old-conversation response LATE old-conversation response", { exact: true }).waitFor();
    await ready();
    assert(await log.evaluate(element => element.scrollTop < 100), "Stream forced the reader to the bottom");
    await page.getByRole("button", { name: "Jump to latest", exact: true }).click();
    assert(await log.evaluate(element => element.scrollHeight - element.clientHeight - element.scrollTop < 96), "Jump did not reach the latest response");
  });

  await check("delete dialog traps focus, Escape cancels, and returns focus to the trigger", async () => {
    await ready();
    const remove = page.getByRole("button", { name: "Delete conversation", exact: true });
    const before = (await stats()).requests.filter(item => item.method === "DELETE").length;
    await remove.click();
    const dialog = page.getByRole("alertdialog", { name: "Delete conversation?" });
    await dialog.waitFor();
    await page.waitForFunction(() => !!document.activeElement?.closest('[role="alertdialog"]'));
    for (let n = 0; n < 4; n++) {
      await page.keyboard.press("Tab");
      await page.waitForFunction(() => !!document.activeElement?.closest('[role="alertdialog"]'));
    }
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Delete conversation");
    assert(await remove.evaluate(element => element === document.activeElement), "Focus did not return to delete trigger");
    assert((await stats()).requests.filter(item => item.method === "DELETE").length === before, "Escape deleted a conversation");
  });

  await page.screenshot({ path: "output/playwright/oracle-layout-desktop-chat.png", fullPage: true });
  await page.getByRole("button", { name: "New conversation", exact: true }).click();
  await ready();
  await page.screenshot({ path: "output/playwright/oracle-layout-desktop.png", fullPage: true });
  await check("mobile drawer selects history and closes without losing the composer", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Open conversation history" }).click();
    const drawer = page.getByRole("dialog", { name: "Your conversations" });
    await drawer.waitFor();
    await page.waitForFunction(() => {
      const element = document.querySelector('[data-slot="sheet-content"]');
      return element && !element.hasAttribute("data-starting-style") && getComputedStyle(element).opacity === "1" && Math.abs(element.getBoundingClientRect().left) < 1;
    });
    await page.screenshot({ path: "output/playwright/oracle-layout-mobile-history.png", fullPage: true });
    await drawer.getByRole("button", { name: /^Scroll retention check|^Route planning detail/ }).first().click();
    await drawer.waitFor({ state: "hidden" });
    await log.getByText("Saved answer:", { exact: false }).first().waitFor();
    const more = page.getByRole("button", { name: "Load more messages", exact: true });
    if (await more.count()) { await more.click(); await ready(); }
    assert(await input.isVisible(), "Composer disappeared after history selection");
  });

  await check("mobile and tablet layouts fit the viewport with a visible composer", async () => {
    for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 360, height: 640 }, { width: 820, height: 700 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(size);
      const box = await input.boundingBox();
      assert(box.y >= 0 && box.y + box.height <= size.height, `Composer out of view at ${size.width}`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Horizontal overflow at ${size.width}`);
      assert(await history.count() === 0, `History unexpectedly visible at ${size.width}`);
      const send = await page.getByRole("button", { name: "Send message", exact: true }).boundingBox();
      assert(send.y + send.height <= size.height, `Send button out of view at ${size.width}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "New conversation", exact: true }).click();
    await ready();
    const welcome = await page.getByRole("heading", { name: "What are you planning today?" }).boundingBox();
    const transcript = await log.boundingBox();
    assert(welcome.y >= transcript.y && welcome.y + welcome.height <= transcript.y + transcript.height, "Welcome heading starts outside the visible transcript");
    await page.screenshot({ path: "output/playwright/oracle-layout-mobile.png", fullPage: true });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  return { checks_passed: checks.length, checks, scope: "Chromium with synthetic accounts/API; no real conversations or provider calls" };
}
