# Fase 06 — Validación integrada, rendimiento y distribución

Estado: **En curso**. Dependencias: fases [00](00-tui-viability.md) a
[05](05-vim-and-attachments.md). Requisitos: R01–R17.
Contratos: SPECS §12, §13 y §14.

El usuario pidió ejecutar todas las fases. Se completan QA, mediciones y targets
locales; no cerrar los casos que requieren un SO/terminal externo por fixtures.

## Objetivo

Cerrar el MVP con pruebas del recorrido completo, objetivos medidos y binarios
ejecutados en las plataformas que se declaren soportadas.

## Tareas

- [x] F06-01. Ejecutar typecheck y suites de comportamiento/integración con
  `bun:test`; distinguir casos reales, fixtures, skips y fallas.
- [x] F06-02. Completar el recorrido fixture de dos proyectos: seleccionar modelo, adjuntar,
  solicitar una edición, verificarla, cancelar otro turno, cerrar y reanudar.
- [x] F06-03. Ejecutar 50 ciclos de apertura/cancelación/cierre, una sesión fixture
  de 30 min y fallas de red, disco, resize y comandos con descendientes.
- [x] F06-04. Crear mediciones Bun para inicio, latencia de input/frames, memoria
  idle y reanudación; usar los fixtures y objetivos de SPECS §12.
- [x] F06-05. Comparar build normal y flags minify/sourcemap/bytecode. Evaluar smol
  solo ante necesidad medida; documentar flags, tamaño y resultados.
- [x] F06-06. Generar los targets de SPECS §13 desde scripts TypeScript/Bun, con
  versión, checksum y assets embebidos. Mantener datos/config fuera del binario.
- [ ] F06-07. Ejecutar smoke de cada target en su SO/arquitectura, fuera del checkout
  y sin Bun/Node. Separar los targets compilados que aún no tienen validación runtime.
- [ ] F06-08. Comprobar TUI QBasic, mouse, ventanas/menús, tool shell, restauración
  y drop en la matriz de terminales;
  publicar solo la compatibilidad comprobada. Registrar lo pendiente sin ocultarlo.
- [x] F06-09. Completar README con instalación del binario, proyectos, configuración,
  servidor local externo, modelos, atajos, adjuntos y solución de errores reales.
  Instalación de artefactos locales documentada, sin inventar una release.
- [x] F06-10. Conciliar SPECS, fases, AGENTS y CHANGELOG con la implementación final,
  sus limitaciones y los comandos que existen; hacer el commit de cada tarea.

Esta fase prepara artefactos de distribución. Publicarlos en un remoto, crear una
release o desplegar un sitio requiere una tarea explícita; no inferir publicación
a partir de un build o commit.

## Escenarios de aceptación

1. Flujo completo con modelo local real y archivos de prueba: diff correcto y
   verificación ejecutada, no solamente explicación textual de lo que haría.
2. El mismo flujo con un segundo proveedor fixture no mezcla endpoint, sesión,
   modelo, credenciales o carpeta de proyecto.
3. Cierres controlados restauran el terminal en los 50 ciclos. Prueba prolongada
   no deja procesos del turno ni crecimiento de memoria sin explicación.
4. Resultados p95/RSS incluyen hardware, SO, Bun y fixture; separar inferencia de
   overhead del harness. Si hay incumplimientos, corregir o registrar el bloqueo.
5. Cada binario declarado soportado corre sin archivos del checkout, Bun, Node,
   dependencias de runtime instaladas ni descargas automáticas del harness. Probar
   clic, rueda, arrastre de ventanas y cierre de menús con mouse real, además del teclado.
6. Configurar un endpoint local caído, un modelo inválido y uno sin herramientas:
   errores comprensibles sin fallback cloud ni efectos duplicados.
7. El README permite reproducir una sesión local desde el binario con su servidor
   externo. No presenta capacidades pendientes como disponibles.

## Evidencia

| Tarea/caso | Artefacto o comando | Resultado y entorno |
| --- | --- | --- |
| Fuente / integración | `bun run typecheck`; `bun test` | Ver [QA actual](../qa/agent-mvp.md): TUI/stream/tools/adjuntos y persistencia fixture. |
| Dos proyectos | `bun test tests/projects-integration.test.ts` | A/B con endpoints y adjuntos distintos, edit/shell, cancelación, borradores y reanudación; no se mezclan carpetas/modelos/historial. |
| Pantallas | [Capturas tmux](../qa/agent-mvp-captures.txt) | Sin modelo, Models compacto, Markdown fixture y adjuntos a 60×16. Sin mouse/drop físicos. |
| Distribución | `bun run build:targets`, `bun run smoke:binary` | Cinco targets compilados; Linux x64 con coding/MCP/skill fixture y PATH sin Bun/Node. Ver manifest y QA final. |

| Target | Compilado | Ejecutado sin Bun/Node | Terminal/drop | Estado |
| --- | --- | --- | --- | --- |
| Linux x64 | Sí | Sí, PATH sin Bun/Node, host driver Bun | PTY, físico pendiente | Runtime local comprobado |
| Linux arm64 | Sí | No, destino no disponible | Pendiente | Solo compilado |
| macOS x64 | Sí | No, destino no disponible | Pendiente | Solo compilado |
| macOS arm64 | Sí | No, destino no disponible | Pendiente | Solo compilado |
| Windows x64 | Sí | No, destino no disponible | Pendiente | Solo compilado |

## Cierre

MVP comprobado en el alcance declarado, resultados de rendimiento registrados y
artefactos reproducibles. No cerrar con plataformas requeridas sin validar: si no
hay equipos disponibles, dejar esa tarea pendiente y declarar el soporte parcial.

Fuente final: suite completa y typecheck; [QA integral](../qa/final-validation.md).
F06-07/08 conservan pendiente la ejecución en otros SO/arquitecturas y el mouse/
drop desde el SO. No hay superficies nativas de computador habilitadas para ese
caso en esta sesión. F06-03 completada: 1800.009 s, 60 ciclos y exit0; RSS máximo 63.61 MiB.
Ver [soak](../qa/tui-soak.json) y [stress](../qa/tui-stress.json). Núcleo TUI
iniciado antes de las extensiones; MCP/skills tienen QA independiente.
