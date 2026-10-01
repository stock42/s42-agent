// Only named placeholders are substituted; JSON and other braces remain literal.
const placeholder = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

export function promptVariables(text: string): string[] {
  return [...new Set([...text.matchAll(placeholder)].map(match => match[1]!))];
}

export function renderPrompting(text: string, values: ReadonlyMap<string, string>): string {
  return text.replace(placeholder, (_, name: string) => {
    if (!values.has(name)) throw new Error(`Falta el valor de {{${name}}}`);
    return values.get(name)!;
  });
}
