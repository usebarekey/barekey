import seedrandom from "seedrandom";

const TAILWIND_COLORFUL_STOPS = [
  "#fb7185", // rose-400
  "#f97316", // orange-500
  "#f59e0b", // amber-500
  "#eab308", // yellow-500
  "#84cc16", // lime-500
  "#22c55e", // green-500
  "#10b981", // emerald-500
  "#14b8a6", // teal-500
  "#06b6d4", // cyan-500
  "#0ea5e9", // sky-500
  "#3b82f6", // blue-500
  "#6366f1", // indigo-500
  "#8b5cf6", // violet-500
  "#a855f7", // purple-500
  "#d946ef", // fuchsia-500
  "#ec4899", // pink-500
] as const;

type GradientSeed = string | number;

type GenerateGradientOptions = {
  size?: number;
};

function pickUniqueColors(seed: GradientSeed, count: number): Array<string> {
  const random = seedrandom(String(seed));
  const chosenIndexes = new Set<number>();

  while (chosenIndexes.size < count) {
    const nextIndex = Math.floor(random() * TAILWIND_COLORFUL_STOPS.length);
    chosenIndexes.add(nextIndex);
  }

  return Array.from(chosenIndexes, (index) => TAILWIND_COLORFUL_STOPS[index]);
}

function encodeSvgAsDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function generateGradientSvg(seed: GradientSeed, options: GenerateGradientOptions = {}): string {
  const size = options.size ?? 128;
  const [colorA, colorB, colorC, accent] = pickUniqueColors(seed, 4);
  const random = seedrandom(`${seed}:layout`);

  const glowX = Math.round(20 + random() * 60);
  const glowY = Math.round(20 + random() * 60);
  const glowRadius = Math.round(35 + random() * 20);
  const ringOpacity = (0.12 + random() * 0.14).toFixed(3);
  const accentOpacity = (0.18 + random() * 0.18).toFixed(3);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">`,
    "<defs>",
    '<linearGradient id="bg" x1="0%" y1="100%" x2="100%" y2="0%">',
    `<stop offset="0%" stop-color="${colorA}" />`,
    `<stop offset="52%" stop-color="${colorB}" />`,
    `<stop offset="100%" stop-color="${colorC}" />`,
    "</linearGradient>",
    `<radialGradient id="glow" cx="${glowX}%" cy="${glowY}%" r="${glowRadius}%">`,
    `<stop offset="0%" stop-color="${accent}" stop-opacity="${accentOpacity}" />`,
    '<stop offset="100%" stop-color="#ffffff" stop-opacity="0" />',
    "</radialGradient>",
    "</defs>",
    `<rect width="${size}" height="${size}" fill="url(#bg)" />`,
    `<rect width="${size}" height="${size}" fill="url(#glow)" />`,
    `<circle cx="${Math.round(size * 0.22)}" cy="${Math.round(size * 0.78)}" r="${Math.round(
      size * 0.24,
    )}" fill="#ffffff" fill-opacity="${ringOpacity}" />`,
    `<circle cx="${Math.round(size * 0.8)}" cy="${Math.round(size * 0.2)}" r="${Math.round(
      size * 0.2,
    )}" fill="#ffffff" fill-opacity="${(Number(ringOpacity) * 0.75).toFixed(3)}" />`,
    "</svg>",
  ].join("");
}

export function generateGradientDataUrl(
  seed: GradientSeed,
  options: GenerateGradientOptions = {},
): string {
  return encodeSvgAsDataUrl(generateGradientSvg(seed, options));
}

export function generateGradientBytes(
  seed: GradientSeed,
  options: GenerateGradientOptions = {},
): Uint8Array {
  const svg = generateGradientSvg(seed, options);
  return new TextEncoder().encode(svg);
}
