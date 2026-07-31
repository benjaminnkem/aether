import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const requireFromApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
const mongoose = requireFromApi("mongoose");

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const separator = line.indexOf("=");
  if (separator <= 0 || line.trimStart().startsWith("#")) continue;
  const name = line.slice(0, separator).trim();
  if (!process.env[name]) process.env[name] = line.slice(separator + 1).trim();
}
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
const apply = process.argv.includes("--apply");
await mongoose.connect(process.env.MONGODB_URI);
const database = mongoose.connection.db;
if (!database) throw new Error("MongoDB connection is unavailable.");

const collections = await database
  .listCollections({}, { nameOnly: true })
  .toArray();
const report = [];
for (const { name } of collections) {
  const collection = database.collection(name);
  const filter =
    name === "organizations"
      ? { organizationId: "org-arcadia" }
      : {
          $or: [
            { organizationId: "org-arcadia" },
            { protocolId: "arcadia" },
            { operationId: "op-oracle-restoration" },
            { executionId: "exec-kh-8314" },
          ],
        };
  const count = await collection.countDocuments(filter);
  if (count > 0) {
    report.push({ collection: name, matchingLegacyRecords: count });
    if (apply) await collection.deleteMany(filter);
  }
}
if (apply) {
  await database
    .collection("mvp_state")
    .drop()
    .catch(() => undefined);
}
await mongoose.disconnect();
console.log(JSON.stringify({ applied: apply, report }, null, 2));
if (!apply && report.length) {
  console.log(
    "Re-run with --apply to delete only the listed legacy sample records.",
  );
}
