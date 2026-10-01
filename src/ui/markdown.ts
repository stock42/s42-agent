export function markdownText(text: string): string {
  return Bun.markdown.render(text, {
    heading: (children, { level }) => `${"#".repeat(level)} ${children}\n\n`, paragraph: children => children + "\n\n",
    strong: children => children, emphasis: children => children,
    code: (children, meta) => `── ${meta?.language ?? "código"} ──\n${children}\n────────\n\n`, codespan: children => children,
    listItem: (children, meta) => `${"  ".repeat(meta.depth)}${meta.ordered ? (meta.start ?? 1) + meta.index + "." : "•"} ${children.trimEnd()}\n`,
    list: children => children + "\n", link: (children, { href }) => `${children} (${href})`,
    blockquote: children => children.split("\n").map(line => "> " + line).join("\n"), hr: () => "────────\n",
    html: children => children, image: (children, { src }) => `${children} (${src})`,
    table: children => children + "\n", tr: children => children + "\n", th: children => children + " | ", td: children => children + " | ",
  }).trimEnd();
}
