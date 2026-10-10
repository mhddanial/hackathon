async (page) => {
  const url = new URL(page.url());
  const original = url.searchParams.get("conversation");
  if (!original) throw new Error("Reopen a saved conversation before running these checks");
  url.searchParams.set("conversation", original.toUpperCase());
  await page.goto(url.toString());
  await page.getByRole("log", { name: "Conversation messages" }).getByText("Saved answer: Sprint 4 first question", { exact: false }).waitFor();
  if (new URL(page.url()).searchParams.get("conversation") !== original.toLowerCase()) throw new Error("Bookmark UUID was not canonicalized");
  const placeholder = await page.getByRole("textbox", { name: "Message Oracle" }).getAttribute("placeholder");
  if (placeholder !== "Ask about congestion, routes, or schedules…") throw new Error("Punctuation encoding is incorrect");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "output/playwright/oracle-sprint4-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "New conversation", exact: true }).click();
  await page.getByRole("textbox", { name: "Message Oracle" }).waitFor();
  await page.screenshot({ path: "output/playwright/oracle-sprint4-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  return { checks_passed: 2, checks: ["uppercase bookmark UUID restores owned history", "page punctuation renders as UTF-8"], scope: "Chromium/Next UI with local synthetic services" };
}
