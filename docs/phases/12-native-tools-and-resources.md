# Fase 12 — Tools nativas, búsqueda en disco y recursos

Estado: **Completada**. Depende de 01/03/04/10/11. Requisitos R22/R23/R24.

- [x] F12-01. Separar read/write/edit/list/search/shell en src/agent/tools,
  un archivo por herramienta, conservando schemas, instrucciones y cancelación.
- [x] F12-02. Implementar find por nombre/glob y fetch HTTP nativos Bun:
  métodos, headers, JSON/forms/multipart/texto, errores, límites y timeout.
- [x] F12-03. Documentar contratos/ejemplos y exponer catálogo Tools → Nativas.
- [x] F12-04. Ampliar explorador con ruta base, Buscar, resultados con ubicación,
  preview/adjuntos, Cancelar y resize; navegación fuera del proyecto intacta.
- [x] F12-05. Medir CPU/RAM/disco/VRAM; barra inferior y detalle en Vista,
  sin valores ficticios y con cierre del muestreo/proceso.
- [x] F12-06. Acumular E/S del proveedor por turno/pestaña, incluidas tools,
  length y continuaciones; persistir uso opcional compatible con sesiones v1.
- [x] F12-07. Validar fuente, modelo local y terminal; actualizar documentación,
  CHANGELOG y cierre en Git local.

| Evidencia | Resultado |
| --- | --- |
| `bun run typecheck` | Correcto |
| `bun test` | 111 tests / 23 archivos / 1398 assertions; cero fallas |
| native-tools/metrics/explorer tests | HTTP/forms/error/cancel, búsqueda fuera del proyecto, resize, uso acumulado y restauración |
| [GLM real](../qa/native-tools-live.json) | find y fetch POST correctos; 2 requests, 2520 entrada / 360 salida |
| [QA](../qa/native-tools.md) / [capturas](../qa/native-tools-captures.txt) | index.ts en tmux 190×50, 80×24 y 60×16, inspección visual |

VRAM real N/D: nvidia-smi informa driver/library mismatch en esta máquina.
No se cambian drivers ni configuración personal. GPU/otros SO pendientes de
runtime con hardware compatible; no son resultados del parser fixture.
Sin builds nuevos, mouse/drop físico ni publicación. Pull fallido por main
sin upstream; commit local sin push.
