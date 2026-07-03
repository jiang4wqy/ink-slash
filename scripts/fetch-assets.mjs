// Copies the MediaPipe wasm runtime into public/wasm and downloads the hand
// landmarker model into public/models so the app runs fully offline.
import { existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wasmSrc = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const wasmDest = join(root, "public", "wasm");
const modelDir = join(root, "public", "models");
const modelPath = join(modelDir, "hand_landmarker.task");
const modelUrl =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";

function copyWasm() {
  if (!existsSync(wasmSrc)) {
    console.error(`[fetch-assets] 找不到 ${wasmSrc}，请先运行 npm install。`);
    process.exit(1);
  }
  mkdirSync(wasmDest, { recursive: true });
  for (const file of readdirSync(wasmSrc)) {
    copyFileSync(join(wasmSrc, file), join(wasmDest, file));
  }
  console.log("[fetch-assets] 已复制 wasm 运行时 → public/wasm");
}

async function downloadModel() {
  if (existsSync(modelPath)) {
    console.log("[fetch-assets] 模型已存在，跳过下载。");
    return;
  }
  mkdirSync(modelDir, { recursive: true });
  console.log("[fetch-assets] 正在下载手部模型 (~8MB)...");
  const response = await fetch(modelUrl);
  if (!response.ok) {
    throw new Error(`下载模型失败：HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(modelPath, buffer);
  console.log("[fetch-assets] 已保存模型 → public/models/hand_landmarker.task");
}

copyWasm();
try {
  await downloadModel();
} catch (error) {
  // Don't fail npm install on a network hiccup — warn and let the user retry.
  console.warn(
    `[fetch-assets] 模型下载失败：${error.message}\n` +
      "请联网后运行 `npm run fetch-assets` 重新下载。"
  );
}
console.log("[fetch-assets] 完成。");
