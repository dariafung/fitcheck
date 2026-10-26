// Fixed color families. extractItem picks one per item (the original color
// name is kept as free text); the closet swatch and the pairing color rules
// read only the family. Shared by every lane: change it in one place.
export const COLOR_FAMILIES = [
  "black",
  "white",
  "gray",
  "cream",
  "brown",
  "navy",
  "denim",
  "blue",
  "green",
  "red",
  "pink",
  "orange",
  "yellow",
  "purple",
  "multi",
] as const;

export type ColorFamily = (typeof COLOR_FAMILIES)[number];

// Swatch colors used when an item has no photo.
export const COLOR_FAMILY_HEX: Record<ColorFamily, string> = {
  black: "#1f1f1f",
  white: "#f7f7f5",
  gray: "#9a9a9a",
  cream: "#e8dcc4",
  brown: "#8b6248",
  navy: "#1f2f4f",
  denim: "#3d5a80",
  blue: "#4a7fc1",
  green: "#6f9a6a",
  red: "#c0392b",
  pink: "#e8a0b4",
  orange: "#e0823d",
  yellow: "#e8c547",
  purple: "#7d5ba6",
  multi: "#c8c8c8",
};

// Neutral families go with anything in the pairing color rules.
export const NEUTRAL_COLOR_FAMILIES: readonly ColorFamily[] = [
  "black",
  "white",
  "gray",
  "cream",
  "brown",
  "navy",
  "denim",
];
