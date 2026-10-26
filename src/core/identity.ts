import { readFileSync, existsSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Actor, Role } from "./contracts.ts";
import { DomainError } from "./contracts.ts";
const configPath = new URL("../../var/identity.json", import.meta.url);
export const identity = existsSync(configPath)
  ? (JSON.parse(readFileSync(configPath, "utf8")) as { issuer: string; clientId: string; clientSecret: string; redirectUri: string })
  : null;
const pending = new Map<string, { verifier: string; nonce: string; expires: number }>();
const jwks = identity ? createRemoteJWKSet(new URL(`${identity.issuer}/protocol/openid-connect/certs`)) : null;
export function startLogin() {
  if (!identity) throw new DomainError(503, "Chưa cấu hình Identity.");
  for (const [key, value] of pending) if (value.expires < Date.now()) pending.delete(key);
  const state = randomBytes(32).toString("base64url"),
    verifier = randomBytes(48).toString("base64url"),
    nonce = randomBytes(32).toString("base64url");
  pending.set(state, { verifier, nonce, expires: Date.now() + 300000 });
  const params = new URLSearchParams({
    client_id: identity.clientId,
    redirect_uri: identity.redirectUri,
    response_type: "code",
    prompt: "login",
    scope: "openid profile",
    state,
    nonce,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  });
  return { state, url: `${identity.issuer}/protocol/openid-connect/auth?${params}` };
}
export async function finishLogin(code: string, state: string, cookieState: string) {
  const flow = pending.get(state);
  pending.delete(state);
  if (!identity || !jwks || !flow || flow.expires < Date.now() || state !== cookieState)
    throw new DomainError(401, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
  const response = await fetch(`${identity.issuer}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: identity.clientId,
      client_secret: identity.clientSecret,
      redirect_uri: identity.redirectUri,
      code,
      code_verifier: flow.verifier,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new DomainError(401, "Không thể đổi mã đăng nhập.");
  const token = (await response.json()) as { id_token: string };
  let payload;
  try {
    ({ payload } = await jwtVerify(token.id_token, jwks, { issuer: identity.issuer, audience: identity.clientId, algorithms: ["RS256"] }));
  } catch {
    throw new DomainError(401, "Token đăng nhập không hợp lệ.");
  }
  if (
    payload.nonce !== flow.nonce ||
    !payload.sub ||
    typeof payload.tenant !== "string" ||
    !["planner", "approver", "viewer"].includes(String(payload.role)) ||
    !payload.exp
  )
    throw new DomainError(403, "Danh tính chưa có tenant hoặc vai trò hợp lệ.");
  return { actor: { id: payload.sub, tenant: payload.tenant, role: payload.role as Role } satisfies Actor, expires: payload.exp * 1000 };
}
