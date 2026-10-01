# s42-agent

Harness de coding **TypeScript/Bun**, con TUI estilo QBasic, mouse y cero
dependencias de runtime. El editor central muestra la conversación en **solo
lectura**; el panel **Prompt** permanece visible debajo.

## Ejecutar

Bun **1.4.2**, terminal ANSI de al menos **60×16**; recomendado 80×24.

```bash
bun install --frozen-lockfile
bun run dev
```

En el primer inicio, **Projects** pide solamente **Name** y **Folder**. El botón
**Explorar** permite elegir la carpeta navegando el filesystem. Abrir
**Models → Configurar modelo**: sin un modelo seleccionado, la ventana de chat
muestra **No hay modelo configurado** y no envía requests.

El formulario tiene tres páginas, recorridas con Tab y Siguiente:

1. ID real del modelo, nombre y host/URL base, incluyendo `/v1`.
2. Puerto, API key para esta ejecución o nombre de su variable de entorno.
3. Contexto, máximo de salida y `Tools / imágenes`: `sí/no`, `no/no` o `sí/sí`.

El proveedor inicial es `llama.cpp` en `http://127.0.0.1:8080/v1`, sin ID de modelo
inventado. **Models → Descubrir /models** obtiene IDs, pero las capacidades y el
contexto se configuran manualmente. Habilitar tools únicamente para un modelo y
template que las soporten. La API key escrita en el formulario vive en memoria;
para reusar credenciales se guarda solo el nombre de una variable de entorno.
No se crean archivos `.env.local` ni se guardan claves/cabeceras en las sesiones.

Models permite agregar/quitar modelos y proveedores, editar host/puerto y guardar
el default global o del proyecto. Un cambio de modelo conserva el historial;
si contiene imágenes, exige un modelo con esa capacidad o una sesión nueva.

## Servidor local externo

El harness no descarga modelos ni inicia `llama-server`. Ejemplo para un GGUF
ya disponible:

```bash
llama-server -m /ruta/modelo.gguf --host 127.0.0.1 --port 8080 --alias local-coder --jinja
```

Registrar `local-coder` en Models, con el contexto de ese servidor. El tool calling
puede requerir un chat template compatible: consultar la
[documentación oficial de llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md).
Este ejemplo no implica una prueba realizada con ese modelo.

## Trabajo y atajos

El menú Projects administra nombre/carpeta. Archivo crea y reabre sesiones por
proyecto; conserva borradores y el contenido enviado. Ventanas → Componentes
mantiene el laboratorio QBasic. `--demo` abre la demo sin persistencia ni proveedor.

| Acción | Teclado / mouse |
| --- | --- |
| Enviar | Enter o Enviar |
| Nueva línea | Shift+Enter; Ctrl+J si el terminal no distingue el modificador |
| Cancelar turno / descubrimiento | Ctrl+C o Cancelar; conserva efectos ya realizados |
| Elegir proyecto / modelo / proveedor / sesión | Ctrl+P / Ctrl+O / Ctrl+B / Ctrl+R |
| Adjuntos | Ctrl+F o Ventanas → Adjuntos |
| Explorador de archivos | Ctrl+E o Archivo → Explorador de archivos |
| Cambiar panel | Ctrl+N o clic; Tab en NORMAL cambia prompt/conversación |
| Foco de controles | Tab / Shift+Tab o clic |
| Menú | Escape desde NORMAL; desde INSERT pasa primero a NORMAL; Alt+A/P/M/C/S/V/Y o clic |
| Menú/modal | Flechas, Enter, Escape; tienen prioridad sobre Vim |
| Selector | j/k o flechas, Enter; mouse y rueda |
| Seleccionar texto | Ctrl+A, Shift+flechas, arrastre; la respuesta sigue en solo lectura |
| Ayuda | Alt+Y o menú Ayuda |
| Cerrar auxiliar / salir | Ctrl+W o `[X]` / Ctrl+Q; Ctrl+C sale cuando está idle |

Vim arranca en **INSERT**. En NORMAL, el prompt admite `h/j/k/l`, `w/b`, `0/$`,
`i/a/I/A`, `x`, `dd` y `u`. En la conversación: `j/k`, Ctrl+D/U, `gg/G`.
Espacio seguido de `p/m/s/e/f/c/k/?` abre proyectos/modelos/sesiones/explorador/adjuntos/MCP/skills/ayuda.
Ayuda permite activar/desactivar Vim; `ui.vimMode` también puede configurarse en JSON.

Comandos: `/help`, `/projects`, `/providers`, `/models`, `/sessions`, `/files`, `/new`,
`/mcp`, `/skills`, `/skill nombre prompt`, `/attach ruta`, `/detach`, `/quit`. Tab completa comandos y una ruta de `/attach`
con candidato único. /skill se envía como invocación; los demás comandos de la aplicación no se envían al modelo.
No se asignan acciones a F1–F12.

Bindings opcionales, asociados a acciones conocidas, con colisiones rechazadas:

```json
"ui": {
  "vimMode": true,
  "color": "auto",
  "bindings": {
    "global": { "projects": "ctrl+g" },
    "normal": { "projects": "leader+g" }
  }
}
```

Las acciones configurables son `projects`, `models`, `providers`, `sessions`,
`attachments`, `explorer`, `mcp`, `skills` y `help`. Los atajos de lifecycle/foco/edición permanecen reservados.

## Explorador y chat

El explorador parte del proyecto y permite salir de él: **Subir**, **Raíz** o una
ruta escrita en el input y **Ir**. Muestra carpetas, archivos, ocultos y enlaces.
Enter/doble clic abre una carpeta o una vista previa de texto en solo lectura;
flecha izquierda/Backspace sube, `h/j/k/l` navega y la rueda desplaza el listado.
La vista previa se limita a 64 KiB; los binarios muestran su tipo sin interpretarse
como texto. **Adjuntar** prepara un archivo, incluso fuera del proyecto, sin enviar
el prompt ni cambiar la carpeta de trabajo. En Projects, **Elegir folder** devuelve
la carpeta visitada y conserva el nombre escrito en el formulario.

El chat muestra **Razonamiento** cuando el proveedor lo envía en
`reasoning_content` o `reasoning`. Los argumentos de **Tool call** aparecen durante
su recepción; luego se muestra la herramienta ejecutándose y su resultado, error,
duración y exit code disponible. Solo se ejecutan llamadas completas. La respuesta
y el razonamiento recibido se guardan con la sesión, también ante cancelación o
desconexión; una llamada incompleta no se ejecuta ni se registra como ejecutable.

El servidor debe exponer ese razonamiento: [llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)
documenta `reasoning_content`, y [vLLM](https://docs.vllm.ai/en/latest/features/reasoning_outputs/)
documenta `reasoning`. No se genera un razonamiento ficticio cuando no viene en
el stream. [QA del explorador/chat](docs/qa/explorer-and-reasoning.md).

## Adjuntos

Pegar/arrastrar rutas entregadas por el terminal prepara adjuntos **sin inferencia**.
En terminales sin bracketed paste, usar INSERT: el primer Enter sobre una línea
completa de rutas existentes adjunta; el siguiente envía. `/attach` y Ctrl+F
sirven como alternativa. Los bloques de código permanecen como texto.

Texto UTF-8 hasta 1 MiB; PNG/JPEG/WebP hasta 5 MiB con un modelo que admita imágenes.
Máximo 10 archivos y 10 MiB incluyendo base64. No se incluyen carpetas, PDFs ni
archivos comprimidos. Ctrl+F muestra rutas/tamaños y permite quitar adjuntos.
Si un archivo cambia antes de enviar, se actualiza el borrador y se pide revisar
antes de pulsar Enter otra vez. El historial conserva los bytes/texto enviados.

## Configuración y límites

```bash
bun run index.ts --cwd /ruta/proyecto
bun run index.ts --project nombre
bun run index.ts --config /ruta/config.json
bun run index.ts --help
bun run index.ts --no-color --no-mouse
bun run index.ts --demo
```

Linux: config en `~/.config/s42-agent/config.json` y sesiones en
`~/.local/state/s42-agent/sessions/`, respetando XDG. macOS usa
`~/Library/Application Support/s42-agent/`; Windows, APPDATA/LOCALAPPDATA.
Con `--config`, las sesiones quedan en `sessions/` junto a ese archivo.
`--provider`, `--model` y `--session` permiten selecciones explícitas.

El proceso hereda el entorno y el comportamiento de carga de Bun al iniciarse;
`--cwd` fija el proyecto de las tools, sin cambiar el directorio global del proceso.
Bun puede cargar archivos de entorno existentes. Para usar solamente variables
exportadas: `bun run --no-env-file index.ts`. Consultar
[variables de entorno en Bun](https://bun.com/docs/runtime/environment-variables).
No se modificó `bunfig.toml`; el comportamiento del futuro binario debe verificarse
al distribuirlo, por separado del runtime fuente.

El loop dispone de read/list/search/write/edit/shell, instrucciones AGENTS raíz y
subcarpetas y resultados por llamada. Edit requiere una coincidencia exacta única.
Shell no toma stdin de la TUI; informa stdout/stderr, duración y exit code.
Las tools tienen los permisos del usuario y **efectos reales**; no hay sandbox.
No se hacen acciones Git automáticas salvo instrucciones de la tarea/proyecto.

Config `limits`: 30 pasos, shell/primer evento/inactividad de 120 s inicialmente.
El contexto se estima sin tokenizador: bytes de texto/4 y reserva aproximada de
1024 tokens por imagen. El límite del servidor prevalece; `/new` inicia otro
historial. Cancelar no revierte cambios; una tool interrumpida no se repite al reabrir.

## Validación y estado

```bash
bun run typecheck
bun test
```

[Specs](docs/SPECS.md), [fases](docs/phases/README.md) y
[evidencia del agente](docs/qa/agent-mvp.md). Streaming y coding se comprobaron
con endpoints fixture. Pendientes: modelo local real, mouse/drop físicos, prueba
prolongada y plataformas de distribución. Solo la limpieza de descendientes en
Linux está comprobada; Windows todavía no tiene terminación de árbol implementada.

La apariencia usa azul DOS, gris y turquesa. `COLORTERM=truecolor`/`24bit` activa
RGB; de otro modo usa ANSI16. Respeta `NO_COLOR`, `--no-color` y `TERM=dumb`.
Sin TTY devuelve un mensaje limpio. Renderer por filas modificadas, sin frames idle.

`index.ts` es el entrypoint; `src/app.ts` compone persistencia/LLM/tools con
`src/ui/components/`. `src/llm`, `src/agent` y `src/storage` mantienen contratos
pequeños. No hay dependencias de runtime externas.

Distribución queda para una entrega explícita. Los scripts `build` y `bench:tui`
conservan el hito inicial de la demo; no representan un binario actualizado del agente.


## MCP

**MCP** (Alt+C) administra servidores: alta stdio/HTTP, listado, edición,
eliminación del registro y enabled/disabled. Elegir un servidor permite probar
la conexión y ver sus herramientas. /mcp abre el listado.

Stdio: Name, Command, Args como array JSON, Cwd opcional absoluto y Env refs
como mapa JSON de variable del servidor a variable existente del entorno.
Ejemplo: command `bun`, args `["/ruta/servidor-mcp.ts"]`, envRefs
`{"TOKEN":"MI_TOKEN"}`. HTTP: Name, URL completa (incluye puerto/path /mcp)
y nombre opcional de variable API key Bearer. No se guardan claves literales.

Las herramientas MCP habilitadas se agregan a las nativas por turno, con nombres
únicos. El chat conserva conexión/progreso, calls/resultados y errores. Ctrl+C
cancela HTTP y stdio; cerrar termina servidores iniciados por el harness.
Soporta tools de MCP 2026-07-28 y negociación legacy; no anuncia sampling,
elicitation, OAuth ni interfaces de resources/prompts. [QA](docs/qa/mcp-and-skills.md).

## Skills

**Skills** (Alt+S) permite registrar una carpeta o SKILL.md existente, global o
para el proyecto; listar, ver, habilitar/deshabilitar y quitar del registro.
`name`/`description` se leen con Bun.YAML; name coincide con la carpeta.
El modelo recibe un catálogo breve y carga el cuerpo con la herramienta skill.
`/skill nombre pedido` invoca explícitamente sus instrucciones antes de responder.

**Buscar en skills.sh** consulta el catálogo desde Bun, muestra origen e
instalaciones y permite instalar una skill para el proyecto o globalmente.
Instalar requiere Git en PATH y copia la carpeta completa, scripts/assets/references
y licencias a `skills/` junto a config.json. No requiere npm/npx/Node. Un origen
sin owner/repo GitHub ofrece su enlace y puede registrarse localmente. Quitar del
registro conserva los archivos. Instalar o cargar instrucciones no ejecuta scripts.
