import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const SENSITIVE_KEY =
  /authorization|cookie|credential|private.?key|secret|seed|mnemonic|signature|token/i;

export function stableHash(value: unknown): string {
  const canonicalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(canonicalize);
    if (!input || typeof input !== "object") return input;
    return Object.fromEntries(
      Object.entries(input)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  };
  return `0x${createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex")}`;
}

export function stableIdempotencyKey(...parts: string[]): string {
  return createHash("sha256").update(parts.join(":")).digest("hex");
}

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[REDACTED]" : redact(nested),
    ]),
  );
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export class CredentialCipher {
  private readonly key: Buffer;

  constructor(encodedKey: string) {
    this.key = Buffer.from(encodedKey, "base64");
    if (this.key.length !== 32) {
      throw new Error(
        "Credential encryption key must be exactly 32 bytes encoded as base64.",
      );
    }
  }

  encrypt(
    plaintext: string,
    scope: {
      organizationId: string;
      protocolId: string;
      provider: string;
    },
  ): string {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, nonce);
    cipher.setAAD(Buffer.from(credentialScope(scope)));
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      "v1",
      nonce.toString("base64url"),
      tag.toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(".");
  }

  decrypt(
    envelope: string,
    scope: {
      organizationId: string;
      protocolId: string;
      provider: string;
    },
  ): string {
    const [version, nonce, tag, ciphertext, ...extra] = envelope.split(".");
    if (
      version !== "v1" ||
      !nonce ||
      !tag ||
      ciphertext === undefined ||
      extra.length > 0
    ) {
      throw new Error("Credential envelope is invalid.");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(nonce, "base64url"),
    );
    decipher.setAAD(Buffer.from(credentialScope(scope)));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }
}

function credentialScope(scope: {
  organizationId: string;
  protocolId: string;
  provider: string;
}): string {
  return `${scope.organizationId}:${scope.protocolId}:${scope.provider}`;
}
