import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const recipesSource = readFileSync(path.join(root, "src", "recipes.ts"), "utf8");
const prototypeSource = readFileSync(path.join(root, "src", "Prototype.tsx"), "utf8");

const recipes = [...recipesSource.matchAll(/\n\s+"((?:sc|cq|hn|jx)-[^"]+)",\s*"([^"]+)"/g)]
  .map(([, id, name]) => ({ id, name }));

function pngDimensions(filePath) {
  const bytes = readFileSync(filePath);
  const signature = bytes.subarray(0, 8).toString("hex");
  assert.equal(signature, "89504e470d0a1a0a", `${filePath} must be a PNG`);
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function jpegDimensions(filePath) {
  const bytes = readFileSync(filePath);
  assert.equal(bytes.readUInt16BE(0), 0xffd8, `${filePath} must be a JPEG`);
  const startOfFrameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

  for (let offset = 2; offset + 8 < bytes.length;) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0xda) break;

    const blockLength = bytes.readUInt16BE(offset);
    if (startOfFrameMarkers.has(marker)) {
      return {
        width: bytes.readUInt16BE(offset + 5),
        height: bytes.readUInt16BE(offset + 3),
      };
    }
    offset += blockLength;
  }

  assert.fail(`${filePath} is missing JPEG dimensions`);
}

test("every recipe has a substantial landscape food photograph", () => {
  assert.equal(recipes.length, 36, "the image contract must cover all 36 recipes");

  for (const { id, name } of recipes) {
    const isLaziji = id === "sc-laziji";
    const relativePath = isLaziji
      ? path.join("public", "assets", "app", "laziji.png")
      : path.join("public", "assets", "app", "dishes", `${id}.jpg`);
    const filePath = path.join(root, relativePath);

    assert.ok(existsSync(filePath), `${name} is missing its food photograph`);
    assert.ok(statSync(filePath).size > 100_000, `${name} photograph is unexpectedly small`);

    const { width, height } = isLaziji ? pngDimensions(filePath) : jpegDimensions(filePath);
    assert.ok(width >= 1024, `${name} photograph is too narrow`);
    assert.ok(height >= 576, `${name} photograph is too short`);
    assert.ok(width > height, `${name} photograph must be landscape`);
  }
});

test("recipe details render each recipe's own photograph", () => {
  assert.match(recipesSource, /image:\s*string;/, "Recipe must expose an image path");
  assert.match(prototypeSource, /<img\s+src=\{dish\.image\}/, "detail page must render the recipe image");
  assert.doesNotMatch(prototypeSource, /const isLaziji = dish\.name === "辣子鸡";/, "details must not special-case one dish");
});
