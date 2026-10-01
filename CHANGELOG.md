# Changelog

Registrar aquí los cambios realizados en s42-agent. Actualizar el archivo al
cierre de cada tarea e incluirlo en su commit.

## 2026-10-01

### Agregado — Pestañas, menús de producto y preparación MIT

- Menús Archivo/Projects/Models/Promptings/Tools/Vista/Ayuda; Promptings tiene
  biblioteca/nuevo/guardar borrador, Tools agrupa MCP/Skills y Vista reúne
  preferencias visuales. Sin acciones de laboratorio salvo `--demo`.
- Pestañas por proyecto con modelo, sesión, borrador, adjuntos, modo Vim,
  foco/scroll y streaming propios. Mouse, Alt+←/→, Alt+1…9, apertura/cierre y
  overflow; prompt fijo y cabecera completa en 60 columnas.
- Turnos simultáneos entre proyectos, cwd/tools/respuestas aislados y Ctrl+C
  sobre la activa. Ctrl+Q cancela todos; cierre guarda borrador/libera lock.
  Restauración durable de pestañas/activa, incluida recuperación de un intento
  fallido por lock externo sin perder la configuración.
- README reorganizado, MIT, metadata pública, CONTRIBUTING, plantillas GitHub,
  .gitignore y CI fuente Linux/Bun 1.4.2; publicación documentada por separado.
- Install frozen, typecheck y 101 tests fuente correctos (20 archivos, 1167
  assertions), streams concurrentes y entrada real index.ts en PTY; capturas
  tmux 80×24/60×16 inspeccionadas. Exportación limpia con install/typecheck/help,
  YAML/metadata/enlaces revisados. Fase10, specs, AGENTS y QA actualizados.
  Sin builds nuevos. Pull fallido por main sin upstream; commit local, sin push.

### Agregado — CRUD de promptings con metavariables

- Archivo → Promptings, Alt+T, /promptings y NORMAL Espacio+t: biblioteca global
  persistente con nombre/texto multilínea, alta, lectura/edición y eliminación.
  Guardar prompt actual reutiliza el borrador como plantilla.
- Cargar o ejecutar pregunta cada `{{metavar_name}}` única en orden, admite
  valores vacíos/multilínea, anterior/siguiente, Enter para avanzar/aplicar y
  Shift+Enter para línea. Cancelar conserva el draft; la plantilla no cambia.
- Sustitución literal de una pasada; ejecución con proyecto/modelo actuales,
  reasoning/respuestas en chat y texto completo conservado si falta modelo.
  Turnos activos no permiten reemplazar el borrador. Config anterior compatible.
- Typecheck y 96 tests fuente correctos (19 archivos, 1085 assertions), PTY con
  payload/SSE fixture, CRUD/reapertura y capturas tmux 80×24/60×16 inspeccionadas.
  Corregida selección inicial de la biblioteca. Fase09, SPECS, README, AGENTS y
  QA actualizados. Sin builds. Pull fallido por main sin upstream; commit local.

### Agregado — DeepSeek y llama.cpp precargados

- Models → Proveedores / Nuevo proveedor ofrece dos presets con host/puerto y
  credencial sugerida; llama.cpp sigue como default. Configuraciones anteriores
  conservan sus registros y pueden incorporar las plantillas explícitamente.
- Configurar DeepSeek/llama.cpp consulta el catálogo y abre la selección del
  proveedor, sin elegir automáticamente el primer modelo. Nombres/contexto/
  modalidades de la API, salida inicial acotada y capacidades previas conservadas.
- Errores HTTP401/conexión dejan el formulario abierto; consulta cancelable y sin
  requests al iniciar. API key de sesión tiene prioridad y no se guarda en disco.
- Typecheck y 91 tests fuente correctos; PTY/tmux 80×24 / 60×16, fixtures de
  catálogo, corrección de clave, cancelación y reapertura. API oficial revisada;
  DeepSeek real no probado sin credencial. Docs/QA/fase03 actualizadas. Sin builds.
  Pull fallido por main sin upstream; commit local, sin push.

### Agregado — Tres paletas configurables

- Ventanas → Paleta de colores: Clásica · QBasic (actual/default), Blanco y negro
  · Grises y Verdes. Selector por teclado/mouse con opción actual marcada;
  aplicación inmediata y persistencia en `ui.palette`, sin perder el borrador.
- Colores para toda la UI, variantes RGB/ANSI16, contraste en controles y barra
  inferior; configuraciones anteriores conservan QBasic. NO_COLOR y el modo sin
  color mantienen su comportamiento. Las instancias no comparten la selección.
- Typecheck y 86 tests fuente correctos; entrypoint/PTY y capturas tmux 80×24 /
  60×16 verifican cambio en vivo, reinicio y prompt visible. Specs/AGENTS/fase 01,
  README y QA actualizados. Sin builds. Pull fallido por main sin upstream;
  commit local, sin push.

### Completado — Ensayo prolongado de estabilidad

- Soak real de 30 minutos: 1800.009 s, 60 ciclos (20 completos, 20 cancelados
  parcialmente y 20 HTTP503), resize/explorador/nueva sesión y exit0. RSS inicial
  58.08 MiB, final 61.44 MiB, máximo 63.61 MiB; sin GC forzado.
- Se cierra F06-03 con evidencia; se identifica que el proceso core arrancó antes
  de integrar MCP/skills, validadas por separado. Contador etiquetado como chunks
  PTY para no confundirlo con FPS. No se extrapola a mouse/drop ni otros SO.
- Typecheck y documentos conciliados. Commit local tras pull fallido por main
  sin upstream. QA externa pendiente solo en los casos expresamente indicados.

### Completado — QA local, rendimiento y targets

- Suite final fuente: 81 tests, 741 assertions, 16 archivos, cero fallas;
  typecheck correcto. 50 procesos con stream/cancel/resize/cierre restaurados;
  directorio protegido devuelve EACCES. Soak de 30 min sigue activo y se registra
  en una entrada posterior solo cuando finalice.
- Benchmark Linux x64 final: startup p95 24.43 ms, input p95 35.95 ms, SSE/frame
  p95 4.07 ms, RSS idle 46.64 MiB, 1000 mensajes/379463 B en 42.07 ms;
  cero bytes durante 10 s idle. PTY, caché caliente, excluye pintura e inferencia.
- Comparación normal/minify-map/bytecode; se mantiene build normal por objetivos
  cumplidos, menor tamaño y flags mínimos. main async permite compilar bytecode.
- Cinco targets locales con versión/checksum; Linux x64 probado fuera del repo
  y PATH sin Bun/Node: config, sesión, MCP/YAML/skill, read/edit/shell y cleanup.
  macOS/Windows/arm64 solo compilados; mouse/drop físicos y procesos por esos
  SO siguen pendientes explícitos. No se publica release ni se hace push.
- Scripts Bun de build/benchmark/stress/soak/smoke y QA real, README de instalación,
  SPECS/AGENTS/fases conciliados y evidencia final. Pull sin upstream; commit local.

### Corregido — Estado de operaciones auxiliares

- Búsqueda/probe/instalación restablecen Listo al finalizar y conservan el error
  en el estado cuando fallan. Cerrar un formulario durante búsqueda impide que
  sus resultados reabran un modal después de la operación.
- Regresión UI y typecheck; pull sin upstream, commit local.

### Corregido — Menús largos en terminal compacto

- Models ahora desplaza sus opciones dentro del área superior: flechas,
  PageUp/PageDown y rueda, con indicadores de continuidad. El popup y su sombra
  conservan el prompt visible a 60×16; hit testing usa el offset real.
- Typecheck y 34 casos pertinentes pasan. Pull sin upstream; commit local.

### Ajustado — Atajos de MCP/skills y recursos instalados

- MCP/skills participan de los bindings configurables: Alt+C/Alt+S y
  leader+c/leader+k. Validación de colisiones y ayuda integrada.
- Instalación conserva symlinks relativos y excluye metadata .git; nombres de
  skill admiten el formato alfanumérico de la especificación. taskkill usa ruta
  SystemRoot para no depender del PATH en Windows (runtime pendiente).
- Validación pertinente y typecheck; pull sin upstream, commit local.

### Corregido — Alias de skills en el catálogo

- Una segunda instalación real falló porque Vercel publica el name
  vercel-react-best-practices dentro de react-best-practices. El instalador
  identifica el frontmatter y normaliza la carpeta de destino al name;
  el registro local conserva la validación del formato.
- Repetida la instalación real: se conservaron reglas, AGENTS.md y recursos;
  evidencia actualizada. Sin ejecución de scripts. Typecheck y tests pertinentes
  pasan. Pull sin upstream; corrección y evidencia en commit local.

### Validado — GLM local, MCP y catálogo real

- Endpoint provisto por el usuario: GLM-4.7-Flash GGUF Q4_K_XL, contexto 32768.
  Skill invocada, read/MCP/edit/shell reales, suma corregida y bun test exit0;
  verificación independiente exit0. Reasoning real, cancelación parcial y
  reapertura comprobados. Config/archivos temporales, servidor intacto.
- Búsqueda e instalación real de una skill de Vercel en directorio temporal,
  preservando recursos; sin ejecutar sus scripts ni tocar skills personales.
- Scripts reproducibles y evidencia con versiones/template/settings. Fase 03
  completada, F04-11 y fase 08 cerradas. Matriz de procesos por SO aún pendiente.
- Pull sin upstream; commit local, sin publicación remota.

### Agregado — MCP y skills

- Menús MCP/Skills, CRUD de servidores stdio/Streamable HTTP y enabled/disabled;
  prueba de conexión, JSON-RPC moderno/legacy, auth por variable, paginación,
  progreso, namespace estable, cancelación y cierre por turno.
- Skills SKILL.md con YAML nativo, scope global/proyecto, enabled/disabled,
  catálogo progresivo, tool skill e invocación /skill; buscador skills.sh e
  instalación explícita desde GitHub conservando carpeta/recursos/licencias.
- Config v1 migrada sin romper datos previos; notices de MCP/skills durables y
  calls/results visibles en chat. Header completo a 60×16, sin teclas F.
- Terminación de árboles con taskkill en Windows implementada; runtime Windows
  pendiente. Descendientes Linux comprobados, sin repetir efectos al reabrir.
- Typecheck y 8 casos nuevos (51 assertions) pasan; suite anterior ampliada 77
  casos pasa. Fases 07/08, specs y QA documentadas. Pull falla por main sin
  upstream; commit local, sin push, archivos preexistentes excluidos.

### Agregado — Explorador, Projects y eventos en el chat

- Componente FileExplorer: navegación fuera del proyecto mediante padre, raíz o
  ruta escrita; carpetas/archivos/ocultos/enlaces, teclado Vim acotado, rueda y
  doble clic. Preview UTF-8 en solo lectura hasta 64 KiB, aviso de binario y
  regreso al listado. Adjuntar prepara archivos externos sin enviar el prompt.
- Menú Projects con solo Name/Folder, Explorar y Guardar; picker anidado conserva
  formulario/borrador. Ctrl+E, leader+e, /files y acceso desde Archivo.
- Reasoning recibido en reasoning_content/reasoning mostrado progresivamente
  y persistido, incluso ante cancelación/desconexión. Nombre/argumentos de calls
  visibles durante recepción, ejecución y resultados con nombre/exit/duración;
  las calls incompletas no se ejecutan. Render incremental y chat read-only.
- Typecheck correcto; suite completa 71 casos, 675 assertions, 13 archivos.
  Tras ajustes visuales finales, 10 casos pertinentes y typecheck pasan. QA desde
  index.ts en PTY/tmux; prompt visible en 60×16. Sin modelo real ni binarios.
- README, specs, AGENTS y fases actualizados. Evidencia en
  docs/qa/explorer-and-reasoning.md y capturas. git pull falló por main sin
  upstream; commit local, sin push. Archivos preexistentes del usuario preservados.

### Agregado

- `docs/SPECS.md`: alcance del harness TypeScript/Bun, TUI en color, proyectos,
  sesiones, atajos Vim, drag & drop, proveedores/modelos y `llama.cpp` por defecto.
- Contratos de streaming, herramientas, cancelación, recuperación, binarios y
  objetivos de rendimiento, distinguiendo diseño de implementación verificada.
- Investigación con fuentes oficiales de Bun, inventario de sus 319 páginas
  del corpus y referencias a snapshots de Pi y `llama.cpp`.
- `docs/phases/`: índice y siete fases con tareas, dependencias, escenarios de
  aceptación y espacio para registrar evidencia real.
- `AGENTS.md`: datos del proyecto, preferencias globales y regla de hacer
  `git pull` antes de cada tarea, actualizar este registro y hacer commit al cierre.
- Alternativa de estética QBasic compatible con el renderer ANSI y modos Vim;
  elección visual pendiente del usuario, sin implementar una TUI todavía.

### Estado

- Entrega documental; no se implementó el harness ni se modificó el scaffold.
- Se intentó `git pull`; el repositorio no tiene remoto ni upstream configurado.
  Esta tarea continúa localmente sin afirmar sincronización o publicación remota.

### Actualizado — UI QBasic y primer hito visual

- Confirmada la UI estilo QBasic con mouse y escritorio de ventanas TUI. La
  selección visual ya no está pendiente; Pi queda como referencia del agente.
- Agregados los contratos de componentes, foco, superposición, clipping, botones,
  títulos/cierre, menús desplegables, diálogos, clic/release, rueda y arrastre.
- La fase 00 pasa a ser `00-tui-viability.md`: demo Bun de componentes visuales,
  compilada y comprobada antes de integrar LLMs o herramientas de coding.
- La fase 01 reutiliza esa biblioteca para la conversación/editor del harness;
  los modos Vim respetan el foco de menús y diálogos.
- Actualizados AGENTS y criterios de validación para distinguir eventos mouse
  inyectados en PTY de la interacción con mouse real en un terminal gráfico.
- Este cambio de diseño no constituye una demo implementada ni una prueba de
  viabilidad completada. Se volvió a intentar `git pull`, sin remoto/upstream.

### Agregado — Demo QBasic desde index.ts

- `index.ts` raíz como punto de entrada: laboratorio TUI, ayuda/version y opciones
  sin color/mouse; error limpio si falta terminal interactivo.
- `src/ui/components/`: Window, Button, Input, SelectList y MenuBar con
  desplegable integrado; modal reutilizando Window. Desktop con foco, capas,
  cierre, captura de mouse y arrastre de títulos.
- Parser incremental de teclado, mouse SGR y paste; canvas con grafemas Unicode,
  clipping y renderer por filas modificadas. Paleta QBasic, estados por texto,
  cursor monocromo, resize y lifecycle con cleanup.
- Scripts Bun `dev`, `typecheck`, `test`, `build` y `bench:tui`; Bun/types 1.4.2,
  TypeScript 7.0.2 y lockfile. Cero dependencias de runtime.
- 17 tests de comportamiento/PTY, binario Linux x64 compilado y ejecutado desde
  `/tmp`; benchmark sobre una copia externa con PATH sin Bun/Node.
- README, specs, AGENTS y fase 00 actualizados. Evidencia en `docs/qa/`: capturas
  tmux, mediciones, hallazgos corregidos y límites de la validación.
- Medición final PTY: arranque p95 16,76 ms (30 muestras), input p95 35,93 ms
  (100), RSS 36,39 MiB, cero bytes en idle de 10 s y 50 ciclos de modales.
- Fase 00 En curso: quedan mouse físico y host sin Bun/Node. Proveedores,
  agente de coding y drag & drop del SO siguen pendientes.
- Tras configurar el remoto, se volvió a intentar `git pull`: el remoto aún no
  tiene ramas y `main` no tiene upstream. Trabajo y commit locales; sin push.

### Mejorado — Experiencia TUI como prioridad

- Registrada la prioridad del usuario: iterar sobre la TUI desde Bun; reservar
  builds, smoke y benchmarks de binarios para distribución o pedido explícito.
  Actualizados AGENTS, specs, README y fases para evitar compilación por rutina.
- Componentes conserva edición, selección y foco al volver; layout 60×16 con
  tres filas de lista y estado separado de los botones.
- Selección/reemplazo de texto mediante Ctrl+A, Shift+flechas/Home/End y arrastre,
  con grafemas Unicode y recuperación de contexto al ensanchar el input.
- Menús por hover o pulsar/arrastrar/soltar; accesos Alt únicos, ayuda Alt+Y desde un
  menú abierto, modales centrados y atajos contextuales en la barra inferior.
- Feedback correcto al arrastrar afuera de botones/cierre; release fuera del
  área visible cancela. Lista con PageUp/Down, indicadores de scroll y marco inerte.
- Corregido el orden de capas del escritorio vacío: su mensaje ya no tapa las
  opciones del menú Demo. Ventanas → Componentes permite recuperar el laboratorio.
- Retirados los atajos F1–F12 por colisiones con el SO; Escape abre/cierra menús,
  Ctrl+N cambia de ventana y Alt+Y abre ayuda. Actualizados CLI, ayuda y documentación.
- Once escenarios UX nuevos; 28 casos de fuente/componentes/PTY comprobados,
  typecheck y capturas tmux. Evidencia en `docs/qa/tui-ux.md`.
- No se ejecutaron builds ni benchmarks de binarios. Mouse físico pendiente.
  `git pull` intentado: `main` sigue sin upstream; commit local.

### Mejorado — Editor del proyecto y prompt fijo

- Retirados los corchetes decorativos del Input: borrado completo y cursor sobre
  el texto. Botones centrados sin marcadores de foco/presión combinados, estados
  por color/video inverso/tenue, cabeceras conectadas al marco y sombras de una celda.
- `index.ts` abre el editor central con el nombre de la carpeta/proyecto y un
  panel Prompt fijo abajo. No se cierran/arrastran; auxiliares y modales quedan
  dentro del editor y conservan visible el prompt.
- Componente TextArea compartido: edición multilínea, Unicode, selección, wrap,
  scroll y pegado sin envío. Enter/Enviar coloca una respuesta demo en el editor,
  limpia el prompt y devuelve el foco; Ctrl+J inserta una línea.
- Laboratorio conservado en Demo → Componentes. Contexto inicial desde cwd;
  registro de proyectos, LLMs y streaming siguen pendientes.
- Fase 01 En curso por pedido del usuario; specs, AGENTS y README actualizados.
  Evidencia en `docs/qa/workspace.md`: 36 pruebas desde fuente, typecheck y seis
  capturas tmux en 80×24 / 60×16 / 120×40. Mouse físico pendiente.
- Sin builds ni benchmarks de binarios. `git pull` intentado: `main` sigue sin
  upstream; trabajo y commit locales.

### Mejorado — Apariencia según las capturas de QBasic

- Paleta DOS propia en terminales que anuncian truecolor/24bit; fallback de 16
  colores ANSI y modos sin color conservados. Barra inferior turquesa.
- Marcos finos de una línea, títulos centrados en pestañas grises, Ayuda a la
  derecha y selección negra en los menús, sin el prefijo `>`.
- Editor del proyecto y Prompt fijo conservados; controles, mouse, foco y atajos
  sin teclas F mantienen su comportamiento.
- Typecheck, 38 pruebas desde fuente y cuatro capturas tmux con RGB comprobadas;
  evidencia en `docs/qa/qbasic-style.md`. Actualizados README, AGENTS, specs y fases.
- Sin builds ni benchmarks de binarios; mouse físico pendiente. `git pull`
  intentado: `main` sigue sin upstream; trabajo y commit locales.

### Mejorado — Shift+Enter para nueva línea

- Shift+Enter pasa a ser el atajo principal de nueva línea del Prompt; Enter y
  Enviar conservan el envío. Actualizados panel, ayuda CLI, README, specs y AGENTS.
- Teclado extendido Kitty/xterm con parser CSI-u/modifyOtherKeys incremental;
  atajos Ctrl/Alt, texto y navegación conservados, sin doble acción por release.
  Los modos se restablecen al salir. Ctrl+J queda como alternativa de compatibilidad.
- Typecheck y 40 pruebas correctas; Shift+Enter/Enter comprobados desde fuente
  en tmux 3.4. Evidencia y capturas en `docs/qa/shift-enter.md`.
- Sin builds de binarios. `git pull` intentado: `main` sin upstream; commit local.

### Corregido — Respuestas de solo lectura

- El panel central bloquea escritura, pegado, saltos y borrado; conserva foco,
  navegación, selección y scroll. El Prompt sigue siendo editable.
- Typecheck y pruebas de workspace/componentes; actualizado el contrato visual.
- `git pull` intentado: `main` sin upstream. Commit local, sin build de binarios.

### Agregado — Configuración, proyectos, sesiones y Models

- Inicio persistente desde `index.ts`; `--demo` conserva el laboratorio sin datos.
  CLI `--config`, `--project`, `--cwd`, `--session`, `--provider` y `--model`.
- Menús Proyectos, Models y sesiones, con formularios paginados que caben en
  60×16. Models configura ID, host, puerto, API key de sesión, variable de clave,
  contexto, límite de salida y capacidades explícitas. Aviso central sin modelo.
- Config JSON validada con temporal/rename; proyectos normalizados por carpeta.
  Sesiones JSONL, append serializado, lock por escritor, recuperación de última
  línea incompleta, herramientas interrumpidas y borradores separados.
- Typecheck y 13 casos de storage/workspace correctos. Fase 02 En curso;
  transporte y tools continúan en las fases siguientes. No hay inferencia real aún.
- `git pull` intentado sin upstream; commit local, sin build ni nuevas dependencias.

### Agregado — Streaming local y lectura de respuestas

- Cliente Chat Completions, descubrimiento `/models`, SSE incremental, deltas,
  tool calls intercaladas, timeout inicial/idle y cancelación HTTP.
- Enviar/Cancelar en Prompt, Ctrl+C cancela un turno activo; cierre guarda la
  sesión. Respuestas parciales y estado final conservados, sin reintentos automáticos.
- Markdown básico con callbacks Bun y caché por mensaje finalizado; append de
  deltas sin resetear el viewport elegido. El renderer conserva 30 frames/s e idle.
- Typecheck y 7 casos de transporte/storage correctos. Validación de proveedor
  real pendiente: usuario configura host/modelo en Models. No se descargaron modelos.
- `git pull` intentado sin upstream; commit local, sin build de binarios.

### Agregado — Loop de coding y herramientas

- Loop secuencial con read/list/search/write/edit/shell, argumentos validados, cwd
  del proyecto, instrucciones AGENTS aplicables y resultados persistidos por call.
- Edit exige coincidencia única; shell consume stdout/stderr concurrentes, informa
  exit code, timeout, duración y recorte. Cancelar detiene el grupo en Linux.
- Límites de pasos/contexto, resultados de herramientas fallidas y recuperación
  de llamadas interrumpidas sin repetirlas; se conservan errores al reabrir.
- Typecheck y 10 casos de tools/persistencia pasan. Fixture HTTP lee, edita y
  verifica un archivo con Bun; no constituye prueba con un modelo real.
- Pull previo falló por ausencia de upstream. Commit local; sin builds de binarios.

### Agregado — Vim, adjuntos y configuración inicial completa

- INSERT/NORMAL, movimientos/edición/undo del prompt, navegación read-only, leader,
  bindings validados y opción para desactivar Vim; menús y modales conservan prioridad.
- Adjuntos por rutas pegadas, `/attach` y Ctrl+F: POSIX/Windows/UNC/file URLs,
  texto UTF-8 e imágenes según capacidad, límites y revalidación antes del envío.
  El historial conserva el contenido enviado, incluso si el original desaparece.
- Models configura host/puerto/modelo/API key; proveedor editable, eliminación y
  defaults global/por proyecto. API key ingresada vive en memoria; puede persistirse
  el nombre de una variable de entorno. Aviso permanente en chat si falta modelo.
- Formularios compactos, ayudas por modo y resultados de tools legibles. El prompt
  conserva adjuntos y Shift+Enter visibles en 60×16. Descubrimiento cancelable.
- Typecheck y suite completa: 60 casos pasan; comprobaciones pertinentes pasan
  tras los últimos ajustes. PTY configura Models, lee/edita/verifica, cancela y
  reabre borrador. Endpoints fixture independientes y HTTP/idle probados.
- Pull previo sin upstream. Sin prueba de modelo real, drop físico ni nuevos builds.

### Actualizado — QA integrada y documentación del harness

- README, SPECS, AGENTS e índice/fases distinguen implementación, fixtures,
  terminal y pendientes reales; guía de primer uso con Models, llama-server
  externo, configuración, atajos, adjuntos y límites.
- Ayuda desplazable en 60×16, labels de bindings coherentes y ayuda CLI del
  agente. Capturas tmux de chat sin modelo, Models, lectura fixture y adjuntos.
- Integración de A/B: endpoints/model ID/adjuntos, edit/shell, cancelación,
  borradores e historial reabierto sin mezcla entre proyectos.
- Typecheck correcto; 62 tests pasan, 0 fallan (11 archivos, 573 assertions).
  Ajustes posteriores de labels/prefijos Vim validados con las suites pertinentes.
- Fase 02 completada. Fases de LLM/coding/drop/distribución conservan abiertos
  modelo real, mouse/drop físicos, matriz de SO, prueba prolongada y binarios.
- Git pull volvió a fallar por falta de upstream; se preservó trabajo ajeno
  y se hicieron commits locales. No se hizo push ni build de binarios.
