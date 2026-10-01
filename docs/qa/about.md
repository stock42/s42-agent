# QA — About

2026-10-01. Linux x64, Bun 1.4.2. Entry point index.ts desde fuente.
Config, proyecto y sesiones temporales; configuración personal conservada.

- `bun run typecheck`: correcto.
- `bun test tests/extensions.test.ts tests/ui.test.ts tests/language-reasoning.test.ts tests/workspace.test.ts tests/palettes.test.ts`:
  36 pass / 0 fail, 5 archivos, 725 assertions.
- About se abre por Ayuda y muestra la versión de package.json, autoría y MIT.
  Texto de solo lectura: Backspace y pegado no lo modifican.
- Resize 60×16 → 100×30 conserva contenido y agranda el modal dentro del editor;
  el prompt mantiene su borrador visible. Ctrl+Home/End y PgDn permiten recorrerlo.
  Enter/Escape cierran; los botones conservan traducción y comportamiento existentes.
- Español e inglés incluyen capacidades, QBasic, portabilidad y LinkedIn.
  El enlace se confirmó en el código del sitio del autor, cesarcasas.com.

[Siete capturas del terminal](about-captures.txt): index.ts en tmux, apertura desde
el menú mediante mouse SGR inyectado, scroll por teclado, 120×40/100×30/60×16,
cambio a inglés y reapertura con `--no-color`. PNG renderizados del ANSI para
inspección visual local de la vista española completa, compacto, inglés y sin
color. El título, versión y cierre quedan visibles mientras se desplaza el texto;
el modal nunca cubre el prompt.

La portabilidad descrita corresponde a binarios independientes por target,
respaldados por [Bun](https://bun.sh/docs/bundler/executables) y el script de targets
del repositorio. Esta tarea no hizo builds ni validación de runtime en otros SO.
El servidor LLM/modelos y las herramientas externas siguen siendo independientes.
No es una prueba de mouse físico. Sin inferencia ni publicación.

Git pull falló por main sin upstream. Se preservan los cambios previos en
docs/qa/final-validation.md y CLAUDE.md fuera del commit de esta tarea.
