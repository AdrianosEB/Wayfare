import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { InMemorySessionStore } from "../src/session/store.js";
import { createInMemoryAuthDeps } from "../src/auth/index.js";
import { NOW, YEAR } from "./helpers.js";

/**
 * Email + password auth (docs/AUTH_CONTRACT.md). Each `app()` gets fresh stores so tests are
 * isolated; the shared auth deps persist across requests within a single app instance so a
 * signup's cookie resolves on a later /me.
 */
function app() {
  const now = () => NOW;
  return createApp({
    store: new InMemorySessionStore(now),
    auth: createInMemoryAuthDeps(now),
    now,
    year: YEAR,
    useAgent: false,
    model: "test",
  });
}

const CREDS = { email: "Ada@Example.com", password: "correct horse", name: "Ada" };

/** Pull the wf_session cookie value out of a Set-Cookie header array. */
function sessionCookie(res: request.Response): string | undefined {
  const raw = res.headers["set-cookie"] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith("wf_session="));
}

/** Assert no part of a JSON value carries a password/hash field or a bcrypt-looking string. */
function assertNoSecrets(value: unknown): void {
  const json = JSON.stringify(value);
  expect(json).not.toMatch(/passwordHash/i);
  expect(json).not.toMatch(/"password"/i);
  expect(json).not.toMatch(/\$2[aby]\$/); // bcrypt hash prefix
}

describe("auth (AUTH_CONTRACT.md)", () => {
  it("signup → me(user) → logout → me(null)", async () => {
    const a = app();

    const signup = await request(a).post("/api/auth/signup").send(CREDS);
    expect(signup.status).toBe(201);
    expect(signup.body.user.email).toBe("ada@example.com"); // normalized
    expect(signup.body.user.name).toBe("Ada");
    expect(signup.body.user.id).toMatch(/^user_/);
    assertNoSecrets(signup.body);

    const cookie = sessionCookie(signup);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//i);

    const me = await request(a).get("/api/auth/me").set("Cookie", cookie!);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("ada@example.com");
    assertNoSecrets(me.body);

    const logout = await request(a).post("/api/auth/logout").set("Cookie", cookie!);
    expect(logout.status).toBe(204);

    const meAfter = await request(a).get("/api/auth/me").set("Cookie", cookie!);
    expect(meAfter.status).toBe(200);
    expect(meAfter.body.user).toBeNull();
  });

  it("duplicate email → 409 email_taken", async () => {
    const a = app();
    await request(a).post("/api/auth/signup").send(CREDS);
    const dupe = await request(a)
      .post("/api/auth/signup")
      .send({ email: "ADA@example.com", password: "another pass" }); // different case, same email
    expect(dupe.status).toBe(409);
    expect(dupe.body.error.code).toBe("email_taken");
    assertNoSecrets(dupe.body);
  });

  it("login with the right password → 200 + cookie", async () => {
    const a = app();
    await request(a).post("/api/auth/signup").send(CREDS);
    const login = await request(a)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "correct horse" });
    expect(login.status).toBe(200);
    expect(login.body.user.email).toBe("ada@example.com");
    expect(sessionCookie(login)).toBeDefined();
    assertNoSecrets(login.body);
  });

  it("wrong password → 401 invalid_credentials", async () => {
    const a = app();
    await request(a).post("/api/auth/signup").send(CREDS);
    const res = await request(a)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "WRONG" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("invalid_credentials");
    expect(sessionCookie(res)).toBeUndefined();
    assertNoSecrets(res.body);
  });

  it("unknown email → 401 invalid_credentials (identical to wrong password)", async () => {
    const a = app();
    await request(a).post("/api/auth/signup").send(CREDS);

    const wrongPw = await request(a)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "WRONG" });
    const unknown = await request(a)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "whatever" });

    expect(unknown.status).toBe(401);
    expect(unknown.body.error.code).toBe("invalid_credentials");
    // identical response shape + no enumeration
    expect(unknown.status).toBe(wrongPw.status);
    expect(unknown.body).toEqual(wrongPw.body);
  });

  it("guest /me → { user: null }, not 401", async () => {
    const a = app();
    const me = await request(a).get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body).toEqual({ user: null });
  });

  it("logout is idempotent (no cookie → still 204)", async () => {
    const a = app();
    const res = await request(a).post("/api/auth/logout");
    expect(res.status).toBe(204);
  });

  it("malformed body → 400 invalid_request", async () => {
    const a = app();
    const badEmail = await request(a)
      .post("/api/auth/signup")
      .send({ email: "not-an-email", password: "longenough" });
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.error.code).toBe("invalid_request");

    const shortPw = await request(a)
      .post("/api/auth/signup")
      .send({ email: "x@example.com", password: "short" });
    expect(shortPw.status).toBe(400);
    expect(shortPw.body.error.code).toBe("invalid_request");
  });

  it("auth is additive — guests keep full planner access", async () => {
    const a = app();
    // no cookie at all; the planner create route must still work
    const res = await request(a)
      .post("/api/session")
      .send({ prompt: "a relaxed 8-day beach trip in Greece in late August for two, ~€2,500" });
    expect(res.status).toBe(200);
    expect(res.body.sessionId).toMatch(/^sess_/);
  });
});
