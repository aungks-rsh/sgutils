import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = resolve(__dirname, "og-image.svg");
const outPath = resolve(__dirname, "..", "public", "og.png");

const svg = readFileSync(svgPath, "utf-8");
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 1200 },
  font: {
    loadSystemFonts: true,
    defaultFontFamily: "Helvetica",
  },
});
const png = resvg.render().asPng();
writeFileSync(outPath, png);

console.log(`wrote ${outPath} (${png.length.toLocaleString()} bytes)`);
