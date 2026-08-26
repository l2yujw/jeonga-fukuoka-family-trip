import { createHash, randomBytes } from "node:crypto";

const token = randomBytes(32).toString("base64url");
const hash = createHash("sha256").update(token, "utf8").digest("hex");

console.log(`Raw invite token: ${token}`);
console.log(`SHA-256 lowercase hex hash: ${hash}`);
console.log(`Local invite URL: http://localhost:3000/invite/${token}`);
console.warn("Keep the raw token private. Only the hash belongs in the database.");
