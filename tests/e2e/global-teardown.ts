import { existsSync, unlinkSync } from "node:fs";

import { adminClient, loadState, STATE_FILE } from "./support";

/** Removes the seeded students (files first, rows by cascade) and the seeded offer. */
export default async function globalTeardown() {
  if (!existsSync(STATE_FILE)) return;
  const state = loadState();
  const db = adminClient();
  for (const user of Object.values(state.users)) {
    for (const folder of ["cv", "letter"]) {
      const files = await db.storage.from("documents").list(`${user.id}/${folder}`);
      const paths = (files.data ?? []).map((file) => `${user.id}/${folder}/${file.name}`);
      if (paths.length > 0) await db.storage.from("documents").remove(paths);
    }
    await db.auth.admin.deleteUser(user.id);
  }
  await db.from("offers").delete().eq("id", state.offerId);
  unlinkSync(STATE_FILE);
}
