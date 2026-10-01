import { expect, test } from "bun:test";
import { highlight, syntaxLanguage } from "../src/ui/syntax.ts";
import { theme } from "../src/ui/theme.ts";

test("resaltado conserva código incompleto/Unicode y diferencia comentarios, strings, keywords y números", () => {
  for (const [path, language] of [["web.HTML", "html"], ["site.css", "css"], ["module.mjs", "javascript"], ["types.ts", "typescript"], ["index.tsx", "typescript"]] as const)
    expect(syntaxLanguage(path)).toBe(language);
  const source = "// const falso = 22\r\nexport const saludo: string = 'hola á文🙂';\nconst total = 42; /* comentario\nmultilínea */\nconst pendiente = `sin cerrar ${nombre}";
  const parts = highlight(source, "typescript");
  expect(parts.map(p => p.text).join("")).toBe(source);
  expect(parts.find(p => p.text.startsWith("//"))!.style).toBe(theme.syntaxComment);
  expect(parts.find(p => p.text === "export")!.style).toBe(theme.syntaxKeyword);
  expect(parts.find(p => p.text === "'hola á文🙂'")!.style).toBe(theme.syntaxString);
  expect(parts.find(p => p.text === "42")!.style).toBe(theme.syntaxNumber);
  expect(parts.find(p => p.text.startsWith("/*"))!.style).toBe(theme.syntaxComment);
  expect(parts.find(p => p.text.startsWith("`"))!.style).toBe(theme.syntaxString);
  expect(highlight(source, syntaxLanguage("notes.txt"))).toEqual([{ text: source }]);
});

test("HTML mezcla atributos, comentarios, CSS y JavaScript sin ejecutar ni alterar el archivo", () => {
  const source = '<!DOCTYPE html>\n<!-- <script>ignore()</script> -->\n<div title="a > b">á文🙂</div>\n<style>/* color */ body { color: #ff0055; margin: 12px; --tone: "green"; }</style>\n<script>const message = "<div>"; globalThis.noEjecutar = 99;</script>\n<p title="incompleto';
  const parts = highlight(source, "html");
  expect(parts.map(p => p.text).join("")).toBe(source);
  expect(parts.find(p => p.text === "title")!.style).toBe(theme.syntaxAttribute);
  expect(parts.find(p => p.text === '"a > b"')!.style).toBe(theme.syntaxString);
  expect(parts.find(p => p.text === "color")!.style).toBe(theme.syntaxProperty);
  expect(parts.find(p => p.text === "#ff0055")!.style).toBe(theme.syntaxNumber);
  expect(parts.find(p => p.text === "12px")!.style).toBe(theme.syntaxNumber);
  expect(parts.find(p => p.text === "const")!.style).toBe(theme.syntaxKeyword);
  expect(parts.find(p => p.text === '"<div>"')!.style).toBe(theme.syntaxString);
  expect(parts.find(p => p.text.startsWith("<!--"))!.style).toBe(theme.syntaxComment);
  expect((globalThis as any).noEjecutar).toBeUndefined();
});
