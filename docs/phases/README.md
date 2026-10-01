# Fases de desarrollo de s42-agent

Fuente de requisitos: [SPECS.md](../SPECS.md). Fecha: 2026-10-01.

Estado actual: harness Bun/QBasic persistente desde index.ts, respuestas read-only,
prompt fijo, explorer fuera del proyecto, Models/Projects, MCP, Skills y Promptings.
Menús de producto organizados, pestañas con turnos por proyecto y preparación MIT.
Tools nativas separadas, búsqueda en disco y recursos/tokens visibles.
UI español/inglés y razonamiento on/off configurables en Vista.
Archivos en pestañas de solo lectura con sintaxis HTML/CSS/JavaScript/TypeScript.
Modo CLI sin TUI con el mismo agente, tools, sesiones y flags de proveedor.
Fases 02/03/07/08/09/10/11/12/13/14/15/16/17/18 completadas; implementación de 00/01/04/05 disponible con
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
| 09 | [Promptings](09-promptings.md) | 01–04 | CRUD de plantillas y valores de metavariables al cargar/ejecutar. | R20 |
| 10 | [Pestañas y open source](10-project-tabs-and-open-source.md) | 01–04, 09 | Menús definitivos, proyectos simultáneos y preparación MIT. | R06, R12, R21 |
| 11 | [Recuperación y About](11-staged-recovery-and-about.md) | 01, 03, 04, 08, 10 | Continuación por etapas, About y catálogo directo skills.sh. | R04, R14, R19 |
| 12 | [Tools, explorador y recursos](12-native-tools-and-resources.md) | 01, 03, 04, 10, 11 | Tools nativas, búsqueda en disco, CPU/RAM/disco/VRAM y tokens por pestaña. | R22–R24 |
| 13 | [Idioma y razonamiento](13-language-and-reasoning.md) | 01–03, 07–12 | UI español/inglés y razonamiento on/off en vivo/persistentes. | R25–R26 |
| 14 | [Identidad y skills internas](14-internal-skills-and-tools.md) | 04, 08, 12, 13 | Prompt breve, skills internas, Markdown HTML y WebSocket nativos. | R27–R29 |
| 15 | [Archivos y sintaxis](15-file-tabs-and-syntax.md) | 10, 12, 13 | Archivos en pestañas, panel central completo y resaltado HTML/CSS/JS/TS. | R30 |
| 16 | [CLI sin TUI](16-cli-without-tui.md) | 02–04, 07, 08, 11 | Mismo agente desde command line, flags de endpoint/prompting/reasoning, sesión y cancelación. | R31 |
| 17 | [Config global y APIs Bun](17-global-config-and-bun-native.md) | 02–04, 08, 12, 16 | Modelo recordado, llavero del SO, Bun Shell y scraping renderizado nativo. | R32 |
| 18 | [Coding fiable y SQLite](18-reliable-coding-and-sqlite.md) | 02–04, 10, 12, 15–17 | Capacidades reales, tabs identificadas/animadas, tokens en vivo y migración SQLite. | R33 |
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
