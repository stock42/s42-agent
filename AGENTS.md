# AGENTS.md — s42-agent

## Proyecto

Harness de coding local con TUI **100% estilo QBasic**, TypeScript estricto y
Bun 1.4.2. Prioridades: simplicidad, rapidez y estabilidad. Cero dependencias
externas de runtime. Licencia MIT; `package.json` mantiene `private: true` porque
no se publica un paquete npm.

`index.ts` raíz es el único entrypoint. `bun run dev` abre la TUI persistente;
`--demo` conserva el laboratorio sin persistencia. `--prompting "pedido"` usa
el mismo agente sin iniciar TUI, raw mode, escritorio ni monitor de recursos.
El proveedor por defecto es llama.cpp; el servidor y los modelos son externos.
Pi es referencia de arquitectura, no de apariencia. Conservar atribuciones
si se reutiliza código MIT.

## Documentación y módulos

- [README.md](README.md) / [README.es.md](README.es.md): instalación y uso inicial.
- [docs/USAGE.es.md](docs/USAGE.es.md): manual detallado del producto.
- [docs/TOOLS.md](docs/TOOLS.md): contratos y límites de las herramientas.
- [CONTRIBUTING.md](CONTRIBUTING.md): desarrollo, validación y contribuciones.
- [docs/PUBLISHING.md](docs/PUBLISHING.md): builds y preparación de releases.
- [CHANGELOG.md](CHANGELOG.md): cambios efectivamente realizados.

Implementación en `src/`: `app.ts` coordina proyectos; `cli.ts` ejecuta sin TUI;
`project-tab.ts` y `file-tab.ts` conservan estados independientes; `ui/workspace.ts`
compone el layout; `ui/components/` contiene controles compartidos. `agent/`
separa prompt, loop y herramientas; `llm/`, `mcp/`, `skills/`, `storage/` y
`system/` conservan sus responsabilidades actuales.

## Contratos del producto

- El panel central de respuestas/archivos es de solo lectura y el prompt queda
  siempre visible. Conservar selección, scroll, Unicode y números de línea
  lógica en un margen separado; no insertar números ni ANSI en mensajes/sesiones.
- Cada proyecto conserva sesión, modelo, borrador, adjuntos, foco y scroll.
  Turnos simultáneos y sus tools/cancelación pertenecen al proyecto de origen.
  Las pestañas de archivos son transitorias y no reemplazan el estado del chat.
- Configuración global e historial usan `bun:sqlite`, WAL y transacciones.
  `--config` JSON mantiene el backend legacy explícito. Las API keys TUI usan
  Bun.secrets; CLI conserva overrides en memoria. No guardar claves en JSON.
  No consultar la red al iniciar ni modificar configuración personal en QA.
- El loop conserva respuestas/reasoning parciales al cancelar y recupera
  `finish_reason: length` mediante etapas, respetando maxSteps y efectos previos.
  `--reasoning` y `ui.showReasoning` controlan visibilidad sin borrar contexto.
- Tools nativas en `src/agent/tools/`, un módulo por herramienta; conservar el
  contrato reexportado por `src/agent/tools.ts` y actualizar el catálogo.
  Skills internas importan SKILL.md como texto. Cargar instrucciones no ejecuta
  scripts. MCP stdio mantiene Bun.spawn para RPC bidireccional.
- Shell, Git y comandos internos comparten `src/system/command.ts` y el worker
  `--internal-shell`, con cancelación de árbol/timeout. Usar Bun Shell y escapar
  argv internos. No sustituir MCP stdio por Bun Shell.
- UI ES/EN en `src/ui/i18n.ts`; actualizar el catálogo al agregar texto UI.
  Conservar prompts, nombres, archivos y resultados del modelo/tools originales.
  Colores por roles semánticos en `src/ui/theme.ts`; QBasic sigue como default.
- WebServer sirve el proyecto activo en 127.0.0.1 con puerto configurable y
  estado transitorio. Cerrar proyecto, cambiar carpeta o salir lo detiene.
  No iniciar servidores automáticamente ni convertirlo en una tool LLM.

## Contenido del repositorio

Versionar fuente, tests, CI, scripts reutilizables, instaladores, documentación
para usuarios/contribuidores y capturas finales utilizadas en los README.
`private/` está ignorado: informes/resultados locales de QA, scripts de tareas
puntuales, planes internos, campañas, anuncios y prompts de imágenes. No depender
de esa carpeta para runtime, tests, CI o releases. Builds, manifiestos y smoke
de distribución se generan en `dist/`.
No usar `git add -f` para publicar material privado por inferencia.

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
- No introducir APIs experimentales para reemplazar un camino estable existente
  sin pedido explícito; Bun.secrets y Bun.WebView están solicitadas por el usuario.
- Separar TUI, eventos del agente, cliente LLM, tools y persistencia con módulos
  pequeños; no crear frameworks internos ni servicios adicionales. SQLite está solicitado.
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
guía. Las propuestas fuera del pedido requieren aprobación explícita y no son
condiciones adicionales para completar la tarea actual.
