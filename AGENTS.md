# AGENTS.md — s42-agent

## Proyecto

Harness de coding local con TUI **100% estilo QBasic**, escrito en TypeScript y ejecutado con Bun.
Prioridades: **simplicidad, rapidez y estabilidad**. Debe administrar proyectos,
ofrecer colores y atajos inspirados en Vim, aceptar archivos arrastrados al
terminal y permitir configurar proveedores/modelos, con `llama.cpp` por defecto.
Mouse, ventanas con título/cierre, botones y menús superiores con desplegables
forman parte explícita del alcance. Pi es referencia de arquitectura del agente,
no una alternativa de apariencia.

Referencia conceptual: [Pi](https://github.com/earendil-works/pi). No copiar todo
su monorepo ni adoptar su stack como requisito. Si se reutiliza código MIT,
conservar licencias y atribuciones.

## Fuentes de trabajo y estado

- [docs/SPECS.md](docs/SPECS.md): requisitos, decisiones iniciales, contratos,
  límites, investigación oficial y propuestas pendientes.
- [docs/phases/README.md](docs/phases/README.md): orden y dependencias del desarrollo.
- [docs/phases/](docs/phases/): tareas y evidencia de cada fase.
- [CHANGELOG.md](CHANGELOG.md): cambios efectivamente realizados.

Primer hito de desarrollo: [demo de viabilidad QBasic](docs/phases/00-tui-viability.md).
Construir y comprobar los componentes visuales con mouse/teclado antes de los
proveedores LLM y tools del agente; la configuración Bun y el binario mínimo
se preparan dentro de ese hito. Después, reutilizar los componentes en el harness.

Estado actual: harness desde **`index.ts` raíz**, único entrypoint. `bun run dev`
abre proyectos/sesiones persistentes; **Models** configura host, puerto, ID del
modelo y API key (en memoria o nombre de variable). Sin modelo elegido, el chat
lo indica y no envía requests. `--demo` conserva el laboratorio sin persistencia.
**Proveedores / Nuevo proveedor** ofrece llama.cpp y DeepSeek preconfigurados;
llama.cpp sigue como default. DeepSeek usa `https://api.deepseek.com` y la clave
de sesión o `DEEPSEEK_API_KEY`. Guardar consulta `/models` y abre el selector;
los errores quedan en el formulario. No fijar IDs de modelos ni consultar al iniciar.
Las plantillas también están disponibles en configuraciones anteriores sin
reemplazar endpoints registrados. Claves de sesión tienen prioridad y no se guardan.
Respuesta en solo lectura, prompt fijo, streaming/Markdown, cancelación, loop
read/write/edit/list/find/search/fetch/shell, Vim acotado y adjuntos por rutas ya implementados.
Etiquetas Vos/Agente con estilos semánticos distintos en historial/stream/estado:
amarillo/cian QBasic y tonos adaptados por paleta; cuerpo neutral, selección
prioritaria y etiquetas en negrita sin color. No insertar ANSI en mensajes/sesión.
Mientras un turno LLM está activo, animar el título del proyecto y mostrar
su estado (conectando/razonando/respondiendo/tools) dentro del chat, en una fila
reservada bajo la conversación. Prompt no muestra estados de ese turno mientras
trabaja; conserva modo, tokens, adjuntos y hint de nueva línea. `agentState`
por pestaña es transitorio; no guardar indicadores en mensajes/sesión. El
timer de animación de 200 ms solo existe durante turnos y se limpia al finalizar,
fallar/cancelar o salir; no invalidar por cada tick si la pestaña visible está
idle. Mantener nombre del proyecto y sufijo visible incluso si el título se
recorta. Conservar scroll/foco/borrador y ui.showReasoning para el contenido real.
[QA](docs/qa/agent-activity.md).
Tools nativas en **src/agent/tools/**, un módulo por herramienta y catálogo
**Tools → Nativas**. `src/agent/tools.ts` reexporta el contrato existente.
`find` busca nombre/glob en cualquier carpeta; `search` busca contenido.
`fetch` usa HTTP nativo con métodos/headers y bodies JSON, form URL-encoded,
multipart de campos string o texto; timeout/cancelación y status/body de errores.
Contratos y límites en [docs/TOOLS.md](docs/TOOLS.md).
Identidad/procedimiento en `src/agent/prompt.ts`. Internas en `src/agent/skills/`:
software-project, debug-and-verify y create-pdf, con SKILL.md importados como
texto para no depender del checkout. System prompt incluye solo metadatos;
`internal_skill` lista/carga instrucciones, sin ejecutar scripts. Skills externas
conservan `skill`, `/skill` y config. Preferir instrucciones del proyecto a guías
genéricas. `markdown_html` usa Bun.markdown.html con texto/archivo y salida HTML
opcional; PDF requiere un renderizador instalado, no es una API nativa de Bun.
`websocket` usa el cliente Bun ws/wss, headers/subprotocolos, mensajes de texto,
recepción texto/base64, 64 KiB, timeout/cancelación y cierre al terminar cada call.
Las tres aparecen en Tools → Nativas con descripciones ES/EN y en el chat.
[Papers y decisiones](docs/AGENT-INTELLIGENCE.md), [fase 14](docs/phases/14-internal-skills-and-tools.md).
No afirmar mejoras porcentuales del modelo por pruebas funcionales; distinguir
prompt/skills orientativas de memoria episódica, autoaprendizaje o evals A/B.
El explorador aprovecha el ancho del editor y deja hasta dos filas de margen
arriba/abajo cuando hay espacio; en terminales pequeñas prioriza los controles.
Incluye Buscar por nombre/glob desde
la ruta superior, resultados con ubicación, Cancelar, apertura y adjuntos;
no sigue enlaces en búsquedas, cuenta carpetas inaccesibles y limita a 1000.
En el harness, Enter/doble clic abre archivos completos en pestañas junto al
proyecto, con título del archivo y panel central de solo lectura. Prompt/chat/
modelo/cwd/adjuntos del proyecto quedan intactos. Ctrl+W/× cierra la vista;
Vista → Respuestas o enviar vuelve al chat. Streams no reemplazan el archivo.
Vistas por ruta/proyecto, con scroll/selección propios, transitorias; cerrar el
proyecto quita sus vistas. `src/file-tab.ts` usa Bun.file; `src/ui/syntax.ts`
resalta HTML/CSS/JS/TS y CSS/JS embebidos, sin dependencias ni ejecución. Tokens
semánticos adaptan todas las paletas y preservan selección/monocromo.
[Fase 15](docs/phases/15-file-tabs-and-syntax.md), [QA](docs/qa/file-tabs.md).
CPU % y RAM/disco/VRAM usado/total aparecen en la barra inferior, sin modal.
**Vista → CPU/RAM/Disco/VRAM: on/off** persiste cada indicador en `ui.resources`;
config anterior muestra todos. Tokens E/S y tok/s siempre visibles arriba a la
derecha de Prompt, sin opción de ocultarlos. Sin botón Enviar/Cancelar: Enter
envía, Shift+Enter inserta línea, Ctrl+C cancela; borrador bajo los contadores
con todo el ancho. `src/system/metrics.ts`: muestreo cada 2 s sin
superposición, APIs Bun/compat y DRM o nvidia-smi instalado para VRAM. N/D si
falta contador; nunca inventar cero. Tokens del proveedor acumulados por turno/
pestaña, incluidas tools/etapas/length, persistidos en evento turn opcional;
parcial cuando falta uso. Tok/s usa salida reportada/tiempo real de esas requests,
incluye red/primer token y excluye tools. N/D sin uso/tiempo; no contar chunks.
`src/agent/usage.ts`; [QA](docs/qa/persistent-indicators.md).
La demo no muestrea recursos: cero bytes idle históricos aplican a `--demo`.
Si el proveedor termina por `finish_reason: length`, conservar texto/reasoning
parcial y solicitar etapas pequeñas automáticamente. `src/agent/stages.ts`
mantiene una instrucción al comienzo de cada etapa; no repetirla tras cada tool.
Las continuaciones conservan proyecto, presupuesto, historial y efectos realizados;
descartan calls truncadas, respetan maxSteps y Ctrl+C. No tratar HTTP/timeout/
cancelación como límite de salida. [QA](docs/qa/staged-recovery.md).
**Projects** pide solo **Name/Folder**, con selector de carpeta. **Ctrl+E** abre el
explorador: padre, raíz o ruta libre, archivos en pestañas de solo lectura y adjuntos fuera del
proyecto. El chat muestra reasoning emitido por el proveedor, argumentos de tool
calls en recepción, inicio y resultados; conserva reasoning al cancelar/reabrir.
**Tools → MCP** (Alt+C, /mcp) administra servidores stdio/HTTP con CRUD, enabled/disabled,
prueba de conexión y tools en el loop. **Skills** (Alt+S, /skills) registra SKILL.md,
scopes global/proyecto, activación, búsqueda skills.sh e instalación desde GitHub
(Git externo). /skill nombre prompt invoca instrucciones; cargar no ejecuta scripts.
Módulos nuevos: `src/mcp/`, `src/skills/`, `src/ui/extensions.ts`.
**Promptings → Biblioteca** (Alt+T, /promptings, NORMAL Espacio+t) administra
plantillas globales con nombre/texto multilínea en `config.promptings`.
Guardar prompt actual toma el borrador. Cargar/ejecutar pregunta una vez por
cada `{{metavar_name}}`, con valores multilínea, anterior/siguiente y cancelación
sin modificar el draft. Sustitución literal de una pasada; la plantilla conserva
sus variables. Enter avanza/aplica; Shift+Enter agrega línea. Cargar permite
revisar; ejecutar usa proyecto/modelo/sesión actuales y muestra su respuesta en
el chat. Sin modelo, conserva el prompt resuelto. `src/prompts.ts` y
`src/ui/promptings.ts`; [QA](docs/qa/promptings.md).
Módulos: `src/app.ts`, `src/ui/`, `src/agent/`, `src/llm/` y `src/storage/`.
**Vista → Paleta de colores** cambia toda la TUI en vivo y guarda `ui.palette`:
`qbasic` (default), `grayscale` (Dark · Grafito), `green` (Green · Bosque),
`nord`, `dracula` o `gruvbox`. Grises/verdes mantienen sus IDs existentes.
Paletas oscuras con superficies/foco por rol semántico en `src/ui/theme.ts`;
renderer resuelve esos roles por escritorio sin modificar componentes ni QBasic.
RGB y fallback ANSI16; `NO_COLOR`/`--no-color`/`ui.color: "never"` siguen vigentes.
[QA de paletas](docs/qa/color-palettes.md): contraste y terminal desde fuente.
**Vista → Language** cambia la UI español/inglés en vivo; **Ver razonamiento:
on/off** controla historial y streaming sin borrar reasoning ni ocultar tools.
Persistencia global `ui.language: "es" | "en"` y `ui.showReasoning: boolean`;
config anterior usa es/true. Catálogo propio en `src/ui/i18n.ts`, por escritorio,
sin dependencias. Traducir solo texto de la UI del harness: conservar nombres,
archivos, prompts, respuesta del modelo, argumentos y resultados de tools.
Menús calculan ancho/hit boxes con el texto traducido; mantener IDs de acciones.
Valores de formulario aceptan sí/yes y scope proyecto/project. Actualizar el
catálogo al agregar mensajes UI. [Fase13](docs/phases/13-language-and-reasoning.md),
[QA](docs/qa/language-and-reasoning.md): 117 tests fuente y terminal tmux.
Bun/tipos 1.4.2; TypeScript 7.0.2; cero dependencias de runtime.

Menús de producto: Archivo, Projects, Models, Promptings, Tools, Vista y Ayuda.
**Ayuda → About** presenta capacidades, estilo QBasic, modelos locales/remotos,
MCP/skills, proyectos/promptings y binarios Bun para Windows/Linux/macOS.
Conserva Powered by César Casas., MIT., S42 Agent. y Version de package.json;
incluye https://www.linkedin.com/in/cesarcasas/. `src/ui/about.ts`: modal bilingüe
con cabecera de color, lectura/scroll y cierre; se adapta al área del editor y
mantiene el prompt visible desde 60×16. [QA](docs/qa/about.md).
El buscador consulta directamente **https://skills.sh**
mediante `/api/search`, sin proveedor LLM; búsqueda/resultados muestran ese origen.
El laboratorio y sus menús de prueba solo aparecen con `--demo`.
Una pestaña por proyecto; cada una conserva sesión, modelo, borrador, adjuntos,
modo Vim, foco y scroll. Se pueden ejecutar turnos simultáneos en proyectos
distintos; streaming/tools/cancelación quedan ligados al proyecto de origen.
Mouse, Alt+←/→ y Alt+1…9 cambian de pestaña; `×` o Ctrl+W la cierran si está idle.
Ctrl+C cancela solo la activa; Ctrl+Q cancela todos y guarda/cierra cada sesión.
`workspace.openProjectIds` guarda las abiertas y `lastProjectId` la activa;
restaurar no reejecuta tools. Cerrar no quita el registro ni borra la carpeta.
Módulos: `src/project-tab.ts` y `src/ui/components/tab-bar.ts`;
[QA de pestañas y menús](docs/qa/project-tabs.md).
Licencia MIT. README/CONTRIBUTING y plantillas GitHub preparadas para open source;
CI fuente Linux con Bun 1.4.2. `package.json` conserva `private: true` porque no
se publica un paquete npm. [Publicación](docs/PUBLISHING.md): no cambiar visibilidad,
hacer push ni crear releases sin pedido explícito.

Fases 02/03/07/08/09/10/11/12/13/14/15 completadas. 00/01/04/05 tienen implementación y QA fuente,
con mouse/drop físicos o runtime por SO pendientes. Fase 06 mide rendimiento y
estabilidad, genera cinco targets y verifica Linux x64 fuera del checkout con
PATH sin Bun/Node. No afirmar compatibilidad macOS/Windows/arm64 por cross-build.
[QA integral](docs/qa/final-validation.md), [GLM real](docs/qa/local-llm.md),
[MCP/skills](docs/qa/mcp-and-skills.md). Fixtures/SGR no prueban mouse/drop físicos.
Windows tiene taskkill de árboles implementado; falta validar su runtime.

Scripts: dev, typecheck, test, build, build:targets, build:compare, bench:tui,
smoke:binary, qa:stress, qa:soak, qa:llm y qa:skills. QA siempre usa config/carpeta
temporal; no reemplazar la config personal para hacer pruebas. No publicar
artefactos ni hacer push sin pedido explícito.

## Preferencias globales del usuario

- Nunca crear archivos `.env.local`. Respetar el mecanismo de configuración
  existente o el que el usuario indique explícitamente.
- No ampliar el alcance con cambios, abstracciones o protecciones que el usuario
  no haya pedido. El usuario es arquitecto de software con 25 años de experiencia;
  ejecutar el pedido concreto y exponer solamente los bloqueos reales.
- Hacer sugerencias cuando se detecten mejoras, riesgos u oportunidades,
  priorizando especialmente las relacionadas con seguridad. Presentarlas al
  usuario y esperar su aprobación explícita antes de implementarlas.
- Prioridad actual confirmada por el usuario: perfeccionar la experiencia dentro
  de la TUI. Iterar con `bun run dev`; realizar builds, smoke de binarios y
  benchmarks de distribución cuando el usuario los pida o se prepare una entrega
  de binarios.
- No asignar acciones a las teclas F1–F12: el usuario las descarta por colisiones
  con el sistema operativo/terminal. En la demo: Escape abre/cierra menús,
  Ctrl+N cambia de ventana y Alt+Y abre ayuda; mantener disponibles mouse y menú.
- Editor central titulado con el nombre del proyecto, como el archivo en QBasic.
  Prompt en un panel fijo siempre visible. No permitir cerrar/mover esos paneles
  ni tapar el prompt con auxiliares; mostrar las respuestas dentro del editor.
  El panel de respuestas es de solo lectura; permitir selección y scroll.
- Usar las capturas de QBasic suministradas como guía: azul DOS, marcos finos,
  títulos centrados en pestañas grises, Ayuda a la derecha, menús con selección
  negra y barra inferior turquesa. Conservar atajos sin teclas F.
- Conservar QBasic como paleta predeterminada y ofrecer las variantes de grises
  y verdes solicitadas. Los colores se resuelven por escritorio, conservando
  componentes, foco, layout y texto al cambiar la selección.
- Enter envía el prompt; Shift+Enter es el atajo principal para nueva línea.
  Ctrl+J se conserva como alternativa de compatibilidad si el terminal no
  distingue Shift+Enter. Mostrar Shift+Enter en la UI y la ayuda.
- Mantener Projects con Name y Folder como únicos datos solicitados. El explorador
  permite navegar fuera del proyecto; explorar/adjuntar no cambia el cwd de tools.
- Mostrar en el chat el reasoning realmente recibido (`reasoning_content` o
  `reasoning`), las llamadas mientras llegan, su ejecución y resultados. No
  inventar razonamiento para proveedores que no lo exponen. Respetar
  `ui.showReasoning`: off oculta lo ya recibido y los deltas nuevos; on lo
  recupera. Conservar siempre reasoning en la sesión y contexto del modelo.

## Regla Git obligatoria

> siempre hacer git pull antes de cada tarea. luego de cada tareas, hacer el commit y actualizar CHANGELOG.md

Aplicación práctica:

1. Leer instrucciones aplicables y revisar `git status`, rama y remoto.
2. Ejecutar `git pull` antes de empezar la tarea. No sustituirlo por un fetch ni
   afirmar sincronización sin que el pull haya terminado correctamente.
3. Si falla por ausencia de remoto/upstream, divergencia, conflictos o cambios
   locales, informar el motivo concreto. No inventar remotos, descartar trabajo,
   hacer force/reset ni configurar seguimiento sobre una rama supuesta.
4. Cuando falta remoto/upstream, se puede continuar trabajo local independiente
   dejando registrada la falta de sincronización; no afirmar que se publicó.
   Si el trabajo depende de cambios remotos, resolver ese bloqueo antes de seguir.
5. Al terminar la tarea, validar el resultado y actualizar `CHANGELOG.md` **antes
   del commit**, para incluir el registro y los cambios en el mismo commit.
6. Revisar el diff y agregar únicamente archivos de esa tarea. No usar `git add .`
   para incluir incidentalmente archivos existentes del usuario.
7. Hacer el commit y comprobar el estado final. Si no puede hacerse, informar la
   causa y no presentar la tarea como cerrada en Git. No hacer push por inferencia.

La regla gobierna el desarrollo de este repositorio. El harness debe respetar
las instrucciones de cada proyecto registrado, sin transferir automáticamente
esta política Git a los proyectos sobre los que trabaja.

## Stack y convenciones

- TypeScript estricto y ESM; un paquete y un proceso iniciales.
- Mantener `index.ts` raíz como entrypoint. Implementación en `src/`; componentes
  visuales en `src/ui/components/`. El layout del agente se compone en
  `src/ui/workspace.ts`; `src/ui/demo.ts` conserva el laboratorio reutilizable.
- Usar `bun`, `bun run`, `bun install`, `bun test` y `bun build`. No depender de
  Node.js, npm, yarn o pnpm para desarrollar o ejecutar el harness.
- Preferir APIs Bun: archivos, glob, spawn, texto, colores y Markdown. Usar APIs
  Web incluidas para fetch/streams/cancelación.
- `process` y módulos `node:*` implementados por Bun son válidos cuando cubren
  raw mode, paths, directorios, append o rename. No requieren Node externo.
- No agregar dotenv ni crear un nuevo mecanismo de entorno por conveniencia.
- El build del primer hito ya existe. Las iteraciones de UX se validan desde el
  entrypoint Bun; no repetir compilaciones ni pruebas de binarios por rutina.
- Construir una biblioteca interna pequeña de componentes TUI con render por
  celdas, clipping, foco y eventos compartidos. Está solicitada por el usuario;
  no convertirla en un framework, motor CSS o paquete publicable por inferencia.
- Typecheck es independiente de ejecución/build; no decir que Bun verifica tipos.
- No agregar dependencias o abstracciones sin una necesidad concreta del alcance.
- No introducir APIs experimentales para reemplazar un camino estable existente.
- Separar TUI, eventos del agente, cliente LLM, tools y persistencia con módulos
  pequeños; no crear frameworks internos, servicios o bases de datos iniciales.
- El servidor `llama.cpp` y los modelos son externos al binario del harness.

## Validación y evidencia

- Consultar el contrato oficial de la API Bun utilizada y comprobar su versión;
  la investigación de SPECS no sustituye una prueba del comportamiento.
- Elegir tests que cubran errores reales: input fragmentado, SSE, tool calling,
  edición exacta, cancelación, separación de proyectos y recuperación de sesión.
- No crear tests que solo repitan la implementación ni ampliar suites sin motivo.
- Usar `bun:test`. No interpretar «no tests found», skips o fixtures como pruebas
  del modelo real o del terminal del usuario.
- Para iteraciones de UX ejecutar typecheck y pruebas relevantes de la TUI desde
  la fuente; revisar la interacción/render en terminal. Build/smoke/benchmark
  quedan para tareas explícitas de binarios o entrega. Registrar solo lo ejecutado.
- Verificar la TUI en terminal real/PTY, con Unicode, resize, color desactivado,
  pegado y cierre que restaure cursor, raw mode y mouse.
- Probar clic, release, rueda, arrastre de título, foco, ventanas superpuestas,
  menús y modales. Input SGR inyectado en PTY no sustituye mouse real del emulador.
- Drag & drop requiere una prueba desde el SO; simular una ruta prueba el parser.
- Cross-compilar no demuestra que el artefacto corre en el sistema de destino.
- Distinguir documentación, implementación, validación local, commit, publicación
  y ejecución del proveedor. Registrar limitaciones concretas sin fabricar éxito.
- Actualizar checks y evidencia de fase solo por trabajo realmente completado.

## Alcance de las tareas

Crear esta documentación no inicia automáticamente el desarrollo del producto.
En nuevas tareas, ejecutar el alcance pedido tomando la fase correspondiente como
guía. Las propuestas pendientes de SPECS §15 requieren aprobación explícita y
no son condiciones adicionales para completar las tareas del MVP.
