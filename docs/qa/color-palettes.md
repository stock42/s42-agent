# Paletas configurables de la TUI

Fecha: 2026-10-01. Fuente: `index.ts`, Bun 1.4.2, Linux x64.

## Comportamiento

- **Ventanas → Paleta de colores**: Clásica · QBasic, Blanco y negro · Grises,
  Verdes. Se marca y selecciona la actual; flechas/j/k, Enter, botón y mouse.
- Seleccionar guarda `ui.palette` en la configuración existente y repinta toda
  la TUI, sin reiniciar, perder borrador ni cambiar la sesión. Escape cancela.
  La apariencia también puede cambiar durante un turno del agente.
- QBasic conserva exactamente sus colores RGB/ANSI anteriores. Configuraciones
  anteriores sin `palette` usan QBasic; valores inválidos se rechazan sin
  sobrescribir el archivo.
- Grises y verdes usan sus propias variantes RGB y ANSI16. La barra inferior
  emplea texto oscuro sobre un fondo claro para mantener contraste en esas dos
  paletas. No se cambia la paleta global del emulador.
- `NO_COLOR`, `--no-color` y `ui.color: "never"` siguen desactivando colores;
  los atributos de selección/foco permanecen. Elegir grises es una opción distinta.

## Validación

| Comprobación | Evidencia |
| --- | --- |
| Typecheck | `bun run typecheck`, correcto. |
| Suite fuente | `bun test`: 86 tests en 17 archivos, cero fallas. |
| Controles y renderer | `tests/palettes.test.ts`: gama de todos los colores emitidos, contraste RGB ≥3:1 incluso en controles deshabilitados/títulos inactivos (excluye sombra), fallback neutro/verde, repintado sin resize e idle sin bytes. |
| Configuración e interacción | Migración de JSON anterior y rechazo de paleta inválida; selector inicial y cancelación; teclado/mouse SGR; borrador, foco y aislamiento entre instancias; reapertura. |
| `index.ts` en PTY | QBasic → grises → verdes en vivo con prompt Unicode/multilínea; resize 80×24 → 60×16; configuración guardada, reinicio ANSI16, NO_COLOR y salida0 con cursor/pantalla restaurados. |
| tmux RGB | [Cuatro capturas de texto](color-palettes-captures.txt): las tres paletas en 80×24 y el selector con Verdes actual en 60×16. Prompt visible bajo el modal. Se revisó una reconstrucción visual de esos colores/celdas; no es una captura de píxeles del terminal del usuario. |
| Binarios | No compilados ni probados en esta tarea, conforme a la prioridad de UX. |

Teclado y mouse de las pruebas son entradas inyectadas; no sustituyen una prueba
física con el mouse del emulador del usuario. Los tonos ANSI16 dependen de la
paleta configurada en cada terminal.

`git pull` intentado al inicio: `main` carece de upstream. Cambio local, sin push.
