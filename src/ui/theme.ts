export interface Style { fg: number; bg: number }

// ANSI's sixteen colors keep the classic palette usable without truecolor.
export const theme = {
  desktop: { fg: 7, bg: 4 },
  window: { fg: 15, bg: 4 },
  dialog: { fg: 0, bg: 7 },
  title: { fg: 0, bg: 7 },
  inactiveTitle: { fg: 8, bg: 7 },
  menu: { fg: 0, bg: 7 },
  menuHotkey: { fg: 4, bg: 7 },
  selectedHotkey: { fg: 4, bg: 6 },
  selected: { fg: 0, bg: 6 },
  button: { fg: 0, bg: 7 },
  focused: { fg: 15, bg: 0 },
  disabled: { fg: 8, bg: 7 },
  shadow: { fg: 0, bg: 0 },
} satisfies Record<string, Style>;
