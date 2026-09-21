import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const manifestPath = path.join(
  projectRoot,
  "src",
  "game",
  "assets",
  "assetManifest.json",
);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const errors = [];
const seenKeys = new Set();
const allowedKinds = new Set(["image", "spritesheet", "atlas", "audio"]);

if (!Array.isArray(manifest)) {
  errors.push("Asset manifest must be an array.");
} else {
  for (const asset of manifest) {
    if (!asset || typeof asset !== "object") {
      errors.push("Every asset entry must be an object.");
      continue;
    }

    if (typeof asset.key !== "string" || asset.key.length === 0) {
      errors.push("Every asset must have a non-empty key.");
    } else if (seenKeys.has(asset.key)) {
      errors.push("Duplicate asset key: " + asset.key);
    } else {
      seenKeys.add(asset.key);
    }

    if (!allowedKinds.has(asset.kind)) {
      errors.push("Invalid asset kind for " + asset.key + ": " + asset.kind);
    }

    if (typeof asset.url !== "string" || !asset.url.startsWith("/assets/")) {
      errors.push("Asset URL must start with /assets/: " + asset.key);
    }

    if (asset.kind === "spritesheet") {
      const metadata = ["frameWidth", "frameHeight", "frameCount"];
      for (const field of metadata) {
        if (!Number.isInteger(asset[field]) || asset[field] <= 0) {
          errors.push("Spritesheet " + asset.key + " needs a positive " + field + ".");
        }
      }
    }

    if (asset.required === true) {
      const publicPath = path.join(projectRoot, "public", asset.url.slice(1));
      if (!existsSync(publicPath)) {
        errors.push("Required asset file is missing: " + publicPath);
      }
    }
  }
}

if (errors.length > 0) {
  console.error("Asset manifest validation failed:");
  for (const error of errors) {
    console.error("- " + error);
  }
  process.exit(1);
}

const requiredCount = manifest.filter((asset) => asset.required === true).length;
console.log(
  "Asset manifest validation passed: " +
    manifest.length +
    " entries, " +
    requiredCount +
    " required assets.",
);
