import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asRole, createMigratedDb } from "./setup";

let db: PGlite;
const USER = "00000000-0000-0000-0000-0000000000bb";

beforeAll(async () => {
  db = await createMigratedDb();
  await db.exec(`insert into auth.users (id, email) values ('${USER}', 'bonus@example.org')`);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

async function grant(): Promise<number | undefined> {
  return (await db.query<{ balance: number }>(`select public.grant_signup_bonus() as balance`))
    .rows[0]?.balance;
}

describe("grant_signup_bonus", () => {
  it("credits 5 once, however many times it is called", async () => {
    await asRole(db, "authenticated", USER, async () => {
      expect(await grant()).toBe(5);
      expect(await grant()).toBe(5);
    });
    const ledger = await db.query(
      `select delta, reason from public.credit_transactions where user_id = '${USER}'`,
    );
    expect(ledger.rows).toEqual([{ delta: 5, reason: "signup_bonus" }]);
  });

  it("is refused to anonymous visitors", async () => {
    await asRole(db, "anon", null, async () => {
      await expect(grant()).rejects.toThrow(/permission denied/);
    });
  });
});
