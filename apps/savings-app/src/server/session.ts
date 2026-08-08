import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { verifyMessage, type Address, getAddress } from "viem";
import { z } from "zod";
import { configuration } from "./config";

const APP_COOKIE = "aether_savings_session";
const WALLET_COOKIE = "aether_savings_wallet";
const CHALLENGE_COOKIE = "aether_savings_challenge";
const SESSION_SECONDS = 8 * 60 * 60;

const envelopeSchema = z
  .object({ payload: z.string(), signature: z.string() })
  .strict();
const sessionSchema = z
  .object({ kind: z.literal("app"), expiresAt: z.number().int() })
  .strict();
const walletSchema = z
  .object({
    kind: z.literal("wallet"),
    address: z.string(),
    expiresAt: z.number().int(),
  })
  .strict();
const challengeSchema = z
  .object({
    kind: z.literal("challenge"),
    nonce: z.string(),
    message: z.string(),
    expiresAt: z.number().int(),
  })
  .strict();

export function assertMutationOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== configuration().appOrigin)
    throw new SessionError("Request origin is not allowed.", 403);
}

export async function requireApplicationSession() {
  const jar = await cookies();
  const value = jar.get(APP_COOKIE)?.value;
  if (!value || !readSigned(value, sessionSchema))
    throw new SessionError("Application access is required.", 401);
}

export async function requireWalletSession(): Promise<Address> {
  await requireApplicationSession();
  const jar = await cookies();
  const value = jar.get(WALLET_COOKIE)?.value;
  const wallet = value ? readSigned(value, walletSchema) : undefined;
  if (!wallet)
    throw new SessionError("Connect and verify a Sepolia wallet first.", 401);
  return getAddress(wallet.address);
}

export function establishApplicationSession(response: NextResponse) {
  setCookie(
    response,
    APP_COOKIE,
    sign({ kind: "app", expiresAt: expiresIn(SESSION_SECONDS) }),
    SESSION_SECONDS,
  );
}

export function clearSessions(response: NextResponse) {
  for (const name of [APP_COOKIE, WALLET_COOKIE, CHALLENGE_COOKIE]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "strict",
      secure: isProduction(),
      path: "/savings-app",
      maxAge: 0,
    });
  }
}

export function issueWalletChallenge(response: NextResponse) {
  const nonce = randomBytes(16).toString("hex");
  const expiresAt = expiresIn(5 * 60);
  const message = [
    "Aether Savings wallet verification",
    "",
    `Origin: ${configuration().appOrigin}`,
    "Chain ID: 11155111",
    `Nonce: ${nonce}`,
    `Expires: ${new Date(expiresAt).toISOString()}`,
    "",
    "This signature proves address control. It does not authorize a transaction.",
  ].join("\n");
  setCookie(
    response,
    CHALLENGE_COOKIE,
    sign({ kind: "challenge", nonce, message, expiresAt }),
    5 * 60,
  );
  return message;
}

export async function verifyWalletChallenge(
  address: Address,
  signature: `0x${string}`,
) {
  const jar = await cookies();
  const encoded = jar.get(CHALLENGE_COOKIE)?.value;
  const challenge = encoded ? readSigned(encoded, challengeSchema) : undefined;
  if (!challenge)
    throw new SessionError(
      "Wallet challenge expired. Request a new challenge.",
      401,
    );
  const normalized = getAddress(address);
  const valid = await verifyMessage({
    address: normalized,
    message: challenge.message,
    signature,
  });
  if (!valid) throw new SessionError("Wallet signature is invalid.", 401);
  return normalized;
}

export function establishWalletSession(
  response: NextResponse,
  address: Address,
) {
  setCookie(
    response,
    WALLET_COOKIE,
    sign({
      kind: "wallet",
      address: getAddress(address),
      expiresAt: expiresIn(SESSION_SECONDS),
    }),
    SESSION_SECONDS,
  );
  response.cookies.set(CHALLENGE_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: isProduction(),
    path: "/savings-app",
    maxAge: 0,
  });
}

export function issueRunViewToken(runId: string, address: Address) {
  return sign({
    kind: "run",
    runId,
    address: getAddress(address),
    expiresAt: expiresIn(SESSION_SECONDS),
  });
}

export async function assertRunViewToken(runId: string, token: string | null) {
  const address = await requireWalletSession();
  const schema = z
    .object({
      kind: z.literal("run"),
      runId: z.literal(runId),
      address: z.string(),
      expiresAt: z.number().int(),
    })
    .strict();
  const view = token ? readSigned(token, schema) : undefined;
  if (!view || getAddress(view.address) !== address)
    throw new SessionError("Run access token is invalid or expired.", 403);
}

export function accessTokenMatches(value: string) {
  const expected = Buffer.from(configuration().accessToken);
  const received = Buffer.from(value);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

function sign(payload: object) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const signature = createHmac("sha256", configuration().sessionSecret)
    .update(encodedPayload)
    .digest("base64url");
  return Buffer.from(
    JSON.stringify({ payload: encodedPayload, signature }),
  ).toString("base64url");
}

function readSigned<T>(encoded: string, schema: z.ZodType<T>): T | undefined {
  try {
    const envelope = envelopeSchema.parse(
      JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")),
    );
    const expected = createHmac("sha256", configuration().sessionSecret)
      .update(envelope.payload)
      .digest();
    const received = Buffer.from(envelope.signature, "base64url");
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    )
      return undefined;
    const parsed = schema.parse(
      JSON.parse(Buffer.from(envelope.payload, "base64url").toString("utf8")),
    ) as T & { expiresAt?: number };
    if (typeof parsed.expiresAt !== "number" || parsed.expiresAt <= Date.now())
      return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function setCookie(
  response: NextResponse,
  name: string,
  value: string,
  maxAge: number,
) {
  response.cookies.set(name, value, {
    httpOnly: true,
    sameSite: "strict",
    secure: isProduction(),
    path: "/savings-app",
    maxAge,
  });
}
function expiresIn(seconds: number) {
  return Date.now() + seconds * 1000;
}
function isProduction() {
  return configuration().environment === "production";
}

export class SessionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SessionError";
  }
}
