import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
// Server-only deployment key; never exposed through NEXT_PUBLIC or public/.
mkdirSync("server", { recursive: true });
writeFileSync("server/preview-key", randomBytes(48).toString("hex"), { mode: 0o600 });
