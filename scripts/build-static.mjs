import { basename, dirname, join, normalize, resolve, sep } from "node:path";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? resolve(process.argv[index + 1]) : fallback;
}

function extractObjectLiteral(source, declaration) {
  const declarationIndex = source.indexOf(declaration);
  if (declarationIndex < 0) throw new Error(`Missing declaration: ${declaration}`);
  const start = source.indexOf("{", declarationIndex);
  let depth = 0;
  let quote = "";
  let escaped = false;

  for (let index = start; index < source.length; index++) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) return { start, end: index + 1, text: source.slice(start, index + 1) };
  }
  throw new Error(`Unterminated object: ${declaration}`);
}

function safeAssetPath(path) {
  const clean = normalize(path.trim()).split(sep).join("/");
  if (!clean || clean === "." || clean.startsWith("../") || clean.startsWith("/")) {
    throw new Error(`Unsafe asset path: ${path}`);
  }
  return clean;
}

function manifestAssets(manifest) {
  const paths = new Set();
  for (const group of Object.values(manifest.sprites || {})) {
    for (const state of Object.values(group.states || {})) {
      paths.add(safeAssetPath(join(group.basePath || "", state.file)));
    }
  }
  for (const file of Object.values(manifest.background?.files || {})) {
    paths.add(safeAssetPath(join(manifest.background?.basePath || "", file)));
  }
  for (const file of Object.values(manifest.ui?.files || {})) {
    paths.add(safeAssetPath(join(manifest.ui?.basePath || "", file)));
  }
  return paths;
}

function directAssets(source) {
  const paths = new Set();
  for (const match of source.matchAll(/(?:\.\/)?assets\/([A-Za-z0-9_ .&/-]+\.(?:png|webp|mp3|json|wav|ogg))/g)) {
    paths.add(safeAssetPath(match[1]));
  }
  return paths;
}

function ensureAssetsExist(root, assets) {
  for (const asset of assets) {
    const source = join(root, "assets", asset);
    if (!existsSync(source)) throw new Error(`Missing source asset: assets/${asset}`);
  }
}

function copyLayeredAssets(root, assets) {
  for (const asset of assets) {
    const target = join(root, "dist", "assets", asset);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(root, "assets", asset), target);
  }
}

function flattenMap(root, assets) {
  const result = new Map();
  for (const asset of assets) {
    const flatName = basename(asset);
    const existing = result.get(flatName);
    if (existing && existing !== asset) {
      throw new Error(`Basename collision: ${existing} and ${asset}`);
    }
    if (!existing) result.set(flatName, asset);
  }
  return result;
}

function flattenManifest(manifest) {
  const output = structuredClone(manifest);
  for (const group of Object.values(output.sprites || {})) {
    const oldBase = group.basePath || "";
    group.basePath = "";
    for (const state of Object.values(group.states || {})) state.file = basename(safeAssetPath(join(oldBase, state.file)));
  }
  for (const sectionName of ["background", "ui"]) {
    const section = output[sectionName];
    if (!section) continue;
    const oldBase = section.basePath || "";
    section.basePath = "";
    for (const [key, file] of Object.entries(section.files || {})) section.files[key] = basename(safeAssetPath(join(oldBase, file)));
  }
  return output;
}

function iframeHtml(source, manifestRange, manifest, assets) {
  const flatManifest = JSON.stringify(flattenManifest(manifest), null, 8);
  let output = source.slice(0, manifestRange.start) + flatManifest + source.slice(manifestRange.end);
  for (const asset of [...assets].sort((a, b) => b.length - a.length)) {
    output = output.replaceAll(`./assets/${asset}`, `./${basename(asset)}`);
    output = output.replaceAll(`assets/${asset}`, basename(asset));
  }
  output = output.replace(/return `assets\/\$\{basePath \|\| ""\}\$\{file\}`;/, 'return `${basePath || ""}${file}`;');
  return output;
}

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = option("--root", defaultRoot);
const sourcePath = join(root, "index.html");
if (!existsSync(sourcePath)) throw new Error(`Missing canonical source: ${sourcePath}`);

const source = readFileSync(sourcePath, "utf8");
const manifestRange = extractObjectLiteral(source, "const VISUAL_FREEZE_MANIFEST =");
const manifest = JSON.parse(manifestRange.text);
const assets = new Set([...manifestAssets(manifest), ...directAssets(source)]);
ensureAssetsExist(root, assets);
const flattened = flattenMap(root, assets);

rmSync(join(root, "dist"), { recursive: true, force: true });
rmSync(join(root, "sisterrun-sandbox-iframe"), { recursive: true, force: true });
mkdirSync(join(root, "dist"), { recursive: true });
mkdirSync(join(root, "sisterrun-sandbox-iframe"), { recursive: true });
copyLayeredAssets(root, assets);
writeFileSync(join(root, "dist", "index.html"), source);
writeFileSync(join(root, "sisterrun-sandbox-iframe", "index.html"), iframeHtml(source, manifestRange, manifest, assets));
for (const [flatName, asset] of flattened) copyFileSync(join(root, "assets", asset), join(root, "sisterrun-sandbox-iframe", flatName));

console.log(`Built dist and sandbox iframe from index.html (${assets.size} assets).`);
