// Run with playwright-cli run-code --filename; services must use oracle-ui-fixture.mjs.
async (page) => {
  const origin = "http://127.0.0.1:3010", fixture = "http://127.0.0.1:9010";
  const checks = [];
  const log = () => page.getByRole("log", { name: "Conversation messages" });
  const input = () => page.getByRole("textbox", { name: "Message Oracle" });
  const control = async data => { const r = await page.request.post(`${fixture}/__control`, { data }); if (!r.ok()) throw new Error("Fixture control failed"); };
  const stats = async () => (await page.request.get(`${fixture}/__stats`)).json();
  const closeHistory = async () => {
    const drawer = page.getByRole("dialog", { name: "Your conversations" });
    await drawer.getByRole("button", { name: "Close", exact: true }).click();
    await drawer.waitFor({ state: "hidden" });
  };
  const assert = (condition, text) => { if (!condition) throw new Error(text); };
  const ready = async () => { await input().waitFor(); await page.waitForFunction(() => !document.querySelector('[aria-label="Message Oracle"]').disabled); };
  const send = async text => { await ready(); await input().fill(text); await page.getByRole("button", { name: "Send message", exact: true }).click(); };
  const answer = async text => { await log().getByText(`Saved answer: ${text}`, { exact: false }).waitFor(); await ready(); };
  const readAll = async () => {
    const more = page.getByRole("button", { name: "Load more messages", exact: true });
    while (await more.count()) {
      const response = page.waitForResponse(r => r.url().includes("/messages?") && r.url().includes("cursor="));
      await more.click(); const data = await (await response).json();
      if (!data.next_cursor) { await ready(); break; }
      await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(b => b.textContent === "Load more messages")?.disabled);
    }
  };
  const showConversation = async title => {
    const drawer = page.getByRole("dialog", { name: "Your conversations" });
    const trigger = page.getByRole("button", { name: "Open conversation history", includeHidden: true });
    if (await trigger.getAttribute("aria-expanded") !== "true") {
      await drawer.waitFor({ state: "hidden" });
      await trigger.click();
    }
    await drawer.waitFor();
    const button = page.getByRole("button", { name: new RegExp(`^${title}`) });
    await page.waitForFunction(() => !document.querySelector('button[aria-label="Reload conversations"]').disabled);
    while (!(await button.count())) {
      const more = page.getByRole("button", { name: "Load more conversations", exact: true });
      assert(await more.count(), `Conversation missing: ${title}`);
      const response = page.waitForResponse(r => r.url().includes("/user/conversations?") && r.url().includes("cursor="));
      await more.click(); await response;
      await page.waitForFunction(() => !document.querySelector('button[aria-label="Reload conversations"]').disabled);
    }
    return button;
  };
  const check = async (name, fn) => { try { await fn(); checks.push(name); } catch (error) { throw new Error(`After ${checks.length} passes, failed ${name}: ${error.message}`); } };
  let chatUrl;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await check("new chat persists IDs/results, refresh reopens it, follow-up uses same conversation", async () => {
    await send("Sprint 4 first question"); await answer("Sprint 4 first question");
    chatUrl = page.url(); assert(new URL(chatUrl).searchParams.get("conversation"), "Missing selected UUID");
    assert(await log().getByText("1 result record", { exact: true }).count() === 1, "Missing saved result metadata");
    await page.reload(); await answer("Sprint 4 first question");
    await send("Sprint 4 follow-up"); await answer("Sprint 4 follow-up");
    const values = (await stats()).requests.filter(r => r.path === "/agent/chat");
    assert(values[values.length - 1].conversation_id === new URL(chatUrl).searchParams.get("conversation"), "Follow-up used wrong chat");
  });
  await check("message pagination is explicit and blocks premature follow-ups", async () => {
    await page.reload(); await page.getByRole("button", { name: "Load more messages", exact: true }).waitFor();
    assert(await input().isDisabled(), "Input enabled before latest saved page");
    await readAll(); await answer("Sprint 4 follow-up");
    assert(await log().locator("[data-message-id]").count() === 4, "Missing/duplicated stored messages");
  });
  await check("switch and browser back restore the intended chat", async () => {
    await (await showConversation("Road estimates")).click(); await answer("Road question");
    assert(!(await log().getByText("Saved answer: Sprint 4 follow-up", { exact: false }).count()), "Old chat leaked into selected chat");
    await page.goBack(); await log().getByText("Saved answer: Sprint 4 first question", { exact: false }).waitFor(); await readAll(); await answer("Sprint 4 follow-up");
  });
  await check("archive preserves history, restore enables follow-up", async () => {
    await page.getByRole("button", { name: "Archive", exact: true }).click(); await page.getByRole("button", { name: "Restore", exact: true }).waitFor();
    assert(await input().isDisabled(), "Archived chat is writable");
    assert(await log().getByText("Saved answer: Sprint 4 follow-up", { exact: false }).count() === 1, "Archive lost history");
    await page.getByRole("button", { name: "Open conversation history" }).click();
    await page.getByRole("checkbox", { name: "Include archived" }).check();
    await closeHistory();
    await page.getByRole("button", { name: "Restore", exact: true }).click(); await ready();
  });
  await check("conversation pagination and empty/error/retry states", async () => {
    await page.getByRole("button", { name: "Open conversation history" }).click();
    await page.getByRole("button", { name: "Load more conversations", exact: true }).waitFor(); await page.getByRole("button", { name: "Load more conversations", exact: true }).click();
    await page.getByRole("button", { name: /^Archived reference/ }).waitFor();
    await control({ listFailure: true }); await page.getByRole("button", { name: "Reload conversations", exact: true }).click(); await page.getByRole("button", { name: "Retry history", exact: true }).waitFor();
    await control({ listFailure: false, emptyList: true }); await page.getByRole("button", { name: "Retry history", exact: true }).click();
    await page.getByText("No saved conversations yet. Start a new conversation.", { exact: true }).waitFor();
    await control({ emptyList: false }); await page.getByRole("button", { name: "Reload conversations", exact: true }).click(); await page.getByRole("button", { name: /^Sprint 4 first question/ }).waitFor();
    await closeHistory();
  });
  await check("lost terminal acknowledgment retries same ID without duplicate execution", async () => {
    await page.getByRole("button", { name: "New conversation", exact: true }).click(); await control({ mode: "drop" });
    const before = (await stats()).executions;
    await send("Lost acknowledgment test"); await page.getByRole("button", { name: "Retry this turn", exact: true }).waitFor();
    await page.getByRole("button", { name: "Retry this turn", exact: true }).click(); await answer("Lost acknowledgment test");
    const after = await stats(), calls = after.requests.filter(r => r.path === "/agent/chat").slice(-2);
    assert(calls[0].request_id === calls[1].request_id, "Retry changed UUID"); assert(after.executions === before + 1, "Retry executed twice");
    assert(await log().locator("[data-message-id]").count() === 2, "Retry duplicated bubbles");
  });
  await check("switch during stream ignores late chunks and reopens saved outcome", async () => {
    await page.getByRole("button", { name: "New conversation", exact: true }).click(); await control({ mode: "slow" }); await send("Slow switch test");
    await log().getByText("Partial old-conversation response", { exact: false }).waitFor(); const slowUrl = page.url();
    await (await showConversation("Road estimates")).click(); await answer("Road question");
    await page.waitForFunction(async url => { const r = await fetch(url); const data = await r.json(); return data.requests.some(item => item.path === "/agent/chat"); }, `${fixture}/__stats`);
    await page.waitForTimeout(2800);
    assert(!(await log().getByText("LATE old-conversation response", { exact: false }).count()), "Late chunk landed in another chat");
    await page.goto(slowUrl); await answer("Slow switch test");
  });
  await check("busy guard accepts one send and stop offers same-ID recovery", async () => {
    await page.getByRole("button", { name: "New conversation", exact: true }).click(); await control({ mode: "slow" });
    const before = (await stats()).executions;
    await ready(); await input().fill("Busy stop test"); await input().press("Enter");
    await page.getByRole("button", { name: "Stop response", exact: true }).waitFor(); assert(await input().isDisabled(), "Concurrent input not blocked");
    assert((await stats()).executions === before + 1, "Concurrent sends executed twice");
    await page.getByRole("button", { name: "Stop response", exact: true }).click(); await page.getByRole("button", { name: "Retry this turn", exact: true }).waitFor();
    await control({ finishActive: "interrupted" }); await page.getByRole("button", { name: "Retry this turn", exact: true }).click();
    await log().getByText("This turn was interrupted.", { exact: true }).waitFor(); await ready();
  });
  await check("saved failure permits a new ID; save failure remains uncertain", async () => {
    await page.getByRole("button", { name: "New conversation", exact: true }).click(); await control({ mode: "failed" }); await send("Saved failure test");
    await log().getByText("This turn failed.", { exact: true }).waitFor(); await ready();
    await control({ mode: "save-failure" }); await send("Save failure test"); await page.getByRole("button", { name: "Retry this turn", exact: true }).waitFor();
    assert(await input().isDisabled(), "Uncertain saved state allowed a fresh send");
    await control({ finishActive: "interrupted" }); await page.getByRole("button", { name: "Retry this turn", exact: true }).click();
    await log().getByText("This turn was interrupted.", { exact: true }).waitFor(); await ready();
    const calls = (await stats()).requests.filter(r => r.path === "/agent/chat").slice(-3); assert(calls[0].request_id !== calls[1].request_id && calls[1].request_id === calls[2].request_id, "Incorrect failure/retry UUID lifecycle");
  });
  await check("invalid URL and foreign UUID do not reveal another account's messages", async () => {
    await page.goto(`${origin}/oracle?conversation=javascript:alert(1)`); await ready(); assert(!new URL(page.url()).searchParams.has("conversation"), "Invalid UUID retained");
    await page.goto(`${origin}/oracle?conversation=00000000-0000-4000-8000-000000000201`);
    await page.getByText(/Conversation unavailable\./).waitFor(); assert(!(await log().getByText("B private question", { exact: false }).count()), "Foreign data leaked");
    await page.getByRole("button", { name: "New conversation", exact: true }).click(); await ready();
  });
  await check("401 refresh failure state recovers through manual reload", async () => {
    await page.getByRole("button", { name: "Open conversation history" }).click();
    await control({ authFailures: 2 }); await page.getByRole("button", { name: "Reload conversations", exact: true }).click(); await page.getByText("Your session expired. Sign in again.", { exact: false }).waitFor();
    await page.getByRole("button", { name: "Retry history", exact: true }).click(); await showConversation("Road estimates");
    await closeHistory();
  });
  await check("untrusted saved text renders as text", async () => {
    await send('<img src=x onerror="window.oracleInjected=true">'); await answer('<img src=x onerror="window.oracleInjected=true">');
    assert(await page.evaluate(() => !window.oracleInjected && !document.querySelector('[aria-label="Conversation messages"] img')), "Untrusted HTML executed");
  });
  await check("switching back preserves the pending UUID and saved replay unblocks follow-up", async () => {
    await page.getByRole("button", { name: "New conversation", exact: true }).click(); await control({ mode: "slow" }); await send("Active replay test");
    await log().getByText("Partial old-conversation response", { exact: false }).waitFor();
    await (await showConversation("Road estimates")).click(); await answer("Road question");
    await (await showConversation("Active replay test")).click(); await page.getByRole("button", { name: "Retry this turn", exact: true }).waitFor();
    await control({ finishActive: "completed" }); await page.getByRole("button", { name: "Retry this turn", exact: true }).click(); await answer("Active replay test");
    const calls = (await stats()).requests.filter(r => r.path === "/agent/chat").slice(-2); assert(calls[0].request_id === calls[1].request_id, "Switch lost request UUID");
  });
  await page.screenshot({ path: "output/playwright/oracle-sprint4-desktop.png", fullPage: true });
  await check("mobile history and composer remain usable without horizontal overflow", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "New conversation", exact: true }).click(); await ready();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Mobile horizontal overflow");
    await page.screenshot({ path: "output/playwright/oracle-sprint4-mobile.png", fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
  });
  const login = async email => {
    await page.goto(`${origin}/login`); await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill("synthetic-password"); await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await page.waitForURL("**/dashboard"); await page.goto(`${origin}/oracle`); await ready();
  };
  await check("logout during a pending stream clears state for another account", async () => {
    await control({ mode: "slow" }); await send("Logout pending test"); await log().getByText("Partial old-conversation response", { exact: false }).waitFor();
    await page.getByRole("button", { name: "Open account menu", exact: true }).click();
    await page.getByRole("menuitem", { name: "Sign out", exact: true }).click(); await page.waitForURL(`${origin}/login`);
    await login("b@sprint4.example.invalid"); await showConversation("User B notes");
    await closeHistory();
    await page.waitForTimeout(2800);
    assert(!(await log().getByText("Logout pending test", { exact: false }).count()), "Previous account messages leaked");
    assert(!(await page.getByRole("button", { name: "Retry this turn", exact: true }).count()), "Previous account retry survived");
    assert(!(await page.getByRole("button", { name: "Check unfinished request", exact: true }).count()), "Previous account draft survived");
  });
  await check("next account cannot reopen the prior account URL", async () => {
    await page.goto(chatUrl); await page.getByText(/Conversation unavailable\./).waitFor();
    assert(!(await log().getByText("Sprint 4 follow-up", { exact: false }).count()), "Prior account URL exposed data");
  });
  await check("later login restores original saved text and result metadata", async () => {
    await page.getByRole("button", { name: "Open account menu", exact: true }).click();
    await page.getByRole("menuitem", { name: "Sign out", exact: true }).click(); await page.waitForURL(`${origin}/login`); await login("a@sprint4.example.invalid");
    await page.goto(chatUrl); await log().getByText("Saved answer: Sprint 4 first question", { exact: false }).waitFor(); await readAll(); await answer("Sprint 4 follow-up");
    assert(await log().getByText("1 result record", { exact: true }).count() === 2, "Saved results were not restored after login");
  });
  return { checks_passed: checks.length, checks, scope: "Real Chromium/Next UI with local synthetic Auth/API; no live Supabase JWT or provider", screenshot_directory: "output/playwright" };
}
