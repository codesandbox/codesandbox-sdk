#!/usr/bin/env node

const watcher = require("@parcel/watcher");
const { execSync } = require("child_process");
const path = require("path");

console.log("🚀 Starting CLI development mode...");
console.log("");

const buildCliOnly = () => {
  console.log("🔨 Building CLI...");
  console.log("");

  const startTime = Date.now();

  try {
    execSync("node esbuild.cjs", { stdio: "inherit" });
    execSync("chmod +x dist/bin/codesandbox.mjs", { stdio: "inherit" });

    const duration = Date.now() - startTime;

    console.log(`✅ CLI build completed in ${duration}ms`);
    console.log("");

    return true;
  } catch (error) {
    console.error("❌ CLI build failed:", error.message);
    console.log("");

    return false;
  }
};

console.log("🔨 Initial build...");
console.log("");

try {
  execSync("npm run build", { stdio: "inherit" });

  console.log("✅ Initial build completed, watching for changes...");
  console.log("");
} catch (error) {
  console.error("❌ Initial build failed:", error.message);
  process.exit(1);
}

const startWatching = async () => {
  const watchPath = path.join(__dirname, "../src/bin");

  try {
    let subscription = await watcher.subscribe(watchPath, (err, events) => {
      if (err) {
        console.error("❌ Watcher error:", err);
        return;
      }

      // Filter out temporary files and directories
      const relevantEvents = events.filter((event) => {
        const filename = path.basename(event.path);
        const validExtensions = [".ts", ".tsx", ".js", ".jsx"];
        
        return (
          !filename.startsWith(".") &&
          !filename.includes("node_modules") &&
          validExtensions.some(ext => filename.endsWith(ext))
        );
      });

      if (relevantEvents.length === 0) {
        return;
      }

      console.log(`📝 File${relevantEvents.length > 1 ? "s" : ""} changed:`);

      relevantEvents.forEach((event) => {
        const relativePath = path.relative(process.cwd(), event.path);
        console.log(`   ${event.type}: ${relativePath}`);
      });

      console.log("");

      const shouldRebuild = buildCliOnly();

      if (!shouldRebuild) {
        console.log("🔄 Watching for changes...");
        console.log("");
      }
    });

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n🛑 Stopping watcher...");
      await subscription.unsubscribe();
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Failed to start watcher:", error);
    process.exit(1);
  }
};

startWatching();
