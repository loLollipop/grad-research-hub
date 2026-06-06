import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = process.cwd();
const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";

function sqlitePathFromUrl(url) {
  if (!url.startsWith("file:")) {
    throw new Error("Only SQLite file: URLs are supported by the MVP init script.");
  }

  const raw = url.slice("file:".length);
  if (path.isAbsolute(raw)) {
    return raw;
  }

  return path.resolve(root, "prisma", raw);
}

const dbPath = sqlitePathFromUrl(databaseUrl);
const sqlPath = path.resolve(root, "prisma", "migrations", "0001_init", "migration.sql");

mkdirSync(path.dirname(dbPath), { recursive: true });

if (existsSync(dbPath)) {
  rmSync(dbPath);
}

const sql = readFileSync(sqlPath, "utf8");
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON;");
db.exec(sql);
db.close();

console.log(`Initialized SQLite database at ${dbPath}`);
