export interface Style { fg: number; bg: number }

// DOS colors in ANSI index order; keep sixteen-color fallback for older terminals.
export const dosColors = [
  "0;0;0", "170;0;0", "0;170;0", "170;85;0", "0;0;170", "170;0;170", "0;170;170", "170;170;170",
  "85;85;85", "255;85;85", "85;255;85", "255;255;85", "85;85;255", "255;85;255", "85;255;255", "255;255;255",
] as const;

export const theme = {
  desktop: { fg: 7, bg: 4 },
  window: { fg: 7, bg: 4 },
  chatUser: { fg: 11, bg: 4 },
  chatAgent: { fg: 14, bg: 4 },
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

export type PaletteId = "qbasic" | "grayscale" | "green" | "nord" | "dracula" | "gruvbox";

interface Palette {
  label: string;
  colors: readonly string[];
  ansi: readonly number[];
  styles: ReadonlyMap<Style, Style>;
}

// Keep component styles and monochrome state detection intact. Dark palettes
// use separate surfaces instead of reusing body text as the menu background.
const darkStyles: ReadonlyMap<Style, Style> = new Map([
  [theme.desktop, { fg: 7, bg: 0 }],
  [theme.window, { fg: 7, bg: 4 }],
  [theme.chatUser, { fg: 11, bg: 4 }],
  [theme.chatAgent, { fg: 14, bg: 4 }],
  [theme.frameActive, { fg: 6, bg: 4 }],
  [theme.frameInactive, { fg: 12, bg: 4 }],
  [theme.dialog, { fg: 7, bg: 8 }],
  [theme.title, { fg: 6, bg: 8 }],
  [theme.inactiveTitle, { fg: 12, bg: 8 }],
  [theme.menu, { fg: 7, bg: 8 }],
  [theme.menuHotkey, { fg: 6, bg: 8 }],
  [theme.selectedHotkey, { fg: 0, bg: 6 }],
  [theme.menuSelection, { fg: 0, bg: 6 }],
  [theme.footer, { fg: 7, bg: 8 }],
  [theme.selected, { fg: 0, bg: 6 }],
  [theme.button, { fg: 7, bg: 8 }],
  [theme.focused, { fg: 0, bg: 6 }],
  [theme.disabled, { fg: 12, bg: 8 }],
  [theme.shadow, { fg: 0, bg: 0 }],
]);
const rgb = (...hex: string[]) => hex.map(color => [0, 2, 4].map(start => parseInt(color.slice(start, start + 2), 16)).join(";"));

// Nord / Dracula / Gruvbox colors follow their official palettes, adapted to
// our DOS-style components. ANSI16 is an approximation, never an RGB claim.
export const palettes = {
  qbasic: {
    label: "Clásica · QBasic",
    colors: dosColors,
    ansi: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    styles: new Map<Style, Style>(),
  },
  grayscale: {
    label: "Dark · Grafito",
    colors: rgb(
      "101010", "606060", "707070", "808080", "1b1b1b", "909090", "c0c0c0", "d0d0d0",
      "303030", "989898", "a8a8a8", "b8b8b8", "a0a0a0", "d8d8d8", "e0e0e0", "eeeeee",
    ),
    ansi: [0, 8, 8, 8, 0, 8, 7, 7, 0, 7, 7, 7, 7, 15, 15, 15],
    styles: darkStyles,
  },
  green: {
    label: "Green · Bosque",
    colors: rgb(
      "08120d", "294c36", "3a6348", "517858", "101e17", "62886c", "89d6a3", "c4dfcd",
      "1c3428", "71a580", "8bbf97", "a7d4b0", "92b69e", "b8dec0", "d2ebd7", "e5f3e9",
    ),
    ansi: [0, 2, 2, 2, 0, 2, 10, 10, 0, 10, 10, 10, 2, 10, 10, 10],
    styles: new Map([...darkStyles, [theme.chatUser, { fg: 12, bg: 4 }]]),
  },
  nord: {
    label: "Nord · Ártico",
    colors: rgb(
      "2e3440", "bf616a", "a3be8c", "ebcb8b", "2e3440", "b48ead", "88c0d0", "d8dee9",
      "3b4252", "bf616a", "a3be8c", "ebcb8b", "81a1c1", "b48ead", "8fbcbb", "eceff4",
    ),
    ansi: [0, 1, 2, 3, 0, 5, 14, 7, 0, 9, 10, 11, 7, 13, 14, 15],
    styles: darkStyles,
  },
  dracula: {
    label: "Dracula · Violeta",
    colors: rgb(
      "282a36", "ff5555", "50fa7b", "f1fa8c", "282a36", "bd93f9", "bd93f9", "f8f8f2",
      "44475a", "ff5555", "50fa7b", "ffb86c", "9da6c9", "ff79c6", "8be9fd", "f8f8f2",
    ),
    ansi: [0, 1, 2, 3, 0, 5, 13, 15, 0, 9, 10, 11, 7, 13, 14, 15],
    styles: new Map([...darkStyles,
      [theme.title, { fg: 14, bg: 8 }],
      [theme.menuHotkey, { fg: 14, bg: 8 }],
    ]),
  },
  gruvbox: {
    label: "Gruvbox · Retro cálido",
    colors: rgb(
      "1d2021", "cc241d", "98971a", "d79921", "282828", "b16286", "fabd2f", "ebdbb2",
      "3c3836", "fb4934", "b8bb26", "fabd2f", "a89984", "d3869b", "8ec07c", "fbf1c7",
    ),
    ansi: [0, 1, 2, 3, 0, 5, 11, 7, 0, 9, 10, 11, 7, 13, 14, 15],
    styles: darkStyles,
  },
} satisfies Record<PaletteId, Palette>;
