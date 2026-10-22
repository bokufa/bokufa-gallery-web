import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import ts from "typescript";

const url = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const source = ts.transpileModule(
  await readFile(new URL("../src/utils/mapbox.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;
const { applyLocalMapLabels, localMapLabelExpression } = await import(url(source));

test("Mapbox endonym labels preserve formatting, shields, and script information", () => {
  const original = [
    "format",
    ["coalesce", ["get", "name_zh-Hans"], ["get", "name_en"], ["get", "name"]],
    { "font-scale": 1.1 },
    "\n",
    {},
    ["get", "ref"],
    {},
  ];
  const local = localMapLabelExpression(original);
  assert.deepEqual(local, [
    "format",
    ["coalesce", ["get", "name"], ["get", "name"], ["get", "name"]],
    { "font-scale": 1.1 },
    "\n",
    {},
    ["get", "ref"],
    {},
  ]);
  assert.equal(original[1][1][1], "name_zh-Hans", "style input is not mutated");
  assert.deepEqual(localMapLabelExpression(["get", "name_script"]), ["get", "name_script"]);
  assert.equal(localMapLabelExpression("{name_en} · {ref}"), "{name} · {ref}");
});

test("all symbol layers can use source endonyms without touching non-name labels", () => {
  const fields = new Map([
    ["place-label-large", ["get", "name_en"]],
    ["road-shield", ["get", "ref"]],
    ["local-label", ["get", "name"]],
  ]);
  const calls = [];
  const map = {
    getStyle: () => ({
      layers: [...fields.keys()]
        .map((id) => ({ id, type: "symbol" }))
        .concat({ id: "land", type: "fill" }),
    }),
    getLayoutProperty: (id) => fields.get(id),
    setLayoutProperty: (id, _field, expression) => {
      calls.push(id);
      fields.set(id, expression);
    },
  };

  applyLocalMapLabels(map);
  assert.deepEqual(calls, ["place-label-large"]);
  assert.deepEqual(fields.get("road-shield"), ["get", "ref"]);
  applyLocalMapLabels(map);
  assert.equal(calls.length, 1);
});
