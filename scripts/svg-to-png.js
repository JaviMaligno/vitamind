const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const iconsDir = path.join(__dirname, "..", "public", "icons");

async function convert(svgFile, pngFile, size) {
  const svg = fs.readFileSync(path.join(iconsDir, svgFile));
  await sharp(svg).resize(size, size).png().toFile(path.join(iconsDir, pngFile));
  console.log(`${svgFile} -> ${pngFile} (${size}x${size})`);
}

async function main() {
  await convert("icon-192.svg", "icon-192.png", 192);
  await convert("icon-512.svg", "icon-512.png", 512);
  await convert("icon-maskable-512.svg", "icon-maskable-512.png", 512);

  // Apple touch icon (180x180)
  const svg = fs.readFileSync(path.join(iconsDir, "icon-512.svg"));
  await sharp(svg).resize(180, 180).png().toFile(path.join(iconsDir, "apple-touch-icon.png"));
  console.log("icon-512.svg -> apple-touch-icon.png (180x180)");
}

main().catch(console.error);
