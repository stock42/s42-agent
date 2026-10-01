# QA — Config global, Secrets, Shell y WebView

2026-10-01, Linux x64, Bun 1.4.2. Solo configs/proyectos/credenciales de fixture;
no se alteró la configuración personal. Pull falló por main sin upstream.

## Persistencia

La config personal inspeccionada tenía GLM-4.7-Flash registrado pero defaults
sin modelId. Elegir modelo solo escribía un evento de sesión y las claves TUI
vivían en memoria. La corrección guarda también selección del proyecto/global;
config anterior con catálogo único del proveedor default recupera ese modelo.
No usa red al iniciar ni inventa una selección entre varios modelos.

[global-config-live.json](global-config-live.json): proveedor configurado mediante
el formulario App, API key de fixture guardada en el llavero real con Bun.secrets,
modelo elegido, cierre y reapertura de index.ts en un proceso PTY nuevo 100×30.
El chat recuperó modelo sin setup, envió prompt y recibió respuesta HTTP/SSE
fixture autenticada con la clave recuperada. GET /models solo al configurar;
POST /chat/completions tras reinicio. Clave enmascarada, ausente de config/sesiones,
exit 0. Se eliminó el secreto y la carpeta temporal al terminar. Este flujo prueba
persistencia/autenticación, no calidad de inferencia de un modelo real.

Tests de storage cubren rutas XDG/AppData/Application Support, variables vacías,
override --config, config anterior, selección/defaults, sesiones/proyectos nuevos
y reapertura. Tests de credentials/providers usan backend mock para CI sin llavero:
update/delete, separación de nombres, prioridades, fallback de entorno, 401,
fallos del backend, ausencia de valores en JSON/sesiones y estado guardada en UI.
PTY de providers usa variable de fixture para no depender de libsecret en CI.

## Comandos

Shell usa $ de bun en un proceso del propio entrypoint. Pruebas reales de pipes,
redirecciones, Unicode, cwd, exit 7, stdout/stderr abundantes, timeout y cancelación
de un descendiente (su PID queda muerto/zombie, no ejecutándose). Argv interno con
$(touch injected), comillas y punto y coma llega literal; no crea el archivo.
Regresión coding de CLI/TUI sigue leyendo/editando y ejecutando Bun mediante shell.
Git y nvidia-smi reutilizan runCommand; instalación desde GitHub externa no se
repite como parte de esta tarea. MCP stdio mantiene su subprocess/RPC bidireccional.

Bun Shell no es compatible con toda la sintaxis Bash/cmd: `>&2` y background `&`
no funcionan; prueba de stderr usa `1>&2`, y la cancelación usa un descendiente
creado por Bun. Captura del padre acotada; buffer interno Shell no tiene límite
configurable aquí. No se verificaron binarios; rama standalone queda implementada.

## Scraping

tests/scrape.test.ts usa Chrome instalado y HTTP local real: elemento creado por
JS después de load, título, texto Unicode, HTML y enlaces absolutos; contenido
grande recortado sin romper JSON/UTF-8, 30 enlaces con 25 retenidos. URL file://,
argumentos/selector inválidos, timeout y señal abortan; una call posterior funciona.
Bun cierra cada vista; comparte navegador hasta el finally de index.ts. Cerrar
closeAll tras cada call produjo una carrera del backend Chrome al recrearlo;
se corrigió respetando el navegador compartido hasta la salida del agente.
No conexión al perfil personal ni descargas automáticas. El test de navegador se
omite explícitamente en entornos sin un ejecutable detectado; aquí sí se ejecutó.

## Checks y alcance

- bun run typecheck: correcto.
- bun test: **150 pass, 0 fail**, 32 archivos, 2733 assertions, 18.52 s.
- Revisión final focalizada de providers/CLI/storage/scrape/terminal luego del
  hint guardada del formulario: **22 pass, 0 fail**, más typecheck.
- Rutas de Windows/macOS cubiertas por lógica; llavero/browser y cancelación
  reales de esos SO pendientes. Sin builds, push, release ni dependencias nuevas.

Fuentes consultadas: [Bun Secrets](https://bun.com/docs/runtime/secrets),
[Bun Shell](https://bun.com/docs/runtime/shell) y
[Bun WebView](https://bun.com/docs/runtime/webview). Secrets/WebView son APIs
experimentales pedidas explícitamente; en Linux el llavero necesita Secret
Service, y WebView requiere un navegador Chrome-family instalado.
