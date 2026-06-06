import { spawn } from "node:child_process";

const retryCount = Number(process.env.DB_WAIT_RETRIES ?? 20);
const retryDelayMs = Number(process.env.DB_WAIT_DELAY_MS ?? 2000);

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function migrateWhenReady() {
  for (let attempt = 1; attempt <= retryCount; attempt += 1) {
    try {
      await run("npx", ["prisma", "migrate", "deploy"]);
      return;
    } catch (error) {
      console.log(`Waiting for database... ${attempt}/${retryCount}`);
      if (attempt === retryCount) {
        throw error;
      }
      await sleep(retryDelayMs);
    }
  }
}

await migrateWhenReady();
await run("npm", ["run", "start"]);
