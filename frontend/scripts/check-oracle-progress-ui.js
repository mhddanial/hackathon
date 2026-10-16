// Run with playwright-cli run-code --filename against oracle-ui-fixture.mjs.
async (page) => {
  const origin = new URL(page.url()).origin;
  const fixture = "http://127.0.0.1:9010";
  const checks = [];
  const input = page.getByRole("textbox", { name: "Message Oracle" });
  const workspace = page.getByRole("region", { name: "Oracle workspace" });
  const log = page.getByRole("log", { name: "Conversation messages" });
  const stop = page.getByRole("button", { name: "Stop response", exact: true });
  const checking = "Checking recorded ferry schedules…";
  const generating = "Generating an answer from the available tool data…";
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const control = async data => {
    const response = await page.request.post(`${fixture}/__control`, { data });
    assert(response.ok(), "Fixture control failed");
  };
  const ready = () => page.waitForFunction(() => document.querySelector('[aria-label="Message Oracle"]')?.disabled === false);
  const noProgress = async () => {
    await stop.waitFor({ state: "hidden" });
    assert(await workspace.locator(".animate-spin").count() === 0, "Spinner remained after the request ended");
    assert(await log.getByText(checking, { exact: true }).count() === 0, "Tool progress leaked into the transcript");
    assert(await log.getByText(generating, { exact: true }).count() === 0, "Generation progress leaked into the transcript");
  };
  const send = async (text, mode) => {
    await ready();
    await control({ mode });
    await input.fill(text);
    await page.getByRole("button", { name: "Send message", exact: true }).click();
  };
  const fresh = async () => {
    await page.getByRole("button", { name: "New conversation", exact: true }).click();
    await page.getByRole("heading", { name: "What are you planning today?" }).waitFor();
    await ready();
  };
  const check = async (name, run) => {
    try { await run(); checks.push(name); }
    catch (error) { throw new Error(`After ${checks.length} checks, failed ${name}: ${error.message}`); }
  };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/oracle`);
  await ready();

  await check("tool progress occupies one active indicator and never becomes a chat message", async () => {
    await send("Progress lifecycle check", "progress");
    await page.getByRole("status").filter({ hasText: checking }).waitFor();
    assert(await workspace.locator(".animate-spin").count() === 1, "Multiple active spinners were rendered");
    assert(await input.isDisabled(), "Input was enabled before the turn finished");
    assert(await log.getByText(checking, { exact: true }).count() === 0, "Progress became a transcript message");
    await page.getByRole("status").filter({ hasText: generating }).waitFor();
    assert(await workspace.getByText(checking, { exact: true }).count() === 0, "Old tool phase stayed visible");
    assert(await workspace.locator(".animate-spin").count() === 1, "Generation added another spinner");
  });

  await check("completed answers clear progress and remain clean after a reload", async () => {
    await log.getByText("Saved answer: Progress lifecycle check", { exact: true }).waitFor();
    await ready();
    await noProgress();
    await page.reload();
    await log.getByText("Saved answer: Progress lifecycle check", { exact: true }).waitFor();
    await ready();
    await noProgress();
  });

  await check("a valid saved terminal event unblocks follow-up without waiting for EOF", async () => {
    await fresh();
    await send("Held terminal transport check", "terminal-open");
    await log.getByText("Saved answer: Held terminal transport check", { exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('[aria-label="Message Oracle"]')?.disabled === false, undefined, { timeout: 3000 });
    await noProgress();
    await send("Follow-up after terminal", "normal");
    await log.getByText("Saved answer: Follow-up after terminal", { exact: true }).waitFor();
    await ready();
  });

  await check("an unsaved terminal event stops loading but keeps recovery required", async () => {
    await fresh();
    await send("Held unsaved terminal check", "terminal-open-save-failure");
    await page.getByRole("button", { name: "Retry this turn", exact: true }).waitFor();
    await noProgress();
    assert(await input.isDisabled(), "An unconfirmed save allowed a fresh request");
    await log.getByText("Saved outcome not confirmed.", { exact: true }).waitFor();
    await control({ finishActive: "interrupted" });
  });

  await check("stopping clears the active indicator while retaining interrupted-turn recovery", async () => {
    await fresh();
    await send("Stopped progress check", "progress");
    await page.getByRole("status").filter({ hasText: checking }).waitFor();
    await stop.click();
    await page.getByRole("button", { name: "Retry this turn", exact: true }).waitFor();
    await noProgress();
    assert(await input.isDisabled(), "Stopped request lost its recovery guard");
    await control({ finishActive: "interrupted" });
    await page.getByRole("button", { name: "Retry this turn", exact: true }).click();
    await log.getByText("This turn was interrupted.", { exact: true }).waitFor();
    await ready();
    await noProgress();
  });

  await check("saved failure and a dropped acknowledgment leave no animated progress", async () => {
    await fresh();
    await send("Saved failure progress check", "failed");
    await log.getByText("This turn failed.", { exact: true }).waitFor();
    await ready();
    await noProgress();
    await send("Dropped acknowledgment progress check", "drop");
    await page.getByRole("button", { name: "Retry this turn", exact: true }).waitFor();
    await noProgress();
    assert(await input.isDisabled(), "Dropped terminal event lost its retry guard");
    await page.getByRole("button", { name: "Retry this turn", exact: true }).click();
    await ready();
    await noProgress();
  });

  await check("switching conversations clears progress and ignores late updates", async () => {
    await fresh();
    await send("Abandoned progress check", "progress");
    await page.getByRole("status").filter({ hasText: checking }).waitFor();
    await fresh();
    await control({ finishActive: "completed" });
    // Wait for the fixture's old response timer to attempt its late terminal event.
    await page.waitForTimeout(1600);
    await noProgress();
    assert(await log.getByText("Saved answer: Abandoned progress check", { exact: true }).count() === 0, "Previous response entered the new chat");
  });

  await check("composer and transcript use the same surface on desktop and mobile", async () => {
    for (const size of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      const colors = await input.evaluate(element => ({
        composer: getComputedStyle(element.closest("form").parentElement.parentElement).backgroundColor,
        chat: getComputedStyle(element.closest('[data-slot="card"]')).backgroundColor,
      }));
      assert(colors.composer === colors.chat && colors.chat !== "rgba(0, 0, 0, 0)", "Composer has a disconnected background surface");
      await page.screenshot({ path: `output/playwright/oracle-progress-${size.width}.png`, fullPage: true });
    }
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  return { checks_passed: checks.length, checks, scope: "Chromium with synthetic tool-status events and held-open streams; no real accounts or provider calls" };
}
