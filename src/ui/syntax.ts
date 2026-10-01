import { extname } from "node:path";
import type { TextFragment } from "./components/text-area.ts";
import { theme, type Style } from "./theme.ts";

export type SyntaxLanguage = "html" | "css" | "javascript" | "typescript";
export function syntaxLanguage(path: string): SyntaxLanguage | undefined {
  const extension = extname(path).toLowerCase();
  if ([".html", ".htm"].includes(extension)) return "html";
  if (extension === ".css") return "css";
  if ([".js", ".jsx", ".mjs", ".cjs"].includes(extension)) return "javascript";
  if ([".ts", ".tsx", ".mts", ".cts"].includes(extension)) return "typescript";
}

const keywords = new Set(("as async await break case catch class const continue debugger default delete do else export extends false finally for from function get if implements import in instanceof interface keyof let new null of private protected public readonly return satisfies set static super switch this throw true try type typeof undefined var void while with yield abstract declare enum namespace never number string boolean unknown any infer is constructor override").split(" "));

// A tolerant lexical highlighter: preserve source verbatim, including incomplete code.
// No transpilation, execution or HTML rendering takes place.
export function highlight(text: string, language?: SyntaxLanguage): TextFragment[] {
  if (!language) return [{ text }];
  const fragments: TextFragment[] = [];
  const add = (value: string, style?: Style) => {
    if (!value) return;
    const previous = fragments.at(-1);
    if (previous && previous.style === style) previous.text += value; else fragments.push({ text: value, style });
  };
  function code(source: string, css = false) {
    const property = /\s*:/y;
    const tokens = css
      ? /\/\*[\s\S]*?(?:\*\/|$)|"(?:\\[\s\S]|[^"\\])*"?|'(?:\\[\s\S]|[^'\\])*'?|#[\da-fA-F]{3,8}\b|(?:\b\d+(?:\.\d+)?|\.\d+)(?:[a-zA-Z%]+)?|(?:--)?[a-zA-Z_$][\w$-]*/g
      : /\/\/[^\r\n]*|\/\*[\s\S]*?(?:\*\/|$)|"(?:\\[\s\S]|[^"\\])*"?|'(?:\\[\s\S]|[^'\\])*'?|`(?:\\[\s\S]|[^`\\])*`?|\b(?:0[xX][\da-fA-F]+|0[bB][01]+|0[oO][0-7]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?n?)\b|[a-zA-Z_$][\w$]*/g;
    let offset = 0;
    for (const token of source.matchAll(tokens)) {
      const value = token[0], index = token.index;
      add(source.slice(offset, index));
      let style: Style | undefined;
      if (value.startsWith("/*") || !css && value.startsWith("//")) style = theme.syntaxComment;
      else if (["\"", "'", "`"].includes(value[0]!)) style = theme.syntaxString;
      else if (/^[\d.#]/.test(value)) style = theme.syntaxNumber;
      else if (!css && keywords.has(value) || css && value.startsWith("--")) style = theme.syntaxKeyword;
      else { property.lastIndex = index + value.length; if (property.test(source)) style = theme.syntaxProperty; }
      add(value, style); offset = index + value.length;
    }
    add(source.slice(offset));
  }
  if (language !== "html") { code(text, language === "css"); return fragments; }

  let offset = 0;
  while (offset < text.length) {
    const start = text.indexOf("<", offset);
    if (start < 0) { add(text.slice(offset)); break; }
    add(text.slice(offset, start));
    if (text.startsWith("<!--", start)) {
      const close = text.indexOf("-->", start + 4), end = close < 0 ? text.length : close + 3;
      add(text.slice(start, end), theme.syntaxComment); offset = end; continue;
    }
    const tag = /^<\/?([a-zA-Z][\w:-]*)|^<![a-zA-Z]+/.exec(text.slice(start));
    if (!tag) { add("<"); offset = start + 1; continue; }
    const bodyStart = start + tag[0].length;
    let end = bodyStart, quote = "";
    for (; end < text.length; end++) {
      const char = text[end]!;
      if (quote) { if (char === quote) quote = ""; }
      else if (char === "\"" || char === "'") quote = char;
      else if (char === ">") { end++; break; }
    }
    add(tag[0], theme.syntaxTag);
    const body = text.slice(bodyStart, end), attributes = /"[^"]*"?|'[^']*'?|[\w:-]+(?=\s*=)|\/?>/g;
    let position = 0;
    for (const token of body.matchAll(attributes)) {
      add(body.slice(position, token.index));
      add(token[0], token[0].startsWith("\"") || token[0].startsWith("'") ? theme.syntaxString : /[>]/.test(token[0]) ? theme.syntaxTag : theme.syntaxAttribute);
      position = token.index + token[0].length;
    }
    add(body.slice(position)); offset = end;
    const name = tag[1]?.toLowerCase();
    if (!tag[0].startsWith("</") && (name === "style" || name === "script") && !body.endsWith("/>")) {
      const close = new RegExp(`</${name}\\s*>`, "ig"); close.lastIndex = offset;
      const match = close.exec(text), stop = match?.index ?? text.length;
      code(text.slice(offset, stop), name === "style"); offset = stop;
    }
  }
  return fragments;
}
