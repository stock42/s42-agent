---
name: create-pdf
description: Create a PDF from Markdown or HTML using native Bun conversion and an installed PDF renderer, with explicit layout and output validation.
---
# Create a PDF

Use when the user requests a PDF artifact. Bun converts Markdown to HTML natively, but does not provide an HTML-to-PDF printing API. Loading this skill does not install or execute a renderer.

1. Read the requested content, audience, destination and page requirements. Preserve supplied figures and text; do not invent images, taxes, terms or business facts. Choose simple typography and printable page margins.
2. Use markdown_html with markdown or a source path, outputPath and standalone=true to save UTF-8 HTML. For custom layout, use write/edit to add print CSS: @page size/margins, readable headings/tables, page-break rules and local assets. Resolve asset paths relative to the HTML file, not the process cwd.
3. Discover an installed Chrome/Chromium or the project's existing PDF renderer using shell. Do not assume a program exists, silently install one or report HTML as a finished PDF. If none is available, preserve the HTML and report the renderer as a blocker.
4. For Chrome/Chromium, use an argument array via Bun.spawn (through shell running a Bun script): browser, --headless, --disable-gpu, --no-pdf-header-footer, --print-to-pdf=<absolute PDF path>, <file URL>. Use node:url pathToFileURL and node:path resolve, both included in Bun, for spaces and platform paths. Await the exit code and capture errors. Preserve the browser's normal sandbox settings.
5. Verify the PDF exists, has nonzero size and starts with %PDF-. If installed, use pdfinfo/pdftotext for page count/content and a page renderer for layout inspection. Inspect all pages for clipping, missing glyphs/assets and broken tables with an available visual tool. If visual inspection is unavailable, explicitly report that limitation instead of claiming the layout was reviewed.
6. Deliver the PDF's actual path plus any meaningful validation limits. Keep the HTML source so the document can be revised.

Completion: an actual PDF was produced and checked, with rendering/visual evidence distinguished. A successful Markdown conversion alone is an intermediate artifact.
