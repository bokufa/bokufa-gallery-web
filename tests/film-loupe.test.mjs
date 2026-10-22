import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/utils/filmLoupe.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { loupeSceneView, loupeSampleCircle, circleIntersectsRect, boundLoupePosition } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("the glass center samples the same scene point after panning and zooming", () => {
  for (const view of [{ x: 0, y: 0, scale: 1 }, { x: -420, y: 180, scale: 0.6 }, { x: 100, y: -600, scale: 3 }]) {
    for (const zoom of [1.5, 3, 6]) {
      const originalView = { ...view };
      const center = { x: 600, y: 400 };
      const radius = 132;
      const sourcePoint = { x: (center.x - view.x) / view.scale, y: (center.y - view.y) / view.scale };
      const lens = loupeSceneView(view, center.x, center.y, radius, zoom);

      assert(Math.abs(sourcePoint.x * lens.scale + lens.x - radius) < 1e-9);
      assert(Math.abs(sourcePoint.y * lens.scale + lens.y - radius) < 1e-9);
      assert.equal(lens.scale, view.scale * zoom);
      assert.deepEqual(view, originalView);
    }
  }
});

test("detail images are selected by the actual sample circle, including edge intersections", () => {
  const rect = { left: 100, top: 100, right: 200, bottom: 200 };

  assert.equal(circleIntersectsRect(150, 150, 30, rect), true);
  assert.equal(circleIntersectsRect(80, 150, 20, rect), true);
  assert.equal(circleIntersectsRect(70, 150, 20, rect), false);
  assert.equal(circleIntersectsRect(80, 80, 25, rect), false);
  assert.equal(circleIntersectsRect(80, 80, 30, rect), true);
});

test("the lens stays reachable after dragging to an edge or rotating a phone", () => {
  assert.deepEqual(boundLoupePosition(500, 350, 280, 1000, 700), { x: 500, y: 350 });
  assert.deepEqual(boundLoupePosition(-500, 900, 280, 390, 780), { x: 148, y: 632 });
  assert.deepEqual(boundLoupePosition(1000, 1000, 266, 844, 390), { x: 703, y: 249 });
});

test("cached world rectangles give the same sample as screen rectangles at every zoom", () => {
  const world = { left: 240.25, top: 150.75, right: 600.25, bottom: 510.75 };
  for (const view of [{ x: 0, y: 0, scale: 1 }, { x: -420.5, y: 180.5, scale: 0.6 }, { x: 100, y: -600, scale: 3 }]) {
    const screen = { left: world.left * view.scale + view.x, top: world.top * view.scale + view.y, right: world.right * view.scale + view.x, bottom: world.bottom * view.scale + view.y };
    for (const zoom of [1.5, 3, 6]) {
      for (const [x, y] of [[200, 300], [450, 350], [900, 500]]) {
        const circle = loupeSampleCircle(view, x, y, 132, zoom);
        assert.equal(circleIntersectsRect(circle.x, circle.y, circle.radius, world), circleIntersectsRect(x, y, 132 / zoom, screen));
      }
    }
  }
});
