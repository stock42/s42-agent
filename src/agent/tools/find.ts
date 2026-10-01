import { basename, relative, resolve } from "node:path";
import { definition, files, positiveInteger, string, type NativeTool } from "./shared.ts";

export interface FileMatch { path: string; name: string }
export async function findFiles(folder: string, pattern: string, signal: AbortSignal,
  options: { limit?: number; includeIgnored?: boolean; onProgress?: (matches: FileMatch[], scanned: number) => void } = {}) {
  if (!pattern.trim()) throw new Error("Escribí un nombre o glob para buscar");
  const glob = /[*?{\[]/.test(pattern) ? new Bun.Glob(pattern) : undefined;
  const matches: FileMatch[] = [], limit = options.limit ?? 200;
  let scanned = 0, skipped = 0, last = performance.now(), truncated = false;
  for await (const path of files(folder, signal, { includeIgnored: options.includeIgnored, onSkip: () => skipped++ })) {
    scanned++; const name = relative(folder, path).split("\\").join("/");
    if (glob ? glob.match(name) || glob.match(basename(path)) : basename(path).toLocaleLowerCase().includes(pattern.toLocaleLowerCase())) matches.push({ path, name });
    if (matches.length >= limit) { truncated = true; break; }
    if (performance.now() - last >= 100) { options.onProgress?.(matches, scanned); last = performance.now(); await Bun.sleep(0); }
  }
  signal.throwIfAborted(); return { matches, scanned, skipped, truncated };
}
export const find: NativeTool = {
  definition: definition("find", "Find files recursively by case-insensitive name substring or Bun glob. path can be any directory on disk. Does not follow symlinks; skips .git/node_modules/dist/out unless includeIgnored=true.",
    { pattern: string, path: string, limit: positiveInteger, includeIgnored: { type: "boolean" } }, ["pattern"]),
  fileInstructions: true,
  async run(args, { cwd, signal }) {
    const folder = resolve(cwd, String(args.path ?? ".")), result = await findFiles(folder, String(args.pattern), signal, { limit: Math.min(1000, Number(args.limit ?? 200)), includeIgnored: args.includeIgnored === true });
    return { output: `${result.matches.map(m => m.path).join("\n")}\n[${result.matches.length} archivos; ${result.scanned} revisados; ${result.skipped} carpetas inaccesibles${result.truncated ? "; límite de resultados alcanzado" : ""}]`, failed: false, truncated: result.truncated };
  },
};
