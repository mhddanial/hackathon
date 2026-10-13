async (page) => {
  const app = new URL(page.url()).origin;
  const fixture = "http://127.0.0.1:9010";
  const checks = [];
  const log = page.getByRole("log", { name: "Conversation messages" });
  const remove = page.getByRole("button", { name: "Delete conversation", exact: true });
  const input = page.getByRole("textbox", { name: "Message Oracle" });
  const stats = async () => (await page.request.get(`${fixture}/__stats`)).json();
  const control = async data => {
    const response = await page.request.post(`${fixture}/__control`, { data });
    if (!response.ok()) throw new Error("Fixture control failed");
  };
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const ready = async () => {
    await page.waitForFunction(() => {
      const button = document.querySelector('button[aria-label="Delete conversation"]');
      return button && !button.disabled;
    });
  };
  const check = async (name, run) => {
    await run(); checks.push(name); await control({ uiChecks: checks });
  };
  await page.goto(`${app}/oracle?conversation=00000000-0000-4000-8000-000000000101`);
  await log.getByText("Saved answer: Harbour question", { exact: false }).waitFor();
  await ready();
  const originalUrl = page.url();

  await check("confirmation cancellation keeps the chat and sends no DELETE", async () => {
    const before = (await stats()).requests.filter(item => item.method === "DELETE").length;
    page.once("dialog", async dialog => {
      assert(dialog.message().includes("Harbour planning") && dialog.message().includes("cannot be undone"), "Missing deletion consequence/title");
      await dialog.dismiss();
    });
    await remove.click();
    assert((await stats()).requests.filter(item => item.method === "DELETE").length === before, "Cancellation deleted data");
    assert(page.url() === originalUrl, "Cancellation changed selection");
    assert(await log.getByText("Saved answer: Harbour question", { exact: false }).count(), "Cancellation cleared messages");
  });

  await check("failed deletion keeps the selected chat and shows a safe error", async () => {
    await control({ deleteFailure: true });
    page.once("dialog", dialog => dialog.accept());
    await remove.click();
    await page.getByRole("alert").filter({ hasText: "Oracle is unavailable. Please retry." }).waitFor();
    await ready();
    assert(page.url() === originalUrl, "Failed deletion changed selection");
    assert(await log.getByText("Saved answer: Harbour question", { exact: false }).count(), "Failed deletion cleared messages");
    await control({ deleteFailure: false });
  });

  await check("confirmed deletion clears messages, selection URL, saved list and result cards", async () => {
    page.once("dialog", dialog => dialog.accept());
    await remove.click();
    await page.waitForURL(url => !url.searchParams.has("conversation"));
    await page.getByRole("heading", { name: "New conversation", exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('button[aria-label="Reload conversations"]').disabled);
    assert(!await log.getByText("Saved answer: Harbour question", { exact: false }).count(), "Deleted messages remained");
    assert(!await log.getByText("1 result record", { exact: true }).count(), "Deleted results remained");
    assert(!await remove.count(), "Delete offered for an unsaved draft");
    const values = await stats();
    assert(!values.conversations.some(item => item.id.endsWith("000000000101")), "Deleted fixture conversation remained");
    assert(values.conversations.some(item => item.id.endsWith("000000000102")), "Another conversation was removed");
  });

  await check("deleted bookmark returns unavailable after refresh", async () => {
    await page.goto(originalUrl);
    await page.getByRole("alert").filter({ hasText: "Conversation unavailable. It may no longer exist or belong to this account." }).waitFor();
    await page.waitForURL(url => !url.searchParams.has("conversation"));
    assert(!new URL(page.url()).searchParams.has("conversation"), "Deleted UUID remained selected");
  });

  await check("archived chats can be permanently deleted", async () => {
    await page.goto(`${app}/oracle?conversation=00000000-0000-4000-8000-000000000103`);
    await log.getByText("Saved answer: Archived question", { exact: false }).waitFor();
    await ready();
    page.once("dialog", dialog => dialog.accept());
    await remove.click();
    await page.waitForURL(url => !url.searchParams.has("conversation"));
    assert(!(await stats()).conversations.some(item => item.id.endsWith("000000000103")), "Archived chat remained");
  });

  await check("delete is blocked during streaming and after an unresolved active turn", async () => {
    await page.goto(`${app}/oracle?conversation=00000000-0000-4000-8000-000000000102`);
    await log.getByText("Saved answer: Road question", { exact: false }).waitFor();
    await ready();
    await control({ mode: "slow" });
    await input.fill("Active deletion check");
    await page.getByRole("button", { name: "Send message", exact: true }).click();
    await log.getByText("Partial old-conversation response", { exact: false }).waitFor();
    assert(await remove.isDisabled(), "Delete enabled during response");
    await page.getByRole("button", { name: "Stop response", exact: true }).click();
    assert(await remove.isDisabled(), "Delete enabled for an unresolved turn");
    await control({ finishActive: "interrupted" });
  });
  return { checks_passed: checks.length, checks, scope: "Next.js/Chromium with synthetic Auth/API; no real chats or Gemini calls" };
}
