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
