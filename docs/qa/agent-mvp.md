# QA del harness — fuente Bun

Fecha: 2026-10-01. Linux x64, Bun 1.4.2, TypeScript 7.0.2. Sin builds nuevos.
Implementación comprobada con `bun run typecheck`, tests y pantallas tmux;
**no se utilizó un modelo real**. Las capturas son de endpoints fixture o del
estado sin configuración. Typecheck correcto; suite completa: **62 pasan, 0 fallan,
573 assertions**, 11 archivos, 11,50 s. Tras ajustar etiquetas de bindings, las
7 pruebas de Vim/adjuntos/entrypoint pertinentes también pasan. [Capturas textuales](agent-mvp-captures.txt).

## Recorridos ejecutados

- `tests/app-terminal.test.ts` inicia **index.ts normal**, no la demo, en un PTY
  80×24 con config/carpeta temporales. Desde Models configura ID, host, puerto,
  API key, contexto y capacidades mediante inputs/Tab/Siguiente/Guardar.
  Comprueba aviso sin modelo, clave usada en HTTP pero ausente de config,
  Shift+Enter, lectura/edición/shell con fixture, archivo `2 + 2` verificado,
  cancelación que conserva el parcial y borrador reabierto con historial.
- `tests/projects-integration.test.ts`: A/B con endpoints distintos y el mismo ID
  de modelo, adjuntos separados, edit/shell de cada carpeta, cancelación y
  reanudación. Verifica archivos/historial/borradores/selección sin mezclar contexto.
- `tests/storage.test.ts`: proyectos A/B y borradores independientes, config
  inválida preservada, append, sesión corrupta/línea incompleta. Un segundo
  **proceso Bun** obtiene el lock; abrir concurrentemente se rechaza y matar
  ese proceso permite reabrir sin repetir una herramienta interrumpida.
- `tests/llm.test.ts`: SSE partido byte a byte (Unicode/CRLF), llamadas
  intercaladas, truncamiento parcial, endpoints distintos con el mismo modelo y
  credenciales diferentes, HTTP 401/404/429/503, idle y cancelación.
- `tests/agent.test.ts`: fixture HTTP lee/edita/verifica un archivo mediante Bun;
  edición sin coincidencia o ambigua no cambia el archivo. JSON inválido/tool
  desconocida no produce escritura. Stdout/stderr abundantes se drenan,
  timeout y cancelación detienen el grupo de procesos y su hijo en Linux.
  Límite de pasos devuelve resultados por ID; AGENTS raíz/subcarpeta se carga
  sin mezclar instrucciones de proyectos diferentes.
- `tests/attachments-vim.test.ts`: rutas POSIX con escapes/comillas, Unicode,
  Windows/UNC y file URLs; texto arbitrario no se convierte en adjunto.
  Paste en NORMAL conserva contenido sin ejecutar Vim/enviar. Undo, prioridad
  modal, respuesta read-only, incompatibilidad de imagen, cambio de archivo antes
  del envío y snapshot reabierto tras borrar el original. Enter sobre una ruta
  absoluta adjunta; layout compacto conserva fila de adjuntos y Shift+Enter.
- Suites TUI previas: Unicode/selección, SGR mouse inyectado, frames modificados,
  resize 60×16/80×24/120×40, no-color, cleanup y **10 s idle sin nuevos bytes**.

## Inspección de pantallas

Capturas tmux 3.4 desde fuente, con datos temporales:

1. Chat sin modelo: aviso dentro del panel central; proyecto en el título.
2. Models: formulario paginado y compacto, inputs sin corchetes, título/cierre,
   navegación y guardar, prompt separado visible en 80×24 y 60×16.
3. Conversación fixture: lectura real del archivo temporal y respuesta con
   Markdown básico. Entrada nueva únicamente en Prompt.
4. Adjuntos preparados: nombre/tamaño, prompt y estado visibles en 60×16.

Hallazgos corregidos durante este trabajo: Enter sobre rutas absolutas se
interpretaba como comando; un paste asíncrono podía desordenarse con texto nuevo;
la sesión reabierta mostraba siempre el principio; la ayuda extensa no tenía scroll; los errores sin historial se
ocultaban bajo el contexto; el texto largo cortaba Shift+Enter y los adjuntos
solapaban el prompt compacto. Los tests pertinentes ahora cubren esos recorridos.

## Límites de esta evidencia

- La prueba HTTP usa fixtures deterministas, no inferencia ni GGUF real.
  El endpoint default no respondió; el usuario pidió configurarlo desde Models.
  No se descargó ni se eligió un modelo por inferencia.
- PTY/tmux y secuencias SGR no prueban mouse físico, Shift+Enter del emulador del
  usuario ni drag & drop desde el explorador. Rutas Windows/macOS simuladas no
  son ejecución en esas plataformas.
- Terminación del grupo comprobada en Linux. En Windows se mata el proceso
  directo; falta implementar/verificar terminación de descendientes.
- La estimación del contexto no es un tokenizador; tampoco mide el costo real
  de imágenes. Prevalecen errores/límites del servidor.
- No se ejecutaron aquí prueba de 30 minutos, nuevos benchmarks, binarios,
  targets de distribución ni un host sin Bun/Node.
- Commits locales. `git pull` se intentó antes de cada tarea y falló porque `main`
  no tiene upstream. No se afirma sincronización ni publicación.

Referencias usadas para contratos: [fetch de Bun](https://bun.com/docs/runtime/networking/fetch),
[filesystem](https://bun.com/docs/runtime/file-io),
[procesos](https://bun.com/docs/runtime/child-process),
[Markdown](https://bun.com/docs/runtime/markdown),
[servidor llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md).
