import { spawnSync } from "node:child_process";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.capture ? "pipe" : "inherit",
    encoding: "utf8",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

function getUiComponentArgs() {
  const listResult = run("npx", ["shadcn@latest", "list", "@shadcn", "--limit", "500"], {
    capture: true,
  });

  if (listResult.status !== 0) {
    throw new Error(listResult.stderr || "shadcn registry list command failed");
  }

  const parsed = JSON.parse(listResult.stdout);
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const uiItems = items
    .filter((item) => item?.type === "registry:ui")
    .map((item) => item?.addCommandArgument || item?.name)
    .filter((value) => typeof value === "string" && value.length > 0);

  return [...new Set(uiItems)];
}

function chunk(values, size) {
  const out = [];
  for (let i = 0; i < values.length; i += size) {
    out.push(values.slice(i, i + size));
  }
  return out;
}

function addItems(items, overwrite) {
  const failed = [];
  const chunked = chunk(items, 12);
  const overwriteArg = overwrite ? ["--overwrite"] : [];

  chunked.forEach((group, index) => {
    console.log(
      `[shadcn:add:all-ui] ${index + 1}/${chunked.length} installing: ${group.join(", ")}`,
    );
    const addResult = run("npx", ["shadcn@latest", "add", ...group, "-y", ...overwriteArg]);

    if (addResult.status === 0) {
      return;
    }

    console.warn("[shadcn:add:all-ui] chunk install failed, retrying each component...");
    group.forEach((item) => {
      const singleResult = run("npx", [
        "shadcn@latest",
        "add",
        item,
        "-y",
        ...overwriteArg,
      ]);
      if (singleResult.status !== 0) {
        failed.push(item);
      }
    });
  });

  return failed;
}

function main() {
  const overwrite = process.argv.includes("--overwrite");

  const uiArgs = getUiComponentArgs();
  if (uiArgs.length === 0) {
    throw new Error("No registry:ui components found from @shadcn.");
  }

  console.log(`[shadcn:add:all-ui] found ${uiArgs.length} ui components.`);
  const failed = addItems(uiArgs, overwrite);

  if (failed.length > 0) {
    console.error(`[shadcn:add:all-ui] failed items: ${failed.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  console.log("[shadcn:add:all-ui] all ui components installed successfully.");
}

main();

