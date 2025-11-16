import { Hsluv } from "./hlsuv.js"
/**
 * Generates N perceptually uniform, distinct colors using HSLuv.
 * Requires the HSLuv.js library.
 * @param {number} count - The number of colors to generate.
 * @returns {string[]} - An array of hex color codes.
 */
export function generateHsluvColors(count = 100) {
  const hsluv = new Hsluv()

  const colors = [];
  const goldenRatio = 0.618033988749895;
  let hue = Math.random() * 360; // HSLuv hue is 0-360
  hue = 123

  // Define tiers of HSLuv saturation and lightness
  // [saturation, lightness]
  const tiers = [
    [100, 50], // Tier 1: Vivid
    [70, 75],  // Tier 2: Pastel
    [100, 30], // Tier 3: Dark
  ];

  for (let i = 0; i < count; i++) {
    // Advance the hue (0-360) using the golden ratio
    hue = (hue + (goldenRatio * 360)) % 360;

    // Pick a tier
    const [saturation, lightness] = tiers[i % tiers.length];

    // HSLuv library does the magic conversion to a hex code
    hsluv.hsluv_h = hue
    hsluv.hsluv_s = saturation
    hsluv.hsluv_l = lightness
    hsluv.hsluvToHex()
    colors.push(hsluv.hex)
  }

  return colors;
}

// --- How to use it (after loading the library) ---
// const my100Colors = generateHsluvColors(100);
// console.log(my100Colors);
