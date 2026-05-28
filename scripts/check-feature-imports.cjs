#!/usr/bin/env node

/**
 * Feature-Import Checker — Kunfupay-Payins front apps (FSD strict)
 *
 * Enforces the Feature-Sliced Design layer rules for files under
 * `front/<app>/src/{app,pages,widgets,features,entities,shared}/`.
 *
 * Rules (mirrors `back/scripts/check-layer-violations.cjs` in spirit):
 *
 *   1. **Layer direction.** A file may import only from layers strictly BELOW it.
 *      Hierarchy (top → bottom):
 *          app → pages → widgets → features → entities → shared
 *      Same-layer imports are allowed only within the SAME slice (see rule 2).
 *
 *   2. **Slice isolation.** Within `pages/`, `widgets/`, `features/`, `entities/`,
 *      a slice may not import from a sibling slice. To share code, move it down
 *      to `entities/` or `shared/`.
 *
 *   3. **Public API only.** Imports targeting `pages/`, `widgets/`, `features/`,
 *      `entities/` slices must hit the slice's `index.ts` (the slice root) — they
 *      may not reach deeper into segments. Same-slice internal imports are free.
 *      `shared/` is exempt (its sub-trees are freely importable).
 *
 *   4. **`import type` and `export type` are exempt.** Type-only edges are erased
 *      at compile time and do not create runtime coupling.
 *
 *   5. **External / workspace imports are skipped.** Anything that is not a
 *      `.` relative or `@/` alias import (e.g. `react`, `next`, `@payins/*`).
 *
 * Usage:  node scripts/check-feature-imports.cjs <file1> <file2> ...
 *         (designed for lint-staged; pass staged file paths as args.)
 *
 * Exit code: 0 = clean, 1 = violations.
 */

const fs = require("fs");
const path = require("path");

// Top → bottom. Lower index = higher in the hierarchy.
const LAYERS = ["app", "pages", "widgets", "features", "entities", "shared"];
const SLICED_LAYERS = new Set(["pages", "widgets", "features", "entities"]);
const SOURCE_EXTS = new Set([".ts", ".tsx", ".mts", ".cts"]);

/**
 * Walks up from `from` looking for the nearest dir that contains both a
 * `package.json` and a `src/` directory — that's the front app root.
 */
function findAppRoot(from) {
  let dir = path.dirname(path.resolve(from));
  const stop = path.parse(dir).root;
  while (dir !== stop) {
    if (
      fs.existsSync(path.join(dir, "package.json")) &&
      fs.existsSync(path.join(dir, "src"))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

/**
 * Given an absolute path INSIDE `<appRoot>/src/`, return {layer, slice}.
 * Returns null if the path is outside src/ or not in an FSD layer.
 */
function classify(absPath, appRoot) {
  const srcDir = path.join(appRoot, "src");
  if (absPath !== srcDir && !absPath.startsWith(srcDir + path.sep)) return null;
  const rel = path.relative(srcDir, absPath);
  const parts = rel.split(path.sep);
  const layer = parts[0];
  if (!LAYERS.includes(layer)) return null;
  return { layer, slice: parts[1] || null };
}

/**
 * Resolve an import specifier to an absolute path on disk.
 * Returns null for externals (`react`, `next`), workspace pkgs (`@payins/*`),
 * `node:` builtins, and anything we don't manage.
 */
function resolveImport(importPath, currentFile, appRoot) {
  if (importPath.startsWith("node:")) return null;
  if (importPath.startsWith("@payins/")) return null;
  if (importPath.startsWith("server-only")) return null;
  if (importPath.startsWith(".")) {
    let resolved = path.resolve(path.dirname(currentFile), importPath);
    // Strip a trailing extension if present (the classifier doesn't care).
    return resolved.replace(/\.(ts|tsx|mts|cts|js|mjs|cjs)$/i, "");
  }
  if (importPath.startsWith("@/")) {
    return path.join(appRoot, "src", importPath.slice(2)).replace(
      /\.(ts|tsx|mts|cts|js|mjs|cjs)$/i,
      "",
    );
  }
  return null; // external bare specifier
}

/**
 * Is the resolved path the slice's public-API entry (the slice root,
 * or an explicit `index.ts(x)` inside it)?
 */
function isPublicApiEntry(resolved, target, appRoot) {
  if (!SLICED_LAYERS.has(target.layer) || !target.slice) return true;
  const sliceDir = path.join(appRoot, "src", target.layer, target.slice);
  return (
    resolved === sliceDir ||
    resolved === path.join(sliceDir, "index") ||
    resolved === path.join(sliceDir, "index.ts") ||
    resolved === path.join(sliceDir, "index.tsx")
  );
}

// Matches: `import ... from "x"`, `export ... from "x"`, `import("x")`.
const IMPORT_RE =
  /(?:^|\s)(?:import|export)\s+(?:type\s+)?[^'"`]*?from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/;

function checkFile(filePath) {
  const violations = [];
  if (!SOURCE_EXTS.has(path.extname(filePath))) return violations;

  const appRoot = findAppRoot(filePath);
  if (!appRoot) return violations; // outside a front app — silently skip

  const abs = path.resolve(filePath);
  const src = classify(abs, appRoot);
  if (!src) return violations; // file lives outside any FSD layer

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
    // Skip type-only edges entirely.
    if (/^(?:import|export)\s+type\b/.test(trimmed)) continue;

    const m = raw.match(IMPORT_RE);
    if (!m) continue;
    const importPath = m[1] || m[2];
    if (!importPath) continue;

    const resolved = resolveImport(importPath, abs, appRoot);
    if (!resolved) continue; // external / workspace / not under src/

    const target = classify(resolved, appRoot);
    if (!target) continue; // resolved outside any FSD layer

    const srcIdx = LAYERS.indexOf(src.layer);
    const tgtIdx = LAYERS.indexOf(target.layer);

    // Rule 1: cannot import upward (higher in the hierarchy = lower index).
    if (tgtIdx < srcIdx) {
      violations.push({
        file: filePath,
        line: i + 1,
        importPath,
        reason: `upward import: "${src.layer}/" cannot import from "${target.layer}/" (allowed: ${LAYERS.slice(srcIdx + 1).join(", ") || "(none)"}).`,
      });
      continue;
    }

    // Rule 2: same layer, different slice = forbidden.
    if (
      tgtIdx === srcIdx &&
      SLICED_LAYERS.has(src.layer) &&
      src.slice &&
      target.slice &&
      src.slice !== target.slice
    ) {
      violations.push({
        file: filePath,
        line: i + 1,
        importPath,
        reason: `cross-slice in "${src.layer}/" ("${src.slice}" → "${target.slice}"). Move the shared piece down to entities/ or shared/.`,
      });
      continue;
    }

    // Rule 3: public API only — applies to imports crossing INTO a different slice
    // of a sliced layer. Same-slice imports are free.
    const sameSlice =
      src.layer === target.layer && src.slice && target.slice && src.slice === target.slice;
    if (!sameSlice && !isPublicApiEntry(resolved, target, appRoot)) {
      violations.push({
        file: filePath,
        line: i + 1,
        importPath,
        reason: `deep import into "${target.layer}/${target.slice}". Use the slice's public API (e.g. "@/${target.layer}/${target.slice}"), not internal segments.`,
      });
      continue;
    }
  }

  return violations;
}

const files = process.argv.slice(2);
if (files.length === 0) process.exit(0);

let all = [];
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  all = all.concat(checkFile(f));
}

if (all.length === 0) process.exit(0);

console.log("\n=== FSD Feature-Import Check ===\n");
for (const v of all) {
  console.log(`[ERROR] ${v.file}:${v.line}`);
  console.log(`  ${v.reason}`);
  console.log(`  Import: ${v.importPath}\n`);
}
console.log(`Found ${all.length} violation(s). Fix before committing.`);
console.log("See front/docs/frontend-architecture.md — layer rules & enforcement.");
process.exit(1);
