// Deterministic color palette generator so every site/department gets a stable,
// visually distinct color for the dashboard color-coding requirement.
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function paletteFor(count, opts = {}) {
  const { saturation = 65, lightness = 50 } = opts;
  const colors = [];
  for (let i = 0; i < count; i++) {
    const hue = Math.round((360 / count) * i);
    colors.push(hslToHex(hue, saturation, lightness));
  }
  return colors;
}

module.exports = { paletteFor };
