# Apariencia inspirada en las capturas de QBasic

Fecha: 2026-10-01. Fuente: `index.ts`, ejecutada con Bun 1.4.2 en Linux.
Referencias: las cuatro capturas del QBasic original suministradas por el usuario.

## Cambios

- Azul DOS `#0000AA`, gris `#AAAAAA` y barra inferior turquesa `#00AAAA`.
  Menús con selección negra, sin prefijo `>`; títulos en pestañas grises.
- Marcos finos de una línea en paneles y ventanas; Ayuda a la derecha.
  Se conservan los controles, foco, cierre y sombras de auxiliares.
- Editor con nombre de proyecto y Prompt fijo abajo; ningún atajo F1–F12.
  La respuesta sigue siendo una demo explícita sin proveedor conectado.
- Paleta propia RGB cuando `COLORTERM` indica `truecolor` o `24bit`, con
  fallback ANSI de 16 colores. `NO_COLOR` y `--no-color` siguen vigentes.
  No se modifica la paleta global del terminal ni su fuente.

El renderer usa SGR `38;2;R;G;B` / `48;2;R;G;B`, según el
[contrato de xterm](https://invisible-island.net/xterm/ctlseqs/ctlseqs.html).
El perfil de color también invalida el frame anterior: un cambio de perfil
repinta; en reposo no se emiten frames.

## Verificación

| Comprobación | Resultado |
| --- | --- |
| `bun run typecheck` | Correcto. |
| `bun test` | 38 casos correctos desde fuente: edición, layout, mouse SGR, menús, color/fallback, monocromo, resize, idle y cleanup. |
| Clic en Ayuda | Coordenadas verificadas a 60, 80 y 120 columnas; cabecera y desplegable siguen usando la misma área de interacción. |
| tmux con RGB | [Cuatro capturas de texto](qbasic-style-captures.txt): inicio y menús en 80×24, ayuda modal en 60×16. Se comprobaron también los escapes RGB azul/turquesa de la pantalla capturada. |
| Prompt bajo modal | Visible y accesible al cerrar el modal en 60×16; no se desplazaron los paneles fijos. |
| Build/benchmark | No ejecutados. |

El primer pase de la suite tuvo 37 casos correctos y un fallo de comprobación RGB:
la fixture heredaba `NO_COLOR` del entorno de herramientas. Se corrigió el entorno
del test que solicita color, conservando intacta la política del producto.
El caso dirigido y la suite completa posterior pasaron; no se omitieron casos.

Las capturas provienen del emulador tmux ejecutando el entrypoint real, con
teclado y mouse SGR inyectados. Son texto de terminal, no capturas de píxeles.
La tipografía depende del emulador; los tonos del fallback ANSI dependen de su
paleta. El mouse físico en el terminal del usuario sigue pendiente.

`git pull` intentado antes de la tarea: `main` no tiene upstream.
Trabajo local, sin afirmar sincronización ni publicación remota.
