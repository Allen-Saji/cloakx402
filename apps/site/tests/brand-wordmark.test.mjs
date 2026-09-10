import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const components = ["Nav.tsx", "Footer.tsx"];

for (const component of components) {
  test(`${component} renders the cloakx402 wordmark`, async () => {
    const source = await readFile(
      new URL(`../components/${component}`, import.meta.url),
      "utf8",
    );

    assert.match(source, /cloakx<span className="text-ember">402<\/span>/);
    assert.doesNotMatch(source, /cloak<span className="text-ember">402<\/span>/);
  });
}
