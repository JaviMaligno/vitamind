// Generate PNG icons from an SVG template using Node.js canvas-free approach.
// We create minimal valid PNGs with a sun-like design encoded directly.
// For production, replace these with proper designed icons.

const fs = require("fs");
const path = require("path");

// Create a simple SVG sun icon
function createSunSVG(size) {
  const c = size / 2;
  const r = size * 0.22;
  const rayLen = size * 0.14;
  const rayStart = r + size * 0.04;
  const rays = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i * 30 * Math.PI) / 180;
    const x1 = c + Math.cos(angle) * rayStart;
    const y1 = c + Math.sin(angle) * rayStart;
    const x2 = c + Math.cos(angle) * (rayStart + rayLen);
    const y2 = c + Math.sin(angle) * (rayStart + rayLen);
    rays.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#FFD54F" stroke-width="${size * 0.03}" stroke-linecap="round"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.18}" fill="#1a237e"/>
  ${rays.join("\n  ")}
  <circle cx="${c}" cy="${c}" r="${r}" fill="#FFD54F"/>
  <text x="${c}" y="${c + size * 0.04}" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="${size * 0.11}" fill="#1a237e">D</text>
</svg>`;
}

function createMaskableSVG(size) {
  const c = size / 2;
  const r = size * 0.18;
  const rayLen = size * 0.11;
  const rayStart = r + size * 0.03;
  const rays = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i * 30 * Math.PI) / 180;
    const x1 = c + Math.cos(angle) * rayStart;
    const y1 = c + Math.sin(angle) * rayStart;
    const x2 = c + Math.cos(angle) * (rayStart + rayLen);
    const y2 = c + Math.sin(angle) * (rayStart + rayLen);
    rays.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#FFD54F" stroke-width="${size * 0.025}" stroke-linecap="round"/>`);
  }

  // Maskable icons need content within the safe zone (inner 80%)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#1a237e"/>
  ${rays.join("\n  ")}
  <circle cx="${c}" cy="${c}" r="${r}" fill="#FFD54F"/>
  <text x="${c}" y="${c + size * 0.032}" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="${size * 0.09}" fill="#1a237e">D</text>
</svg>`;
}

const outDir = path.join(__dirname, "..", "public", "icons");

// Write SVG versions (we'll convert to PNG if needed, but SVGs work as fallback)
const sizes = [192, 512];
for (const size of sizes) {
  const svg = createSunSVG(size);
  fs.writeFileSync(path.join(outDir, `icon-${size}.svg`), svg);
  console.log(`Created icon-${size}.svg`);
}

const maskableSvg = createMaskableSVG(512);
fs.writeFileSync(path.join(outDir, "icon-maskable-512.svg"), maskableSvg);
console.log("Created icon-maskable-512.svg");

// Also create a favicon.svg
const faviconSvg = createSunSVG(32);
fs.writeFileSync(path.join(outDir, "..", "favicon.svg"), faviconSvg);
console.log("Created favicon.svg");

console.log("\nNote: For production PNGs, convert SVGs using: npx svgexport icon-512.svg icon-512.png 512:512");
console.log("For now, update manifest.json to use SVG icons or install sharp for PNG conversion.");
