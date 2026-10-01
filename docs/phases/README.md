# Fases de desarrollo de s42-agent

Fuente de requisitos: [SPECS.md](../SPECS.md). Fecha: 2026-10-01.

Estado actual: harness Bun/QBasic persistente desde index.ts, respuestas read-only,
prompt fijo, explorer fuera del proyecto, Models/Projects, MCP y Skills.
Fases 02/03/07/08 completadas; implementación de 00/01/04/05 disponible con
validaciones físicas o por SO pendientes. Fase 06 incorpora QA real, rendimiento,
prueba prolongada y distribución local. [QA integral](../qa/final-validation.md).

Pendientes externos: mouse/drop físicos, Windows/macOS/arm64 en destino. Los checks
de implementación no sustituyen esos criterios de cierre. No hay release publicada.

| Fase | Archivo | Depende de | Resultado | Requisitos |
| --- | --- | --- | --- | --- |
| 00 | [Demo QBasic y componentes](00-tui-viability.md) | Specs | Ventanas, botones, menús y mouse probados en una demo Bun compilada. | R01–R05, R13–R17 |
| 01 | [TUI del harness](01-terminal-ui.md) | 00 validada | Editor del proyecto y prompt fijo sobre los componentes QBasic. | R03–R05, R15, R16 |
| 02 | [Proyectos y sesiones](02-projects-and-sessions.md) | 00, 01 | Configuración durable y separación por proyecto. | R06, R12 |
| 03 | [Proveedores y llama.cpp](03-providers-and-local-llm.md) | 01, 02 | Streaming local y selección de proveedor/modelo. | R09, R10 |
| 04 | [Ciclo de coding](04-agent-loop-and-tools.md) | 02, 03 | Leer, editar y verificar un proyecto mediante tools. | R04, R11 |
| 05 | [Vim y adjuntos](05-vim-and-attachments.md) | 01, 02, 03, 04 | Operación con teclado y archivos arrastrados. | R07, R08 |
| 07 | [MCP](07-mcp.md) | 02–04 | CRUD, enabled/disabled, tools stdio/HTTP en el loop. | R18 |
| 08 | [Skills](08-skills.md) | 02, 04 | SKILL.md, carga progresiva y buscador skills.sh. | R19 |
| 06 | [Validación y distribución](06-quality-and-binaries.md) | 00–05 | Evidencia integral, mediciones y binarios comprobados. | R01–R17 |

La UI QBasic, el uso de mouse y los componentes visuales están confirmados. El
primer paso es **generar y comprobar la TUI**, sin proveedores ni agente. La base
Bun se prepara dentro de esa demo; no constituye un hito anterior de backend.

La fase 00 debe comprobar ventanas, títulos/cierre, botones y menús desplegables
con mouse y teclado. Luego se construye la conversación del harness reutilizando
esos componentes. Pi continúa como referencia del agente, no como estilo visual.

## Cómo ejecutar las fases

1. Leer el `AGENTS.md` del repositorio y hacer `git pull` antes de cada tarea.
2. Elegir la próxima tarea cuyas dependencias estén completas; implementar solo
   su alcance y preservar trabajo ajeno.
3. Registrar evidencia de los escenarios relevantes; un test omitido no pasa.
4. Actualizar los checks y la evidencia de la fase, junto con `CHANGELOG.md`.
5. Hacer el commit de los archivos de esa tarea después de validar el diff.

Las fases describen responsabilidades, no siete cambios gigantes. Dividirlas en
tareas pequeñas que dejen una versión ejecutable mediante Bun. Por prioridad
del usuario, las iteraciones actuales se concentran en UX desde la fuente.
Builds y pruebas de binarios se concentran en fase 06 o en una entrega de distribución;
el primer build de fase 00 ya se comprobó.

No incorporar propuestas pendientes de SPECS §15 a estas tareas sin aprobación
explícita. No agregar proveedores nativos, sandbox, plugins o un backend como
condición artificial para completar el MVP.

## Evidencia y estados

Usar `Pendiente`, `En curso`, `Bloqueada` o `Completada`, con el motivo concreto
si una tarea está bloqueada. Cada archivo tiene una tabla para los comandos,
artefactos y resultados reales. No completar checks por haber escrito el plan.

Para builds externos distinguir `compilado` de `ejecutado en destino`; para LLM
distinguir fixture de modelo real; para drag & drop distinguir rutas simuladas
de un drop desde el sistema operativo.

Un build, benchmark o caso manual fallido debe quedar visible junto con su
corrección o limitación. No cambiar los objetivos de rendimiento para declarar
éxito sin documentar la decisión.
