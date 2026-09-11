import { expect, test } from "@playwright/test";

import { adminClient, loadState } from "./support";

test("a student deletes their account, files included", async ({ page }) => {
  const { users } = loadState();
  await page.goto(users.leaver.login);
  await expect(page).toHaveURL(/\/offers$/);

  await page.goto("/account");
  await page.getByLabel("Tapez SUPPRIMER pour confirmer").fill("SUPPRIMER");
  await page.getByRole("button", { name: "Supprimer définitivement mon compte" }).click();
  await expect(page).toHaveURL(/\/\?compte=supprime$/);
  await expect(page.getByText("Votre compte et vos données ont été supprimés.")).toBeVisible();

  const db = adminClient();
  const { data } = await db.auth.admin.getUserById(users.leaver.id);
  expect(data.user).toBeNull();
  const files = await db.storage.from("documents").list(`${users.leaver.id}/cv`);
  expect(files.data ?? []).toEqual([]);

  await page.goto("/offers");
  await expect(page).toHaveURL(/\/login/);
});
