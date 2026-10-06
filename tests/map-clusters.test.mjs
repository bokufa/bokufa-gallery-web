import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/components/clusterMapCore.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText.replace('"react"', JSON.stringify(import.meta.resolve("react")));
const { createClusterController } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const item = (id, datetime) => ({
  id, datetime,
  coordinate: { longitude: 139.7, latitude: 35.7 },
  thumb_file: { url: `photo-${id}.webp`, width: 512, height: 344 },
  clustering_identifier: `photo:${id}`,
});

function withController(run) {
  const previousWindow = globalThis.window;
  globalThis.window = { setTimeout, clearTimeout, setInterval, clearInterval };
  const created = [];
  const controller = createClusterController({
    zoom256: () => 7,
    view: () => null,
    create: (cluster) => { created.push(cluster); return cluster; },
    add: () => {}, remove: () => {}, element: () => null,
  });
  try { run(controller, created); }
  finally { controller.dispose(); globalThis.window = previousWindow; }
}

test("stack cover is the latest capture, not the last upload or input order", () => {
  const photos = [
    item(500, "2025-01-01T00:00:00Z"),
    item(2, "2026-10-01T00:00:00Z"),
    item(100, "2026-03-01T00:00:00Z"),
  ];
  for (const order of [photos, [...photos].reverse()]) withController((controller, created) => {
    controller.setItems(order);
    assert.equal(created.length, 1);
    assert.deepEqual(created[0].members.map((photo) => photo.id), [2, 100, 500]);
    assert.equal(created[0].members[0].thumb_file.url, "photo-2.webp");
    controller.setItems([...order].reverse());
    assert.equal(created.length, 1, "unchanged stack should retain its annotation");
  });
});

test("capture order compares instants across timezone offsets", () => withController((controller, created) => {
  controller.setItems([
    item(10, "2026-10-01T11:00:00+09:00"),
    item(5, "2026-10-01T03:00:00Z"),
  ]);
  assert.equal(created[0].members[0].id, 5);
}));

test("equal timestamps and missing dates use stable descending ID tie breakers", () => withController((controller, created) => {
  controller.setItems([
    item(4, "2026-10-01T00:00:00Z"), item(9, "2026-10-01T00:00:00Z"),
    item(200, undefined), item(300, "invalid"),
  ]);
  assert.deepEqual(created[0].members.map((photo) => photo.id), [9, 4, 300, 200]);
}));
