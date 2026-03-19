#!/usr/bin/env node
/**
 * Bump the version in all three package.json files (root, backend, frontend)
 * to the same new value derived from the root package.json.
 *
 * Usage:
 *   node scripts/bump-version.js minor   → 1.2.3 → 1.3.0
 *   node scripts/bump-version.js major   → 1.2.3 → 2.0.0
 *
 * Prints the new version string to stdout.
 */

const fs = require("fs");
const path = require("path");

const type = process.argv[2];
if (!type || !["minor", "major"].includes(type)) {
  console.error("Usage: node scripts/bump-version.js <minor|major>");
  process.exit(1);
}

const root = path.resolve(__dirname, "..");
const files = [
  path.join(root, "package.json"),
  path.join(root, "backend", "package.json"),
  path.join(root, "frontend", "package.json"),
];

// Derive new version from root
const rootPkg = JSON.parse(fs.readFileSync(files[0], "utf8"));
const [major, minor] = rootPkg.version.split(".").map(Number);
const newVersion =
  type === "major" ? `${major + 1}.0.0` : `${major}.${minor + 1}.0`;

// Write new version to all files
for (const file of files) {
  const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  pkg.version = newVersion;
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
}

console.log(newVersion);
