export interface Style { fg: number; bg: number }

// DOS colors in ANSI index order; keep sixteen-color fallback for older terminals.
export const dosColors = [
  "0;0;0", "170;0;0", "0;170;0", "170;85;0", "0;0;170", "170;0;170", "0;170;170", "170;170;170",
  "85;85;85", "255;85;85", "85;255;85", "255;255;85", "85;85;255", "255;85;255", "85;255;255", "255;255;255",
] as const;

export const theme = {
  desktop: { fg: 7, bg: 4 },
  window: { fg: 7, bg: 4 },
  frameActive: { fg: 15, bg: 4 },
  frameInactive: { fg: 7, bg: 4 },
  dialog: { fg: 0, bg: 7 },
  title: { fg: 4, bg: 7 },
  inactiveTitle: { fg: 8, bg: 7 },
  menu: { fg: 0, bg: 7 },
  menuHotkey: { fg: 4, bg: 7 },
  selectedHotkey: { fg: 15, bg: 0 },
  menuSelection: { fg: 15, bg: 0 },
  footer: { fg: 15, bg: 6 },
  selected: { fg: 0, bg: 6 },
  button: { fg: 0, bg: 7 },
  focused: { fg: 15, bg: 0 },
  disabled: { fg: 8, bg: 7 },
  shadow: { fg: 0, bg: 0 },
} satisfies Record<string, Style>;

export type PaletteId = "qbasic" | "grayscale" | "green";

// Components keep their semantic styles; each desktop resolves its own colors.
// ANSI16 variants use only neutral/green inks even without RGB support.
export const palettes = {
  qbasic: {
    label: "Clásica · QBasic",
    colors: dosColors,
    ansi: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    footer: theme.footer,
  },
  grayscale: {
    label: "Blanco y negro · Grises",
    colors: [
      "8;8;8", "64;64;64", "80;80;80", "96;96;96", "36;36;36", "112;112;112", "170;170;170", "208;208;208",
      "102;102;102", "144;144;144", "160;160;160", "176;176;176", "192;192;192", "216;216;216", "232;232;232", "255;255;255",
    ],
    ansi: [0, 8, 8, 8, 8, 8, 7, 15, 8, 7, 7, 7, 7, 15, 15, 15],
    footer: { fg: 0, bg: 6 },
  },
  green: {
    label: "Verdes",
    colors: [
      "7;17;11", "24;52;32", "31;69;41", "41;84;49", "18;48;30", "50;96;57", "139;196;154", "195;219;195",
      "71;99;76", "85;128;92", "102;154;110", "119;175;128", "151;201;158", "178;216;177", "206;232;201", "230;244;228",
    ],
    ansi: [0, 2, 2, 2, 0, 2, 10, 10, 2, 10, 10, 10, 10, 10, 10, 10],
    footer: { fg: 0, bg: 6 },
  },
} satisfies Record<PaletteId, { label: string; colors: readonly string[]; ansi: readonly number[]; footer: Style }>;
