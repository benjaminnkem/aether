import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { once } from "node:events";
import { MongoClient } from "mongodb";

const migrationId = "2026-08-mission-pivot-v2";
const legacyIndexes = {
  idempotency_records: [
    "organizationId_1",
    "protocolId_1",
    "organizationId_1_protocolId_1_updatedAt_-1",
    "organizationId_1_protocolId_1_key_1",
  ],
};
const legacyCollections = [
  "organizations",
  "memberships",
  "protocols",
  "networks",
  "contracts",
  "provider_connections",
  "github_installations",
  "github_sources",
  "desired_state_versions",
  "desired_state_resources",
  "drift_findings",
  "correction_operations",
  "executions",
  "investigations",
  "observations",
  "outbox_events",
  "jobs",
  "queue_jobs",
  "audit_events",
];
const removedFields = {
  organizations: [
    "githubInstallationId",
    "githubRepository",
    "defaultProtocolId",
  ],
  memberships: ["organizationId", "protocolId", "reviewer"],
  integrations: ["github", "openai", "oracle", "protocolId", "organizationId"],
};
const sharedCollectionLegacyFilters = {
  audit_events: { eventHash: { $exists: false } },
  investigations: { investigationId: { $exists: false } },
  observations: { observationId: { $exists: false } },
};
const legacyFilter = (name) => sharedCollectionLegacyFilters[name] ?? {};
const args = new Set(process.argv.slice(2));
const value = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const apply = args.has("--apply");
const expectedDatabase = value("--database");
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is required.");
const client = new MongoClient(uri);
await client.connect();
try {
  const db = client.db();
  const databaseName = db.databaseName;
  if (expectedDatabase && expectedDatabase !== databaseName)
    throw new Error(`Database guard failed: connected to ${databaseName}.`);
  if (apply && !expectedDatabase)
    throw new Error(
      "--apply requires --database with the exact connected database name.",
    );
  const production =
    process.env.NODE_ENV === "production" || /prod/i.test(databaseName);
  if (apply && production && !args.has("--confirm-production-pivot"))
    throw new Error("Production cleanup requires --confirm-production-pivot.");
  const existing = await db
    .collection("aether_migrations")
    .findOne({ migrationId });
  if (existing?.phase === "COMPLETE") {
    console.log(
      JSON.stringify({ migrationId, status: "already_complete", databaseName }),
    );
    process.exitCode = 0;
  } else {
    const existingNames = new Set(
      (await db.listCollections({}, { nameOnly: true }).toArray()).map(
        (item) => item.name,
      ),
    );
    const inventory = [];
    for (const name of legacyCollections)
      if (existingNames.has(name))
        inventory.push({
          name,
          count: await db.collection(name).countDocuments(legacyFilter(name)),
        });
    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry-run",
          databaseName,
          legacyCollections: inventory,
          removedFields,
          legacyIndexes,
        },
        null,
        2,
      ),
    );
    if (!apply)
      console.log("Dry run complete. No records or indexes were changed.");
    else {
      const backupRoot = resolve(
        value("--backup-dir") ??
          `artifacts/migration-backups/${migrationId}-${Date.now()}`,
      );
      mkdirSync(backupRoot, { recursive: true });
      const manifest = {
        migrationId,
        databaseName,
        createdAt: new Date().toISOString(),
        collections: [],
      };
      for (const item of inventory) {
        const file = resolve(backupRoot, `${item.name}.jsonl`);
        const output = createWriteStream(file, { mode: 0o600 });
        const checksum = createHash("sha256");
        let count = 0;
        for await (const document of db
          .collection(item.name)
          .find(legacyFilter(item.name))) {
          const line = `${JSON.stringify(document)}\n`;
          checksum.update(line);
          if (!output.write(line)) await once(output, "drain");
          count += 1;
        }
        output.end();
        await once(output, "finish");
        manifest.collections.push({
          name: item.name,
          count,
          file,
          sha256: checksum.digest("hex"),
        });
      }
      const manifestText = JSON.stringify(manifest, null, 2);
      writeFileSync(resolve(backupRoot, "manifest.json"), manifestText, {
        mode: 0o600,
      });
      const manifestHash = createHash("sha256")
        .update(manifestText)
        .digest("hex");
      await db.collection("aether_migrations").updateOne(
        { migrationId },
        {
          $set: {
            migrationId,
            phase: "EXPORTED",
            manifestHash,
            backupRoot,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );
      if (existingNames.has("organizations"))
        for await (const organization of db
          .collection("organizations")
          .find({}))
          await db.collection("workspaces").updateOne(
            {
              workspaceId: String(
                organization.organizationId ?? organization._id,
              ),
            },
            {
              $setOnInsert: {
                workspaceId: String(
                  organization.organizationId ?? organization._id,
                ),
                name: String(organization.name ?? "Workspace"),
                slug: `migrated-${String(organization.organizationId ?? organization._id)}`,
                status: "ACTIVE",
                defaultChainId: 11155111,
                createdAt: organization.createdAt ?? new Date(),
                updatedAt: new Date(),
              },
            },
            { upsert: true },
          );
      if (existingNames.has("memberships"))
        for await (const membership of db.collection("memberships").find({}))
          await db.collection("workspace_memberships").updateOne(
            {
              workspaceId: String(membership.organizationId),
              userId: String(membership.userId),
            },
            {
              $setOnInsert: {
                workspaceId: String(membership.organizationId),
                userId: String(membership.userId),
                role:
                  String(membership.role).toLowerCase() === "reviewer"
                    ? "OPERATOR"
                    : mapRole(membership.role),
                createdAt: membership.createdAt ?? new Date(),
                updatedAt: new Date(),
              },
            },
            { upsert: true },
          );
      if (existingNames.has("provider_connections")) {
        const encryptionKey = process.env.AETHER_CREDENTIAL_ENCRYPTION_KEY;
        for await (const connection of db
          .collection("provider_connections")
          .find({
            provider: "keeperhub",
            encryptedCredentials: { $type: "string" },
          })) {
          const workspaceId = String(connection.organizationId);
          const credentials = decodeLegacyKeeperHubCredentials(
            String(connection.encryptedCredentials),
            {
              organizationId: workspaceId,
              protocolId: String(connection.protocolId),
              provider: "keeperhub",
            },
            encryptionKey,
          );
          if (!credentials) continue;
          const credentialVersion = 1;
          await db.collection("integrations").updateOne(
            { workspaceId, provider: "keeperhub" },
            {
              $setOnInsert: {
                workspaceId,
                provider: "keeperhub",
                encryptedCredentials: encryptCredential(
                  JSON.stringify(credentials),
                  `${workspaceId}:keeperhub:${credentialVersion}`,
                  encryptionKey,
                ),
                credentialVersion,
                status: "CONFIGURED",
                metadata: { baseUrl: new URL(credentials.baseUrl).origin },
                createdAt: connection.createdAt ?? new Date(),
                updatedAt: new Date(),
              },
            },
            { upsert: true },
          );
        }
      }
      await db
        .collection("aether_migrations")
        .updateOne(
          { migrationId },
          { $set: { phase: "TRANSFORMED", updatedAt: new Date() } },
        );
      for (const [collectionName, indexNames] of Object.entries(
        legacyIndexes,
      )) {
        if (!existingNames.has(collectionName)) continue;
        const existingIndexes = new Set(
          (await db.collection(collectionName).indexes()).map(
            (index) => index.name,
          ),
        );
        for (const indexName of indexNames)
          if (existingIndexes.has(indexName))
            await db.collection(collectionName).dropIndex(indexName);
      }
      for (const { name } of inventory) {
        const filter = sharedCollectionLegacyFilters[name];
        if (filter) {
          await db.collection(name).deleteMany(filter);
          continue;
        }
        await db
          .collection(name)
          .drop()
          .catch((error) => {
            if (error?.codeName !== "NamespaceNotFound") throw error;
          });
      }
      await db.collection("aether_migrations").updateOne(
        { migrationId },
        {
          $set: {
            phase: "COMPLETE",
            completedAt: new Date(),
            updatedAt: new Date(),
          },
        },
      );
      console.log(
        JSON.stringify({
          migrationId,
          status: "complete",
          backupRoot,
          manifestHash,
        }),
      );
    }
  }
} finally {
  await client.close();
}

function mapRole(role) {
  const normalized = String(role ?? "viewer").toUpperCase();
  return ["OWNER", "OPERATOR", "VIEWER", "AGENT"].includes(normalized)
    ? normalized
    : "VIEWER";
}

function decodeLegacyKeeperHubCredentials(envelope, scope, encodedKey) {
  if (!encodedKey) return undefined;
  try {
    const plaintext = decryptCredential(
      envelope,
      `${scope.organizationId}:${scope.protocolId}:${scope.provider}`,
      encodedKey,
    );
    const value = JSON.parse(plaintext);
    if (
      typeof value?.apiKey !== "string" ||
      !value.apiKey.startsWith("kh_") ||
      typeof value?.baseUrl !== "string"
    )
      return undefined;
    const url = new URL(value.baseUrl);
    if (url.protocol !== "https:") return undefined;
    return { apiKey: value.apiKey, baseUrl: url.toString() };
  } catch {
    return undefined;
  }
}

function decryptCredential(envelope, scope, encodedKey) {
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32) throw new Error("Invalid credential key.");
  const [version, nonce, tag, ciphertext, ...extra] = envelope.split(".");
  if (version !== "v1" || !nonce || !tag || !ciphertext || extra.length)
    throw new Error("Invalid credential envelope.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(nonce, "base64url"),
  );
  decipher.setAAD(Buffer.from(scope));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function encryptCredential(plaintext, scope, encodedKey) {
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32) throw new Error("Invalid credential key.");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(scope));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    nonce.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}
