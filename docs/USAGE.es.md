# Manual de S42 Agent

[English](USAGE.md) · **Español** · [Presentación del proyecto](../README.es.md)

Un agente de coding pequeño, rápido y estable, escrito en **TypeScript/Bun**,
con mouse, colores y cero dependencias de runtime externas. La conversación es
de solo lectura y el prompt queda siempre visible. Cada proyecto tiene su pestaña
y puede seguir trabajando mientras usás otro.

## Empezar

Para ejecutar desde fuente necesitás **Bun 1.4.2**. Para la TUI, un terminal ANSI de al menos **60×16**;
recomendado 80×24. El servidor LLM se configura aparte.
Consultá la [instalación](../README.es.md#instalación) para los binarios y
[configuración de Bun](../README.es.md#ejecutar-desde-código-fuente) para el entorno fuente.

```bash
git clone https://github.com/stock42/s42-agent.git
cd s42-agent
bun install --frozen-lockfile
bun run dev
```

La UI inicia en español. **Vista → Language → English** cambia al inglés.

1. Registrá un proyecto en **Projects → Agregar proyecto**: solo **Nombre/Name** y
   **Carpeta/Folder**. **Explorar** permite elegir la carpeta con mouse o teclado.
2. Abrí **Models → Proveedores** y elegí **llama.cpp** o **DeepSeek**. Completá
   la configuración, consultá el catálogo y seleccioná el modelo.
3. Escribí en **Prompt**. **Enter** envía; **Shift+Enter** agrega una línea.
4. La respuesta, el razonamiento recibido y las llamadas/resultados de herramientas
   aparecen en el chat del proyecto. **Ctrl+C** cancela su turno.

```bash
bun run index.ts --cwd /ruta/proyecto
bun run index.ts --project nombre
bun run index.ts --config /ruta/agent.sqlite
bun run index.ts --help
```

## Ejecutar desde la command line, sin TUI

`--prompting` activa el modo CLI con el mismo loop, instrucciones del proyecto,
tools nativas, MCP, skills y recuperación por etapas que usa la TUI. Funciona
sin terminal interactivo y permite redirigir los resultados para comparar pruebas.

```bash
bun run index.ts \
  --cwd /ruta/proyecto \
  --llm_server http://127.0.0.1 \
  --llm_port 8080 \
  --prompting "Desarrolla un juego de Tetris en un archivo HTML" \
  --reasoning off \
  > respuesta.md 2> ejecucion.log
```

| Argumento | Comportamiento |
| --- | --- |
| `--prompting "texto"` | Ejecuta un turno y termina; admite texto multilínea. |
| `--llm_server host_o_url` | Host o URL base HTTP/HTTPS. Host sin path usa `/v1`; una URL con path conserva ese path. |
| `--llm_port puerto` | Sobrescribe el puerto; entero de 1 a 65535. |
| `--llm_apikey "clave"` | Bearer de esta ejecución, en memoria; opcional para llama.cpp sin autenticación. |
| `--model id` | ID explícito. llama.cpp consulta `/props` para contexto/tools reales; modelos editados manualmente conservan sus valores. Sin metadata de salida, el servidor decide; no se inventan capacidades de tokens. |
| `--reasoning on\|off` | Muestra/oculta razonamiento recibido en stderr. Por defecto usa la preferencia de config; no cambia cómo razona el modelo. |
| `--cwd carpeta` / `--project nombre_o_id` | Carpeta de trabajo o proyecto registrado; sin ambos, trabaja en la carpeta actual. |
| `--provider id`, `--config archivo` | Seleccionan proveedor y configuración existentes. |
| `--session id` | Continúa una sesión de esa carpeta/proyecto; por defecto crea una nueva. |

Los argumentos también admiten `--opción=valor`. Sin `--model` utiliza el modelo
elegido en la sesión/proyecto o el primero registrado/disponible en `/models`.
Modelos descubiertos habilitan tools; el servidor debe soportar tool calling.
Al cambiar el endpoint con flags consulta el catálogo nuevo y usa la clave
explícita, conservando la configuración guardada. Un ID explícito no requiere
`/models`. Sin overrides usa llama.cpp o el proveedor configurado y su llavero
o variable de credencial existente. Cambiar el endpoint descarta también la
referencia al secreto anterior; --llm_apikey sigue siendo un override en memoria.

**stdout** recibe la respuesta en streaming. **stderr** recibe razonamiento si
está activo, ejecución/resultados de tools, avisos, ruta de sesión y tokens E/S
con promedio tok/s. Los eventos, parciales y razonamiento se guardan en las
sesiones habituales. El modo CLI no cambia config, registro de proyectos,
pestañas ni borradores de la TUI; una carpeta no registrada usa un ID estable.
Para reabrir una ejecución con endpoint temporal, repetí sus flags.

Código de salida: **0** completado, **1** error, **130** cancelado con Ctrl+C
(SIGINT), **143** SIGTERM. Cancelar libera la sesión y conserva los efectos ya
realizados. Sin `--prompting` se mantiene el arranque habitual de la TUI.

## Menús

| Menú | Qué contiene |
| --- | --- |
| Archivo | Explorador de archivos, adjuntos y salida. |
| Projects | Abrir/agregar/editar/quitar proyectos, sesiones y pestañas. |
| Models | Proveedores, catálogo, selección/configuración de modelos y defaults. |
| Promptings | Biblioteca, nueva plantilla y guardar el prompt actual. |
| Tools | WebServer del proyecto, catálogo nativo, CRUD/activación de MCP, Skills y buscador skills.sh. |
| Vista | Respuestas/prompt, indicadores CPU/RAM/disco/VRAM, foco, auxiliares, paletas, idioma, razonamiento y modo Vim. |
| Ayuda | Atajos, mouse, comandos y About con autor, MIT y versión. |

El agente abre directamente este espacio de trabajo. El laboratorio de componentes
se ejecuta aparte con `bun run index.ts --demo`.

## Proyectos y pestañas

**Vista → Git** abre Cambios, Historial, Ramas y CHANGELOG del proyecto activo
en el editor central, conservando el prompt visible. Elegí un archivo para leer
su diff; **Índice / archivo** alterna staged y working tree. Elegí un commit
para consultar su patch real, autor y fecha. Flecha abajo/rueda carga más
historial, sin máximo total de commits. **Refrescar** consulta el estado local.
Las referencias remotas y ahead/behind son los valores conocidos localmente;
abrir el panel no ejecuta fetch, pull ni push. Git requiere instalación externa.
Se muestran raíz real, Git/repositorio ausente, HEAD sin commits/separado y
CHANGELOG ausente. El diff es de solo lectura, con selección y scroll.
**Vista → Respuestas** vuelve al chat. Cada proyecto conserva su vista Git y
selección al cambiar de pestaña.

**Projects → Abrir proyecto**, **Ctrl+P** o **+** en la barra abre otra pestaña.
Elegir un proyecto que ya está abierto vuelve a su pestaña. Hay una por proyecto,
con conversación/sesión, borrador, adjuntos, modelo, modo Vim y posición de lectura
propios. El editor central muestra el nombre del proyecto.

- Cambiá con clic, **Alt+←/→** o **Alt+1…9**. Las flechas y la rueda de la barra
  permiten recorrer pestañas que no caben en el terminal.
- `P:nombre` identifica proyectos y `F:archivo` identifica archivos. Cada proyecto
  activo anima su indicador `| / - \` en la pestaña, incluso viendo otro proyecto
  o un archivo. Podés enviar en otro proyecto;
  cada turno conserva su modelo, carpeta y sesión, incluso en segundo plano.
- El título del proyecto muestra una animación durante su turno, incluso antes
  del primer texto. El chat muestra «Agente: Razonando…», «Respondiendo…» o la
  herramienta en ejecución en su propia fila de estado. Prompt conserva el
  borrador, tokens y atajo de nueva línea. Terminar, cancelar o fallar detiene
  la animación; cambiar de pestaña muestra la actividad de ese proyecto.
- **Ctrl+C** interrumpe solo el proyecto activo. Si hay otros
  trabajando, Ctrl+C desde una pestaña inactiva no cierra el programa.
- **×**, **Ctrl+W** o **Projects → Cerrar pestaña** guarda el borrador y libera
  su sesión. Cancelá un turno activo antes de cerrar esa pestaña. Ctrl+W sobre
  un diálogo/auxiliar cierra esa ventana.
- **Nueva sesión** y **Sesiones** cambian el historial de la pestaña actual.
  Requieren que ese proyecto esté inactivo; otros proyectos pueden seguir respondiendo.
- Las pestañas de proyectos y el proyecto activo se restauran al iniciar. Cerrar todas
  deja el espacio vacío; el registro de proyectos, carpetas e historiales se conserva.
- **Ctrl+Q** cancela los turnos de todos los proyectos, guarda borradores y sale.

## Proveedores y modelos

| Proveedor precargado | Endpoint inicial | Credencial |
| --- | --- | --- |
| llama.cpp — default | `http://127.0.0.1:8080/v1` | Sin clave inicialmente. |
| DeepSeek | `https://api.deepseek.com` | Llavero del SO o `DEEPSEEK_API_KEY`. |

**Models → Proveedores** permite editar host, puerto y credencial. Guardar uno de
estos presets consulta `/models` y abre el catálogo para elegir el modelo. Los
errores de conexión o autenticación quedan en el formulario. El catálogo se consulta
por esa acción, sin requests al iniciar. No se inventan IDs de modelos.

**Nuevo proveedor** ofrece los presets y **Otro proveedor** para endpoints
compatibles con Chat Completions. **API key · llavero** guarda la clave mediante
[Bun.secrets](https://bun.com/docs/runtime/secrets) en el almacén de credenciales
del SO; **Variable API key** conserva la alternativa de entorno. La clave se
muestra enmascarada y, al editar, **Guardada · vacío conserva** indica que dejar
el campo vacío reutiliza la guardada. Config guarda solo la referencia; las
sesiones no guardan claves.
En Linux debe estar disponible/desbloqueado GNOME Keyring, KWallet u otro Secret
Service; si falla, el formulario informa el error. No se crean `.env.local`.

**Configurar modelo** permite indicar ID/nombre, endpoint/puerto, credencial
y capacidades `Tools / imágenes` (`sí/no`, `no/no` o
`sí/sí`). Habilitá herramientas solo si el modelo y su chat template las soportan.
Los valores configurados se conservan al redescubrir el catálogo. DeepSeek usa
la [API oficial de modelos](https://api-docs.deepseek.com/api/list-models/).

Elegir un modelo lo recuerda automáticamente en la sesión, el proyecto y el
default global para proyectos nuevos. Cada pestaña conserva su elección. Una
config anterior con un único modelo local registrado lo recupera sin red; con
varios modelos sin elección válida se mantiene el selector. Un contexto activo
con imágenes requiere un modelo que las acepte o una sesión nueva. Las imágenes
ya compactadas en un resumen de texto permanecen en el historial original sin
impedir elegir un modelo de texto. Sin modelo seleccionado, el chat lo indica y
conserva el borrador.

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
escritas, incluyendo fuera del proyecto. Enter/doble clic abre carpetas o archivos
en una **pestaña junto al proyecto**, usando todo el panel central. El título es
el nombre del archivo; la cabecera muestra lenguaje, tamaño y ruta. El Prompt
del proyecto sigue visible. HTML, CSS, JavaScript y TypeScript tienen resaltado
de sintaxis, incluido CSS/JS dentro de HTML. Otros textos se muestran sin colores
de sintaxis y los binarios muestran un aviso.

La vista carga el texto UTF-8 completo, en solo lectura, con selección, scroll,
flechas, rueda y navegación Vim. Abrir el mismo archivo vuelve a su pestaña y
conserva el scroll. Clic, **Alt+←/→** y **Alt+1…9** recorren proyectos y archivos;
**Ctrl+W** o **×** cierra el archivo y vuelve al chat sin cerrar el proyecto.
**Vista → Respuestas** también vuelve al chat. Enviar un prompt devuelve el panel
al chat; una respuesta en segundo plano no reemplaza el archivo que estás leyendo.
Abrir/adjuntar archivos externos no cambia el cwd de las herramientas. Las pestañas
de archivos duran esta ejecución; las de proyectos se restauran al reiniciar.

Chat y archivos incluyen números de línea en un margen separado. Corresponden
a las líneas originales: una línea larga que ocupa varias filas no repite su
número. El margen se adapta al scroll y al tamaño del contenido, sin modificar
el texto del archivo ni los mensajes enviados al modelo. El Prompt no se numera.

El explorador ocupa el área disponible del chat, se adapta al resize y conserva
el prompt visible. Escribí la ruta donde buscar arriba (podés usar la raíz del
disco), un nombre o glob como `*.ts` debajo y pulsá **Buscar** o Enter en ese
campo. Recorre subcarpetas, incluidos ocultos y carpetas de dependencias; devuelve
todos los archivos coincidentes con su ubicación. **Cancelar** detiene la búsqueda. Abrir
y Adjuntar funcionan sobre los resultados; **Ir** vuelve a navegar la ruta.
No sigue enlaces al buscar y muestra cuántas carpetas fueron inaccesibles.

Pegar/arrastrar rutas prepara adjuntos. **Ctrl+F** o `/attach ruta` permite revisar,
agregar o quitar. En terminales sin bracketed paste, el primer Enter reconoce rutas
existentes y adjunta; el siguiente envía. Los bloques de código quedan como texto.
Texto UTF-8 completo; PNG/JPEG/WebP si el modelo acepta imágenes. El agente no
impone cuotas de tamaño o cantidad de adjuntos. Si un adjunto cambia, revisar su
versión actualizada antes de volver a enviar. El historial conserva lo enviado.

Las herramientas nativas son **read/write/edit/list/find/search/fetch/shell**,
con un archivo por tool en `src/agent/tools/` y un catálogo en **Tools → Nativas**.
Incluye también `internal_skill`, `markdown_html` y `websocket`: guías internas
bajo demanda, conversión Markdown→HTML y pruebas ws/wss con headers, mensajes,
cancelación y payloads completos.
`find` busca nombres/globs; `search` busca contenido. `fetch` hace HTTP con
método, headers y body JSON, form URL-encoded, multipart o texto. Edit exige
una coincidencia exacta única; shell devuelve stdout/stderr, duración y exit code.
Los comandos usan [Bun Shell](https://bun.com/docs/runtime/shell), también Git
para instalar skills y nvidia-smi para métricas. Admiten pipes/redirecciones y
builtins sin Bash/cmd externo; la sintaxis es la de Bun (por ejemplo `1>&2`,
sin comandos en background con `&`). Conservan cancelación del árbol, sin timeout.

**scrape** usa [Bun.WebView](https://bun.com/docs/runtime/webview) para leer
páginas renderizadas, incluido JavaScript, con selector CSS, texto/HTML y enlaces.
macOS usa WebKit del sistema; Linux/Windows necesitan Chrome, Chromium, Edge
o Brave instalado. También acepta `BUN_CHROME_PATH`. Sin descargas automáticas;
el browser se inicia al usar la tool y se cierra al salir. [Contrato](TOOLS.es.md).
Se leen instrucciones AGENTS del proyecto y sus subcarpetas. Las herramientas
tienen los permisos del usuario y efectos reales; no hay sandbox. Cancelar no
revierte cambios ni reejecuta herramientas interrumpidas al reabrir.
[Contratos y ejemplos de cada tool](TOOLS.es.md).

El panel **Prompt** muestra siempre **tokens de entrada/salida (E/S) y promedio tok/s**
arriba a la derecha, por ejemplo `Tokens E/S 1200/120 · Prom. 28.5 tok/s · Contexto 12.0%`
(`Avg.` en inglés). No tiene botón Enviar: **Enter envía**, Shift+Enter inserta
una línea y Ctrl+C cancela. El borrador usa todo el ancho bajo los contadores.
Tokens por turno/pestaña incluyen todas sus requests, tools y continuaciones;
se guardan al terminar. Los contadores se actualizan al recibir el uso del
proveedor: llama.cpp envía timings por token y el promedio cambia durante
la generación, desde el primer token. Otros endpoints dependen de la frecuencia
de sus reportes de uso. No se cuentan caracteres ni
deltas SSE como tokens. Conteo incompleto → parcial; dato ausente → **N/D**.
Cantidades grandes se abrevian (`k`, `M`, etc.); la sesión conserva cifras exactas.
Tok/s es el promedio observado: salida reportada dividida por tiempo de las
requests con salida reportada, incluyendo red/primer token y excluyendo tools.

**Contexto** muestra el porcentaje de la ventana del LLM, independiente de los
tokens acumulados del turno. Usa entrada/salida de la última petición cuando el
proveedor las informa. Antes de recibirlas y entre peticiones, **≈** identifica
una estimación local de mensajes, reasoning, adjuntos y schemas de herramientas,
calibrada con el uso reportado. Capacidad desconocida → **N/D**, sin inventar una
ventana. El indicador pertenece a cada proyecto y se restaura con su sesión;
también aparece en el resumen de CLI. En terminales estrechos se abrevian los
contadores para mantener visible el porcentaje.

Al acercarse al **85%** se muestra **Compactando contexto…** y el LLM resume todo
el contexto activo: pedido, restricciones, decisiones, reasoning relevante,
adjuntos, cambios, resultados de tools, errores, validación y pendientes. Si el
material ya supera la ventana, se procesa completo por partes y se integran los
resúmenes; no se recorta el historial. El nuevo checkpoint sustituye ese material
solo en futuras peticiones, conservando el chat original en JSONL/SQLite. Cancelar
o fallar la compactación conserva el checkpoint anterior y los efectos previos.
Las instrucciones del proyecto y los schemas actuales se mantienen al continuar.
Un rechazo específico de contexto puede activar compactación y continuar; otros
errores HTTP no se reintentan automáticamente.

La barra inferior muestra **CPU: % · RAM: usado/total · Disco: usado/total ·
VRAM: usado/total**, en GiB/MiB (`G`/`M`). Se distribuye en las filas necesarias
sin tapar el prompt. **Vista → CPU/RAM/Disco/VRAM: on/off** configura cada
indicador y guarda `ui.resources`. Los tokens permanecen visibles incluso
ocultando todos los recursos; no existe una opción para ocultarlos.
CPU/RAM/disco usan APIs incluidas en Bun, con muestras cada 2 segundos. Disco
corresponde al volumen del proyecto. VRAM usa contadores Linux DRM o, cuando
está instalado, `nvidia-smi` vía Bun Shell. Si el SO/driver no informa VRAM,
muestra N/D; no instala drivers ni programas. En GPU integrada puede no existir
un contador de memoria dedicada.

El chat muestra razonamiento cuando el proveedor envía `reasoning_content`
o `reasoning` y **Vista → Ver razonamiento** está en **on** (predeterminado).
**off** lo oculta en el historial y durante el streaming; volver a **on** permite
leer lo recibido. La sesión conserva ese contenido y las tools siguen visibles. Muestra argumentos parciales de tool calls, ejecución y resultados;
solo ejecuta llamadas completas. Selección, scroll y lectura permanecen disponibles.
stdout/stderr de shell aparece al llegar, incluso si el comando sigue ejecutándose.
La tool devuelve el resultado completo cuando el proceso sale o lo cancelás con
Ctrl+C. Avisos, turnos fallidos/cancelados y reasoning de compactación conservan
su posición original en el chat, también al reabrir la sesión.

Si el modelo alcanza el límite de salida, el agente conserva la respuesta parcial
y le pide dividir el pedido en etapas pequeñas. Cada etapa aparece en el chat;
las siguientes se solicitan mientras el modelo indique trabajo pendiente. Se
conservan la sesión y el modelo; las herramientas ya realizadas
no se vuelven a ejecutar automáticamente y las calls truncadas se descartan.
**Ctrl+C** cancela la etapa activa. Las continuaciones y las herramientas no
tienen tope de pasos ni timeouts del harness. Errores HTTP ajenos a la ventana y
desconexiones reales se informan sin reintentar el turno.

### MCP

**Tools → MCP** o **Alt+C** permite listar, agregar, editar, eliminar del registro,
habilitar/deshabilitar y probar servidores. Stdio: nombre, command, args JSON,
cwd opcional y referencias a variables de entorno. HTTP: nombre, URL y variable
de API key opcional. Las tools habilitadas se cargan por turno; conexión, calls,
resultados y errores aparecen en el chat del proyecto correspondiente.

MCP stdio requiere el comando del servidor instalado. Se soportan tools y
negociación de protocolo; sampling, elicitation, OAuth y resources/prompts no están
implementados.

### Skills

El agente incluye `software-project`, `debug-and-verify` y `create-pdf` en
`src/agent/skills/`. El prompt inicial presenta solo sus nombres/descripciones;
el modelo usa `internal_skill` para cargar una cuando resulta relevante.
No ejecutan scripts al cargar. PDF combina HTML nativo de Bun con un
renderizador instalado (por ejemplo Chrome/Chromium); Bun no imprime PDF por sí
solo.

Estas guías internas conviven con las skills externas configurables:

**Tools → Skills** o **Alt+S** registra carpetas/SKILL.md globales o por proyecto,
permite leerlas, activarlas/desactivarlas y quitar el registro. El modelo recibe
un catálogo breve y carga el cuerpo mediante la tool skill.
`/skill nombre pedido` invoca sus instrucciones explícitamente.

**Buscar en skills.sh** muestra nombre, origen e instalaciones; permite instalar
desde GitHub para el proyecto o globalmente. La búsqueda consulta directamente
[https://skills.sh](https://skills.sh) mediante su API de catálogo; no usa un LLM
para inventar resultados. Requiere Git para instalar y conserva carpeta,
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

Seleccionar texto del chat lo copia automáticamente al portapapeles: al soltar
el mouse, o al seleccionar con Ctrl+A/Shift+flechas. Conserva Unicode y saltos
de línea del texto, sin el margen de numeración ni colores ANSI. Seleccionar
el borrador del prompt no modifica el portapapeles. La copia usa OSC 52 y
requiere que el terminal admita y permita escribir en el portapapeles; un
terminal sin ese soporte puede ignorar la solicitud.

Vim inicia en **INSERT**. Esc pasa a NORMAL; en el prompt: `h/j/k/l`, `w/b`,
`0/$`, `i/a/I/A`, `x`, `dd`, `u`. En el chat: `j/k`, Ctrl+D/U, `gg/G` para scroll.
Espacio seguido de `p/m/s/e/f/c/k/t/?` abre proyecto/modelo/sesión/explorador/
adjuntos/MCP/Skills/Promptings/ayuda. Menús/modales tienen prioridad sobre Vim.
No se asignan acciones a F1–F12.

**Vista → Paleta de colores** cambia en vivo y guarda la selección:

| Paleta | Aspecto |
| --- | --- |
| Clásica · QBasic | Azul DOS y barras grises; predeterminada. |
| Dark · Grafito | Grises neutros, fondo carbón, superficies oscuras y selección plateada. |
| Green · Bosque | Fondo verde profundo, texto suave y acentos menta. |
| [Nord · Ártico](https://www.nordtheme.com/docs/colors-and-palettes/) | Azul pizarra, texto frío y acentos cian. |
| [Dracula · Violeta](https://draculatheme.com/contribute) | Grafito azulado, texto claro y acentos violetas. |
| [Gruvbox · Retro cálido](https://github.com/morhetz/gruvbox) | Grises cálidos, texto crema y acentos ámbar. |

Menús, diálogos, bordes, foco y selección tienen colores por función; cambiar de
paleta conserva pestañas, borrador y sesión. Los IDs `grayscale` y `green` siguen
funcionando en configuraciones anteriores. Las tres nuevas paletas adaptan los
colores originales al escritorio QBasic.

El chat diferencia las etiquetas **Vos** y **Agente** con colores propios:
amarillo y cian en QBasic, tonos adaptados en las otras paletas. El cuerpo conserva
su color de lectura; sin color, las etiquetas quedan resaltadas en negrita.

**Vista → Activar / desactivar Vim** configura el modo. Se respetan
`NO_COLOR`, `--no-color` y `--no-mouse`; RGB con `COLORTERM=truecolor`, fallback
ANSI16 para otros terminales. Renderer por filas modificadas; las métricas se
muestrean cada 2 s y solo se emiten filas cuyo contenido cambió. La demo mantiene
el render por demanda sin muestreo de recursos.

**Vista → Language** permite elegir **Español** o **English** en vivo. Traduce
menús, botones, formularios, ayuda, estados, indicadores y títulos del harness;
los nombres del proyecto, archivos, prompts y respuestas conservan su contenido.
El cambio se aplica a todas las pestañas, incluso durante un turno. Las preferencias
`ui.language` (`es`/`en`) y `ui.showReasoning` se guardan en la configuración y se
restauran al iniciar; las configuraciones anteriores usan español y razonamiento on.
En inglés, el menú se llama **View** y la opción **Show reasoning: on/off**.

**Ayuda → About** presenta el espíritu QBasic del agente, sus herramientas de
coding, proyectos en pestañas, promptings, MCP, skills y elección de modelos.
Incluye la portabilidad con Bun a Windows, Linux y macOS, autoría, licencia MIT y
el [LinkedIn de César Casas](https://www.linkedin.com/in/cesarcasas/).
`Version` se toma de package.json, como `--version`. Disponible en español e
inglés, con scroll, cierre por teclado/mouse y prompt fijo visible.

Comandos: `/help`, `/projects`, `/models`, `/providers`, `/sessions`, `/files`,
`/new`, `/promptings`, `/mcp`, `/skills`, `/skill nombre pedido`, `/attach ruta`,
`/detach`, `/quit`. Tab completa comandos y rutas de `/attach` con candidato único.

## Configuración y persistencia

Configuración e historial usan **SQLite nativo de Bun**, sin servidor ni dependencias:

| SO | Base global |
| --- | --- |
| Linux | `${XDG_CONFIG_HOME:-~/.config}/s42-agent/agent.sqlite` |
| macOS | `~/Library/Application Support/s42-agent/agent.sqlite` |
| Windows | `%APPDATA%/s42-agent/agent.sqlite` (fallback `~/AppData/Roaming`) |

La primera apertura importa automáticamente `config.json` y las sesiones JSONL
anteriores (XDG_STATE_HOME en Linux, LOCALAPPDATA en Windows). Conserva los
originales, modelos, referencias al llavero, historial y borradores. Si hay una
instancia anterior abierta o corrupción en un registro completo, informa el
problema y no confirma la migración; permite corregirlo y reintentar.

`--config /ruta/agent.sqlite` usa una base alternativa; `.db` y `.sqlite3` también.
`--config /ruta/config.json` conserva el formato anterior y `sessions/` junto al
JSON. La carpeta del proyecto no cambia el almacenamiento global.

La base guarda proyectos/proveedores/modelos, MCP/Skills/Promptings, defaults,
pestañas, preferencias y eventos por sesión. WAL permite leer mientras otros
proyectos guardan sus eventos; cada sesión conserva su lock de escritor único.
No se persiste cada token: se guarda el resultado de cada request y turno.
Las API keys permanecen en **Bun.secrets**, la base guarda solo referencias.
`--provider`, `--model` y `--session` permiten selecciones explícitas al iniciar.

Bindings opcionales por acción conocida, con colisiones rechazadas:

```json
"ui": {
  "vimMode": true,
  "color": "auto",
  "palette": "qbasic",
  "language": "es",
  "showReasoning": true,
  "resources": { "cpu": true, "ram": true, "disk": true, "gpu": true },
  "bindings": {
    "global": { "projects": "ctrl+g" },
    "normal": { "projects": "leader+g" }
  }
}
```

Acciones: `projects`, `models`, `providers`, `sessions`, `attachments`, `explorer`,
`mcp`, `skills`, `promptings`, `help`. Atajos de edición/foco/lifecycle permanecen
reservados. El agente no impone límites de pasos, etapas, tiempo, payloads,
archivos, adjuntos ni historial de undo. Los campos legacy `limits` se retiran
al cargar configuración v1; no pueden volver a activar cortes antiguos.
La ventana del modelo es la única restricción de contexto. El agente compacta
antes de agotarla; el proveedor valida el conteo real. No se aplican cuotas de
tokens al turno ni reservas fijas de salida.
llama.cpp detecta contexto/tools/visión mediante `/props` al descubrir modelos y
al enviar. Repara catálogos antiguos “sin tools” cuando la plantilla del servidor
sí las soporta. llama.cpp determina su propia salida; el harness no envía
`max_tokens` para modelos automáticos locales. Los proveedores remotos actualizan
su catálogo automático al enviar un turno: el máximo de salida informado se usa
sin techos agregados por el harness, ajustándolo únicamente al espacio restante
de la ventana. Sin metadata de salida, o si la consulta falla, se omite
`max_tokens` y decide el proveedor; no se reutilizan
los techos inventados de catálogos antiguos. El inicio no consulta la red.
Los parciales de solo razonamiento se
conservan en la sesión y se envían con texto vacío para que DeepSeek acepte el
siguiente pedido. Los errores HTTP incluyen el detalle devuelto por el proveedor.
Editar un modelo en Models fija las capacidades elegidas y deja la salida al
proveedor. El formulario no ofrece cuotas de tokens; los máximos manuales de
configuraciones antiguas no se envían. `write` permite `append: true` para construir archivos por partes; el
prompt del agente indica completar la funcionalidad en disco antes de terminar.

Bun hereda el entorno y puede cargar archivos existentes; `--cwd` fija la carpeta
de las tools, sin cambiar el directorio global del proceso. Para usar solo variables
exportadas: `bun run --no-env-file index.ts`.

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

[CHANGELOG](../CHANGELOG.md) registra los cambios realizados. Los tests y el
smoke de distribución permanecen versionados. Informes locales y scripts de QA
de tareas puntuales se archivan en `private/`; los resultados de distribución
se generan en `dist/`. Ambos directorios están ignorados por Git.

Para contribuir: [CONTRIBUTING.es.md](../CONTRIBUTING.es.md). Preparación de publicación:
[PUBLISHING.es.md](PUBLISHING.es.md). Licencia: [MIT](../LICENSE).


## WebServer para previews del proyecto

1. Activá la pestaña del proyecto, o un archivo suyo que quieras previsualizar.
2. Abrí **Tools → WebServer** (`Alt+O` abre Tools).
3. Indicá un puerto entre 1 y 65535 (inicial: 3000) y pulsá Enter o **Iniciar**.
4. El navegador predeterminado abre `http://127.0.0.1:PUERTO/` o la URL del archivo
   activo dentro del proyecto. El document root siempre es la carpeta registrada
   del proyecto.

Bun sirve los archivos HTML/CSS/JS e imágenes directamente con su tipo MIME.
Una carpeta usa `index.html` cuando existe; de lo contrario muestra un listado
con enlaces. Se puede navegar a otros archivos dentro de esa raíz. Refrescá para
ver cambios guardados: las respuestas no se cachean. No transpila ni ejecuta
backends, ni sustituye el dev server de un framework.

**Aplicar** cambia el puerto y vuelve a abrir la preview. Si el puerto está
ocupado, muestra el error y mantiene el servidor anterior. **Detener** libera
el puerto; **Abrir navegador** vuelve a mostrar la preview sin reiniciar. Si
falla la apertura del navegador, el servidor sigue disponible y la URL queda
en el diálogo. El puerto se conserva mientras el servidor está activo; no hay
inicio automático al reabrir el agente.

Cada proyecto puede tener un servidor en un puerto distinto. Cambiar de pestaña
o cerrar el diálogo no lo detiene; cerrar la pestaña del proyecto, cambiar su
carpeta o salir del agente sí. Cerrar solamente una pestaña de archivo conserva
el servidor del proyecto. Sin proyecto activo se abre el formulario Name/Folder.
