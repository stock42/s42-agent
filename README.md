# s42-agent

A coding harness built with Bun, a QBasic-style terminal interface and support
for local LLMs. Open source under the [MIT license](LICENSE).

Un agente de coding pequeño, rápido y estable, escrito en **TypeScript/Bun**,
con mouse, colores y cero dependencias de runtime externas. La conversación es
de solo lectura y el prompt queda siempre visible. Cada proyecto tiene su pestaña
y puede seguir trabajando mientras usás otro.

## Empezar

Necesitás **Bun 1.4.2** y un terminal ANSI de al menos **60×16**; recomendado
80×24. El servidor LLM se configura aparte.

```bash
git clone https://github.com/stock42/s42-agent.git
cd s42-agent
bun install --frozen-lockfile
bun run dev
```

1. Registrá un proyecto en **Projects → Agregar proyecto**: solo **Name** y
   **Folder**. **Explorar** permite elegir la carpeta con mouse o teclado.
2. Abrí **Models → Proveedores** y elegí **llama.cpp** o **DeepSeek**. Completá
   la configuración, consultá el catálogo y seleccioná el modelo.
3. Escribí en **Prompt**. **Enter** envía; **Shift+Enter** agrega una línea.
4. La respuesta, el razonamiento recibido y las llamadas/resultados de herramientas
   aparecen en el chat del proyecto. **Ctrl+C** cancela su turno.

```bash
bun run index.ts --cwd /ruta/proyecto
bun run index.ts --project nombre
bun run index.ts --config /ruta/config.json
bun run index.ts --help
```

## Menús

| Menú | Qué contiene |
| --- | --- |
| Archivo | Explorador de archivos, adjuntos y salida. |
| Projects | Abrir/agregar/editar/quitar proyectos, sesiones y pestañas. |
| Models | Proveedores, catálogo, selección/configuración de modelos y defaults. |
| Promptings | Biblioteca, nueva plantilla y guardar el prompt actual. |
| Tools | CRUD/activación de MCP, registro/activación de Skills y buscador skills.sh. |
| Vista | Respuestas/prompt, foco, auxiliares, paletas y modo Vim. |
| Ayuda | Atajos, mouse y comandos. |

El agente abre directamente este espacio de trabajo. El laboratorio de componentes
se ejecuta aparte con `bun run index.ts --demo`.

## Proyectos y pestañas

**Projects → Abrir proyecto**, **Ctrl+P** o **+** en la barra abre otra pestaña.
Elegir un proyecto que ya está abierto vuelve a su pestaña. Hay una por proyecto,
con conversación/sesión, borrador, adjuntos, modelo, modo Vim y posición de lectura
propios. El editor central muestra el nombre del proyecto.

- Cambiá con clic, **Alt+←/→** o **Alt+1…9**. Las flechas y la rueda de la barra
  permiten recorrer pestañas que no caben en el terminal.
- `~` señala un proyecto con un turno activo. Podés enviar en otro proyecto;
  cada turno conserva su modelo, carpeta y sesión, incluso en segundo plano.
- **Ctrl+C** o **Cancelar** interrumpe solo el proyecto activo. Si hay otros
  trabajando, Ctrl+C desde una pestaña inactiva no cierra el programa.
- **×**, **Ctrl+W** o **Projects → Cerrar pestaña** guarda el borrador y libera
  su sesión. Cancelá un turno activo antes de cerrar esa pestaña. Ctrl+W sobre
  un diálogo/auxiliar cierra esa ventana.
- **Nueva sesión** y **Sesiones** cambian el historial de la pestaña actual.
  Requieren que ese proyecto esté inactivo; otros proyectos pueden seguir respondiendo.
- Las pestañas abiertas y el proyecto activo se restauran al iniciar. Cerrar todas
  deja el espacio vacío; el registro de proyectos, carpetas e historiales se conserva.
- **Ctrl+Q** cancela los turnos de todos los proyectos, guarda borradores y sale.

## Proveedores y modelos

| Proveedor precargado | Endpoint inicial | Credencial |
| --- | --- | --- |
| llama.cpp — default | `http://127.0.0.1:8080/v1` | Sin clave inicialmente. |
| DeepSeek | `https://api.deepseek.com` | API key de sesión o `DEEPSEEK_API_KEY`. |

**Models → Proveedores** permite editar host, puerto y credencial. Guardar uno de
estos presets consulta `/models` y abre el catálogo para elegir el modelo. Los
errores de conexión o autenticación quedan en el formulario. El catálogo se consulta
por esa acción, sin requests al iniciar. No se inventan IDs de modelos.

**Nuevo proveedor** ofrece los presets y **Otro proveedor** para endpoints
compatibles con Chat Completions. La clave escrita vive en memoria durante la
ejecución; para reutilizarla se guarda el nombre de una variable de entorno.
No se crean `.env.local` ni se guardan claves en las sesiones.

**Configurar modelo** permite indicar ID/nombre, endpoint/puerto, credencial,
contexto, máximo de salida y capacidades `Tools / imágenes` (`sí/no`, `no/no` o
`sí/sí`). Habilitá herramientas solo si el modelo y su chat template las soportan.
Los valores configurados se conservan al redescubrir el catálogo. DeepSeek usa
la [API oficial de modelos](https://api-docs.deepseek.com/api/list-models/).

La elección es por pestaña/sesión; se pueden guardar defaults globales o del
proyecto. Un historial con imágenes requiere un modelo que las acepte o una
sesión nueva. Sin modelo seleccionado, el chat lo indica y conserva el borrador.

### Servidor llama.cpp

El agente no descarga modelos ni inicia el servidor. Para un GGUF disponible:

```bash
llama-server -m /ruta/modelo.gguf --host 127.0.0.1 --port 8080 --alias local-coder --jinja
```

Elegí `local-coder` desde el catálogo y configurá los límites de tu servidor.
El tool calling requiere un template compatible; consultá el
[servidor oficial de llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md).

## Promptings con metavariables

**Promptings → Biblioteca**, **Alt+T** o `/promptings` abre el CRUD de plantillas.
Cada prompting tiene nombre y texto multilínea; **Guardar prompt actual** toma el
borrador como texto inicial. La biblioteca es global, disponible en todos los proyectos.

```text
Revisá {{archivo}} en {{lenguaje}}.
Usá este contexto:
{{contexto}}
Incluí {{archivo}} en el resumen.
```

Elegí **Cargar en el editor** para revisar o **Ejecutar con modelo actual** para
enviar. La TUI pregunta una vez por cada nombre distinto, en orden de aparición.
**Anterior/Siguiente** conservan respuestas; **Enter** avanza/aplica,
**Shift+Enter** agrega línea y **Esc** cancela sin cambiar el borrador.

Los nombres usan letras ASCII, números y `_`, empezando con letra o `_`; también
se acepta `{{ archivo }}`. Los valores pueden ser vacíos, Unicode o multilínea.
La sustitución es literal, de una sola pasada: `$&` y `{{otra}}` dentro de un valor
se conservan. La plantilla guarda sus metavariables; el texto resuelto queda en
el borrador/historial habitual. En el editor, Enter en Nombre pasa al texto y
Enter en Texto guarda.

## Archivos, chat y herramientas

**Archivo → Explorador** o **Ctrl+E** permite navegar por padre, raíz y rutas
escritas, incluyendo fuera del proyecto. Enter/doble clic abre carpetas o previews
de texto en solo lectura; rueda, flechas y `h/j/k/l` navegan. Preview hasta 64 KiB;
los binarios muestran su tipo. Adjuntar no cambia el cwd de las herramientas.

Pegar/arrastrar rutas prepara adjuntos. **Ctrl+F** o `/attach ruta` permite revisar,
agregar o quitar. En terminales sin bracketed paste, el primer Enter reconoce rutas
existentes y adjunta; el siguiente envía. Los bloques de código quedan como texto.
Texto UTF-8 hasta 1 MiB; PNG/JPEG/WebP hasta 5 MiB si el modelo acepta imágenes.
Máximo 10 archivos y 10 MiB incluyendo base64. Si un adjunto cambia, revisar su
versión actualizada antes de volver a enviar. El historial conserva lo enviado.

Las herramientas nativas son **read/list/search/write/edit/shell**. Edit exige
una coincidencia exacta única; shell devuelve stdout/stderr, duración y exit code.
Se leen instrucciones AGENTS del proyecto y sus subcarpetas. Las herramientas
tienen los permisos del usuario y efectos reales; no hay sandbox. Cancelar no
revierte cambios ni reejecuta herramientas interrumpidas al reabrir.

El chat muestra razonamiento solo cuando el proveedor envía `reasoning_content`
o `reasoning`. Muestra argumentos parciales de tool calls, ejecución y resultados;
solo ejecuta llamadas completas. Selección, scroll y lectura permanecen disponibles.

### MCP

**Tools → MCP** o **Alt+C** permite listar, agregar, editar, eliminar del registro,
habilitar/deshabilitar y probar servidores. Stdio: nombre, command, args JSON,
cwd opcional y referencias a variables de entorno. HTTP: nombre, URL y variable
de API key opcional. Las tools habilitadas se cargan por turno; conexión, calls,
resultados y errores aparecen en el chat del proyecto correspondiente.

MCP stdio requiere el comando del servidor instalado. Se soportan tools y
negociación de protocolo; sampling, elicitation, OAuth y resources/prompts no están
implementados. [Contrato y QA](docs/qa/mcp-and-skills.md).

### Skills

**Tools → Skills** o **Alt+S** registra carpetas/SKILL.md globales o por proyecto,
permite leerlas, activarlas/desactivarlas y quitar el registro. El modelo recibe
un catálogo breve y carga el cuerpo mediante la tool skill.
`/skill nombre pedido` invoca sus instrucciones explícitamente.

**Buscar en skills.sh** muestra nombre, origen e instalaciones; permite instalar
desde GitHub para el proyecto o globalmente. Requiere Git y conserva carpeta,
recursos y licencias. No requiere npm/npx/Node. Instalar o cargar instrucciones
no ejecuta scripts; quitar el registro conserva los archivos.

## Teclado y apariencia

| Acción | Atajo |
| --- | --- |
| Enviar / nueva línea | Enter / Shift+Enter; Ctrl+J como alternativa. |
| Proyecto / modelo / proveedor / sesión | Ctrl+P / Ctrl+O / Ctrl+B / Ctrl+R. |
| Pestaña anterior/siguiente / selección directa | Alt+←/→ / Alt+1…9. |
| Adjuntos / explorador | Ctrl+F / Ctrl+E. |
| Promptings / MCP / Skills | Alt+T / Alt+C / Alt+S. |
| Cambiar panel / foco | Ctrl+N / Tab o Shift+Tab; también clic. |
| Menú / ayuda | Esc desde NORMAL / Alt+Y. |
| Cerrar pestaña o auxiliar / salir | Ctrl+W / Ctrl+Q. |

Vim inicia en **INSERT**. Esc pasa a NORMAL; en el prompt: `h/j/k/l`, `w/b`,
`0/$`, `i/a/I/A`, `x`, `dd`, `u`. En el chat: `j/k`, Ctrl+D/U, `gg/G` para scroll.
Espacio seguido de `p/m/s/e/f/c/k/t/?` abre proyecto/modelo/sesión/explorador/
adjuntos/MCP/Skills/Promptings/ayuda. Menús/modales tienen prioridad sobre Vim.
No se asignan acciones a F1–F12.

**Vista → Paleta de colores** cambia en vivo y guarda **QBasic**, **Grises** o
**Verdes**. **Vista → Activar / desactivar Vim** configura el modo. Se respetan
`NO_COLOR`, `--no-color` y `--no-mouse`; RGB con `COLORTERM=truecolor`, fallback
ANSI16 para otros terminales. Renderer por filas modificadas, sin frames idle.

Comandos: `/help`, `/projects`, `/models`, `/providers`, `/sessions`, `/files`,
`/new`, `/promptings`, `/mcp`, `/skills`, `/skill nombre pedido`, `/attach ruta`,
`/detach`, `/quit`. Tab completa comandos y rutas de `/attach` con candidato único.

## Configuración y persistencia

Linux respeta XDG: config en `~/.config/s42-agent/config.json` y sesiones en
`~/.local/state/s42-agent/sessions/`. macOS usa `~/Library/Application Support/s42-agent/`;
Windows, APPDATA/LOCALAPPDATA. Con `--config`, sesiones en `sessions/` junto al JSON.

Configuración: proyectos/proveedores/modelos, MCP/Skills/Promptings, defaults,
`workspace.openProjectIds`, `lastProjectId`, paleta y bindings. Las sesiones JSONL
guardan mensajes, selección, borrador y eventos, con un lock por sesión.
`--provider`, `--model` y `--session` permiten selecciones explícitas al iniciar.

Bindings opcionales por acción conocida, con colisiones rechazadas:

```json
"ui": {
  "vimMode": true,
  "color": "auto",
  "palette": "qbasic",
  "bindings": {
    "global": { "projects": "ctrl+g" },
    "normal": { "projects": "leader+g" }
  }
}
```

Acciones: `projects`, `models`, `providers`, `sessions`, `attachments`, `explorer`,
`mcp`, `skills`, `promptings`, `help`. Atajos de edición/foco/lifecycle permanecen
reservados. Límites iniciales: 30 pasos y 120 s para shell/primer evento/inactividad.
El contexto se estima sin tokenizador; prevalece el límite del servidor.

Bun hereda el entorno y puede cargar archivos existentes; `--cwd` fija la carpeta
de las tools, sin cambiar el directorio global del proceso. Para usar solo variables
exportadas: `bun run --no-env-file index.ts`. [Specs](docs/SPECS.md).

## Desarrollo y distribución

```bash
bun run typecheck
bun test
bun run build             # Opcional: compila el binario del host en dist/s42-agent.
```

El binario contiene el runtime Bun; el servidor/modelo LLM y los programas que
usen shell/MCP siguen siendo externos. `build:targets` genera otros targets, pero
cross-compilar no demuestra que corran en destino. La TUI y las pestañas se validan
desde la fuente en Linux con PTY y fixtures. Hay evidencia previa de GLM real;
mouse/drop físicos y runtime macOS/Windows/arm64 siguen pendientes.

[QA de pestañas/menús](docs/qa/project-tabs.md), [QA integral](docs/qa/final-validation.md),
[fases](docs/phases/README.md), [CHANGELOG](CHANGELOG.md).

Para contribuir: [CONTRIBUTING.md](CONTRIBUTING.md). Preparación de publicación:
[PUBLISHING.md](docs/PUBLISHING.md). Licencia: [MIT](LICENSE).
