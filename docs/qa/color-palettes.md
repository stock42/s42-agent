# Paletas configurables de la TUI

Fecha: 2026-10-01. Fuente: `index.ts`, Bun 1.4.2, Linux x64.

## Comportamiento

- **Vista → Paleta de colores**: Clásica · QBasic, Dark · Grafito, Green · Bosque,
  Nord · Ártico, Dracula · Violeta y Gruvbox · Retro cálido. Se marca y selecciona
  la actual; flechas/j/k, Enter, botón y mouse. Las seis opciones están traducidas.
- Seleccionar guarda `ui.palette` en la configuración existente y repinta toda
  la TUI, sin reiniciar, perder borrador ni cambiar la sesión. Escape cancela.
  La apariencia también puede cambiar durante un turno del agente.
- QBasic conserva exactamente sus colores RGB/ANSI anteriores. Configuraciones
  anteriores sin `palette` usan QBasic; valores inválidos se rechazan sin
  sobrescribir el archivo.
- Dark/Green conservan IDs grayscale/green: nuevos tonos grafito/bosque, texto
  suave, menús/diálogos oscuros y selección plateada/menta. Nord/Dracula/Gruvbox
  se agregan con IDs nord/dracula/gruvbox. La configuración anterior es válida.
- Los componentes conservan roles semánticos; cada escritorio resuelve sus
  colores/superficies en el renderer. No se cambia la paleta global del emulador.
  ANSI16 aproxima los colores y conserva texto/foco distinguibles.
- `NO_COLOR`, `--no-color` y `ui.color: "never"` siguen desactivando colores;
  los atributos de selección/foco permanecen. Elegir grises es una opción distinta.

## Validación

| Comprobación | Evidencia |
| --- | --- |
| Typecheck | `bun run typecheck`, correcto. |
| Suite fuente relevante | `bun test tests/palettes.test.ts tests/ui.test.ts tests/workspace.test.ts tests/language-reasoning.test.ts tests/extensions.test.ts tests/storage.test.ts`: 41 pass / 0 fail, 6 archivos, 1018 assertions. |
| Controles y renderer | `tests/palettes.test.ts`: las cinco paletas oscuras tienen contraste RGB ≥4.5:1 en texto normal, títulos, menús, selección, botones y barra inferior; ≥3:1 en estados secundarios, excluyendo sombra. Gama gris/verde, fallback ANSI16 sin texto/fondo iguales, repintado sin resize e idle sin bytes. |
| Configuración e interacción | Migración de JSON anterior y rechazo de paleta inválida; seis IDs aceptados; selección/cancelación, teclado/mouse SGR, borrador/foco, aislamiento entre instancias y reapertura de Gruvbox. |
| `index.ts` en PTY | QBasic → grises → verdes en vivo con prompt Unicode/multilínea; resize 80×24 → 60×16; configuración guardada, reinicio ANSI16, NO_COLOR y salida0 con cursor/pantalla restaurados. |
| tmux RGB actual | [Diez capturas de texto](refined-palettes-captures.txt): About con las cinco paletas oscuras en 120×40; selector de seis opciones; scroll hasta Gruvbox y explorador Dark/Green en 60×16; selector traducido en inglés en 100×30. Prompt/borrador visibles. ANSI renderizado a PNG e inspeccionado localmente; no es una captura de píxeles del terminal del usuario. |
| Binarios | No compilados ni probados en esta tarea, conforme a la prioridad de UX. |

## Referencias de color

- [Nord](https://www.nordtheme.com/docs/colors-and-palettes/): base #2e3440,
  superficie #3b4252, texto #d8dee9 y acento #88c0d0.
- [Dracula](https://draculatheme.com/contribute): base #282a36, superficie #44475a,
  texto #f8f8f2 y selección #bd93f9. Títulos/mnemonics en cian #8be9fd para
  asegurar contraste sobre la superficie; secundarios adaptados a #9da6c9.
- [Gruvbox](https://github.com/morhetz/gruvbox/blob/master/colors/gruvbox.vim):
  base #282828, superficie #3c3836, texto #ebdbb2 y acento #fabd2f.

Son adaptaciones al escritorio QBasic. La comprobación de contraste mide los
pares RGB realmente emitidos por el renderer, no solo los colores base. ANSI16
depende de los colores del emulador y no garantiza esos mismos ratios.

[Capturas de la primera iteración](color-palettes-captures.txt) conservadas como
historial; describen los grises/verdes anteriores, no la apariencia actual.

Teclado y mouse de las pruebas son entradas inyectadas; no sustituyen una prueba
física con el mouse del emulador del usuario. Los tonos ANSI16 dependen de la
paleta configurada en cada terminal.

`git pull` intentado al inicio: `main` carece de upstream. Cambio local, sin push.
Cambios previos en docs/qa/final-validation.md y CLAUDE.md preservados.
