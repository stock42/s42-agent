# Shift+Enter para nueva línea

Fecha: 2026-10-01. Bun 1.4.2, Linux, entrypoint `index.ts`.

Enter/Enviar conserva el envío explícito. Shift+Enter inserta una nueva línea en
el Prompt sin enviarlo; UI, ayuda CLI, specs y preferencias reflejan ese atajo.
El editor también admite Shift+Enter. El pegado multilínea continúa sin enviar.

## Compatibilidad

Se solicita `CSI > 1 u` para desambiguación Kitty y `CSI > 4;2 m` para
xterm modifyOtherKeys. El parser recibe `CSI 13;2u` y `CSI 27;2;13~`, incluso
fragmentados por byte. Conserva atajos Ctrl/Alt, navegación y texto; descarta
eventos de release para evitar doble acción. Al salir emite `CSI < u` y
`CSI > 4 m` antes de abandonar la pantalla alternativa.

Contratos oficiales: [teclado Kitty](https://sw.kovidgoyal.net/kitty/keyboard-protocol/),
[XTMODKEYS y modifyOtherKeys](https://invisible-island.net/xterm/ctlseqs/ctlseqs.html).

No se exige Kitty como emulador. Si un terminal ignora estos modos y envía el
mismo retorno para Enter y Shift+Enter, el harness no puede diferenciarlos.
Ctrl+J sigue disponible como alternativa de compatibilidad.

## Evidencia

| Comprobación | Resultado |
| --- | --- |
| `bun run typecheck` | Correcto. |
| `bun test` | 40 casos correctos desde fuente. Incluye CSI-u/modifyOtherKeys fragmentados, nueva línea sin envío, paste, color, monocromo, idle y cleanup. |
| PTY Bun | Ambas codificaciones de Shift+Enter insertan sin enviar. Ctrl+A extendido conserva selección/borrado; los modos se habilitan y se restablecen al salir. |
| tmux 3.4 | Servidor aislado con `extended-keys on`. `send-keys S-Enter` inserta la segunda línea; `send-keys Enter` envía ambas. [Dos capturas de texto reales](shift-enter-captures.txt). |
| Binarios/build/benchmark | No ejecutados. |

Las pruebas de terminal usan entrada inyectada; falta comprobar la combinación
física en el emulador del usuario. Las capturas previas conservan el texto de
atajos de sus respectivos snapshots.

`git pull` intentado: `main` continúa sin upstream. Trabajo local, sin push.
