# Changelog

Registrar aquí los cambios realizados en s42-agent. Actualizar el archivo al
cierre de cada tarea e incluirlo en su commit.

## 2026-10-03

### Documentado — Plan v1.0.5

- Creado `docs/v1.0.5.md` con el plan de panel Git e historial, planificación
  persistente, tablero sincronizado con TODO.md, verificación y recuperación,
  autogeneración de AGENTS.md, inicialización Git y pruebas con Chrome.
- Definidos contratos, integración con los módulos actuales, seis etapas,
  dependencias, criterios de aceptación y matriz de validación. Implementación
  pendiente; sin cambio de versión ni generación/publicación de releases.

### Corregido — Herramientas web y continuidad después de compactar

- El prompt y las descripciones indican usar `scrape`/Bun.WebView para resumir
  páginas renderizadas y `fetch` nativo para HTTP/APIs, en lugar de curl/wget.
  Guardar o convertir una respuesta reutiliza su contenido; crear HTML desde
  un CSV usa ese archivo. Shell sigue disponible, sin bloqueo de comandos.
- Nueva tool `session_history`: recupera mensajes originales de la sesión del
  turno aunque hayan quedado fuera del contexto compactado. Incluye búsqueda
  literal, filtro por rol y selección explícita de coincidencias, sin recortes
  automáticos ni acceso a otras sesiones. Catálogo y documentación ES/EN.
- La compactación prioriza los últimos pedidos/respuestas y conserva relaciones
  entre datos, fuentes y archivos; indica recuperar detalles omitidos del
  historial antes de repetir descargas. El historial original se conserva.
- Typecheck y 61 pruebas relevantes correctas (902 assertions), incluidos
  resumen → CSV → HTML con compactación y reapertura en JSONL/SQLite, lectura
  del CSV modificado, aislamiento de proyectos, CLI, TUI en PTY y WebView real
  con contenido JavaScript. Sin builds ni smoke de binarios.
- Prueba adicional con DeepSeek `deepseek-flash` real y una página local cuyo
  contenido se genera con JavaScript: eligió `scrape`, recuperó fuentes con
  `session_history` tras un checkpoint simulado y creó CSV/HTML. Cero requests
  al sitio durante ambas conversiones y sin curl/wget. Evidencia privada en
  `private/qa/`; no equivale a verificar todos los modelos ni el sitio Infobae.
- Registrada la instrucción de no generar ni publicar nuevas releases hasta
  pedido explícito del usuario. Se conserva la versión 0.1.1.

### Agregado — Website de S42 Agent

- Creada la landing de `s42agent.dev` en `wensite/`: diseño oscuro responsive,
  presentación del producto, cuatro capturas reales copiadas sin modificar,
  comandos para Linux/macOS/Windows y ejecución desde fuente. Incluye primer
  inicio, links a GitHub y atribución a César Casas con X y LinkedIn.
- Servidor independiente con Bun 1.4.2, sin dependencias de runtime ni build.
  Lee `WEBSERVER_PORT` del `.env` del directorio; `.env.example` usa 4317.
  Sirve `public/` con GET/HEAD y tipos MIME; configuración y fuentes quedan
  fuera del directorio público. El entrypoint y la TUI del agente se conservan.
- SEO con contenido HTML, canonical, descripción, sitemap, robots, JSON-LD de
  sitio/software/autor, Open Graph y Twitter Cards. Portada ilustrada original
  generada y exportada como JPEG de 1200×630, separada de las capturas reales.
- Typecheck correcto; cinco pruebas HTTP/configuración, 37 assertions y cero
  fallos. Verificados ocho recursos locales, cuatro anclas, JSON-LD, contraste
  de la paleta y copia exacta de capturas. Revisión en navegador de 320 a 1920 px
  sin overflow horizontal, apertura de imágenes completas, desplegables por
  mouse/teclado y feedback de copiado; sin errores ni warnings de consola.
  La lectura del portapapeles del IAB no confirmó el contenido copiado.
- Instrucciones de arranque y publicación en `wensite/README.md`. QA y capturas
  de la web quedan en `private/qa/website/`. DNS, HTTPS y despliegue público no
  se configuraron en esta tarea.

## 2026-10-02

### Documentado — Borrador para el blog de César Casas

- Redactado un artículo en español sobre S42 Agent, con voz de autor, decisiones
  de diseño y alcance de la preview v0.1.1. Contrasta las capacidades con la
  documentación actual y delimita el benchmark histórico v0.1.0 Linux x64.
  El borrador queda en `private/docs/blog/`, fuera de Git y sin publicar en el blog.

### Publicado — Prerelease v0.1.1

- Versión, metadata, instaladores, README y guía de distribución alineados con
  v0.1.1; notas ES/EN reúnen los cambios posteriores a v0.1.0: contexto completo,
  copia automática, shell en vivo, cronología, búsqueda y correcciones DeepSeek.
- Seis ejecutables generados con Bun 1.4.2 para Linux/macOS/Windows x64/ARM64,
  checksums SHA-256 y paquete conjunto. Smoke Linux x64 fuera del checkout y
  sin Bun/Node en PATH verifica CLI/TUI, skills, MCP, edición, shell y restauración.
  El resto de destinos conserva solo evidencia de cross-build.
- Instalación frozen y typecheck correctos; 214 pass/0 fail, 3.397 assertions
  en 42 archivos. Metadata y links apuntan a las nuevas notas; package.json
  mantiene private: true y no se cambia la visibilidad del repositorio.
- Corregida sincronización del test PTY entre respuesta en streaming y estado
  Listo antes de enviar el siguiente prompt; el test de seis WebViews dispone
  de 60 s en runners CI. Son ajustes de QA, sin timeouts nuevos en el agente.
- [v0.1.1](https://github.com/stock42/s42-agent/releases/tag/v0.1.1) publicada
  como prerelease sobre `eaee649`, con los 12 assets. CI y workflow de release
  completados correctamente; este último ejecutó 214 pruebas sin fallos antes
  de construir los seis destinos y validar Linux x64.
- Descargados los 12 assets de GitHub: hashes, tamaños, manifest y contenido
  del tar.gz verificados. Smoke del binario descargado e instalación pública
  sin autenticación correctos en Linux x64, sin modificar el perfil del usuario.

### Corregido — Salida de shell en vivo y cronología del chat

- stdout/stderr llega al chat del proyecto mientras el comando sigue activo,
  sin esperar su salida. Decodifica UTF-8 fragmentado y conserva la salida
  completa al terminar o cancelar; el resultado se persiste una sola vez.
  No agrega timeouts, cuotas ni cortes. Las instrucciones del agente y shell
  indican cerrar timers/sockets/handles de verificadores y mocks de navegador.
- Avisos, turnos fallidos/cancelados y reasoning de compactación se muestran
  en el orden de los eventos, también al reabrir y cambiar idioma. Los fallos
  históricos ya no aparecen después de herramientas del turno actual; se
  conservan mensajes y avisos de recuperación sin duplicar los persistidos.
- search acepta una ruta de archivo además de carpetas, evitando ENOTDIR.
  Mantiene glob, UTF-8, líneas y AGENTS aplicables. Distingue un resultado sin
  coincidencias de una exclusión y aclara que pattern es texto literal.
  Catálogo y manuales ES/EN actualizados.
- Typecheck correcto; 214 pass/0 fail, 3.397 assertions, 42 archivos. Regresiones
  cubren shell aún vivo tras imprimir su resultado, stdout/stderr y Unicode,
  cancelación, proyectos, persistencia, cronología y búsqueda por archivo.
  `bun run dev` en PTY muestra salida antes del cierre, soporta resize y
  restaura terminal con Ctrl+C/Ctrl+Q. No prueba mouse físico del emulador.
- DeepSeek real aceptó 89 mensajes del historial copiado, con 83.530 tokens
  de entrada y sin HTTP 400. En una copia aislada corrigió el verificador real
  que dejaba un intervalo abierto; recuperó un error de sintaxis de Bun Shell
  y completó el turno. Reejecución independiente termina en 15 ms, exit 0,
  sin timeout ni cierre forzado. Prueba DOM simulada, no juego visual en browser.
  Configuración, sesión y archivos personales intactos; evidencia en private/qa.

### Agregado — Copia automática de la selección del chat

- Seleccionar texto de respuestas copia automáticamente al soltar el mouse;
  Ctrl+A y Shift+flechas también copian. Mantiene grafemas Unicode y saltos
  reales, sin numeración, wrap visual ni ANSI. No copia selecciones vacías,
  releases repetidos, arrastres cancelados por un modal ni el borrador del prompt.
- El texto seleccionado se conserva al llegar nuevos fragmentos del LLM.
  Cada pestaña del proyecto conecta su selección al portapapeles del terminal.
  OSC 52 envía el texto completo en UTF-8/base64, sin helpers ni dependencias;
  requiere soporte y permiso de escritura del emulador. Ayuda/manuales ES/EN
  actualizados; no se modifica configuración personal ni se generan binarios.
- Typecheck correcto; 85 pass/0 fail en 13 archivos de TUI, selección, tabs,
  input y terminal. `bun run dev` en PTY recibe una respuesta LLM de fixture,
  selecciona mediante SGR y verifica el payload OSC 52 exacto; Ctrl+A copia
  todo el chat y seleccionar Prompt no emite copia. Cierre restaura terminal.
  PTY no prueba mouse físico ni pegado en una aplicación del SO.

### Agregado — Compactación completa e indicador de ventana de contexto

- Compactación automática al acercarse al 85% de la ventana real del LLM:
  procesa todo el contexto activo, incluyendo instrucciones, reasoning,
  adjuntos, herramientas y sus efectos; material grande se resume por partes
  y se integra antes de continuar. Conserva instrucciones vigentes y schemas.
- El checkpoint reemplaza el material solo en las siguientes peticiones.
  Historial original y reasoning recibido permanecen en JSONL/SQLite;
  cancelación o fallo conserva el checkpoint anterior. Un rechazo específico
  de contexto puede activar compactación; otros errores no se reintentan.
- Prompt muestra Contexto/Context en porcentaje junto a Tokens E/S y tok/s,
  independiente de los contadores acumulados. Usa el reporte de la última
  petición, marca estimaciones calibradas con ≈ y capacidad desconocida con
  N/D. Se restaura por sesión/proyecto, aparece en CLI y cabe al redimensionar.
- Capacidad detectada también para modelos manuales sin ventana conocida.
  El máximo de salida anunciado se ajusta únicamente al espacio restante;
  sin metadata de salida decide el servidor. No se agregan cuotas del agente.
- Typecheck correcto; 205 pass/0 fail, 3.308 assertions, 39 archivos.
  Regresiones cubren contexto completo, integración jerárquica, resultados
  grandes sin repetir efectos, cancelación, persistencia, HTTP 400, ES/EN,
  porcentajes independientes y `bun run dev` en PTY con Unicode/resize/cierre.
- DeepSeek real resumió material sintético de QA conservando objetivo,
  restricciones, efecto previo y validación pendiente: 14.438 tokens de entrada
  y 778 de salida. No prueba una ventana de un millón llena ni el Tetris real.
  Evidencia local en `private/qa/`; sin nuevos binarios ni cambios a la
  configuración o sesión personal.

### Corregido — Retirar cuotas y cortes propios del agente

- Eliminados maxSteps y los timeouts del modelo, descubrimiento, shell, HTTP,
  WebSocket, scraping, MCP, skills y métricas. El turno y sus recuperaciones
  continúan hasta completar, cancelar explícitamente o recibir un error real.
  Configuraciones v1 antiguas se cargan sin reactivar el bloque `limits`.
- Retirados los recortes de lecturas, ediciones, búsquedas, listados, previews,
  Markdown, stdout/stderr, HTTP, WebSocket, scraping y mensajes/resultados MCP.
  Archivos, adjuntos, skills y undo dejan de tener cuotas de tamaño/cantidad.
  Rangos de lectura o cantidades pedidos explícitamente conservan su semántica.
- Models deja de ofrecer Contexto/Máximo salida; valores manuales anteriores
  no se envían como presupuesto de tokens. Solo se utiliza el máximo anunciado
  por el proveedor automático; sin metadata se omite `max_tokens`. Se conservan
  cancelación del árbol de procesos y validaciones de formatos/argumentos.
- Catálogo ES/EN, manuales e instrucciones del proyecto actualizados para
  registrar la política solicitada. Sin dependencias ni builds de distribución.
- Typecheck correcto y suite completa: 194 pass/0 fail. Regresiones ejecutan
  35 acciones y 35 recuperaciones, ignoran timeouts legacy de 1 ms, conservan
  archivos/adjuntos grandes, más de 1.000 resultados, 101 respuestas WebSocket,
  un frame MCP mayor a 8 MiB y más de 100 undo. PTY desde el entrypoint verifica
  formulario, Unicode, herramientas, cancelación y reapertura.
- DeepSeek real aceptó nuevamente el máximo anunciado de 393.216 tokens y
  terminó una respuesta breve con stop. Esta prueba no demuestra un Tetris
  completado ni una generación de ese tamaño. Evidencia local en `private/qa/`,
  sin modificar configuración personal ni la sesión original.

### Corregido — Eliminar techos arbitrarios de tokens

- Retirados los techos automáticos de 2.048, 8.192 y 32.768 tokens y la reserva
  fija de un cuarto del contexto. Los catálogos remotos usan íntegro el máximo
  informado; llama.cpp y proveedores sin metadata de salida deciden en el
  servidor, omitiendo `max_tokens`. Al enviar se actualiza metadata remota;
  catálogos antiguos no reintroducen el techo si la consulta falla. Inicio sin red.
- Eliminado el rechazo de pedidos por una estimación local sin tokenizador.
  El proveedor valida el contexto y conserva sus límites reales; continúa la
  recuperación de parciales cuando el servidor devuelve `finish_reason: length`.
- Contexto y Máximo salida pasan a ser opcionales en configuración y Models,
  sin cifras prefijadas para modelos nuevos. Se respetan valores manuales
  explícitos. Placeholder ES/EN y manuales actualizados. Se conservan el máximo
  configurado de pasos y los timeouts, independientes del presupuesto de tokens.
- Typecheck correcto y suite completa: 188 pass/0 fail, con PTY desde la fuente.
  Regresiones cubren historial íntegro, máximo real, metadata ausente y fallida,
  catálogos antiguos, formulario sin cifras ES/EN y CLI sin `max_tokens` inventado.
- DeepSeek real: catálogo personal antiguo de 2.048 leído sin modificarlo,
  máximo anunciado y enviado 393.216, contexto informado 1.048.576; petición
  aceptada con `finish_reason: stop`. La prueba produjo una respuesta breve,
  no una generación de 393.216 tokens. Evidencia local en `private/qa/`.

### Corregido — Recuperación y presupuesto de salida de DeepSeek

- Reproducido con DeepSeek real el HTTP 400 tras un parcial de solo razonamiento:
  `Invalid assistant message: content or tool_calls must be set`. Esos mensajes
  se envían con texto vacío, conservando íntegro el razonamiento y el historial
  persistido. Recuperación por length y reapertura de sesiones cubiertas.
- El catálogo deja de limitar toda salida a 2.048 tokens: con metadata admite
  hasta 32.768, limitado por el máximo del proveedor y un cuarto del contexto.
  Sin metadata conserva el fallback. DeepSeek actualiza su catálogo automático
  al enviar el turno; se respetan modelos manuales y el inicio sigue sin red.
- Los errores HTTP incluyen el detalle devuelto por el proveedor; prefijos e
  indicaciones ES/EN conservan el texto externo original. Manuales actualizados.
- Typecheck correcto; suite completa inicial: 185 pass/0 fail. Validación final
  de cliente/proveedores/recuperación: 17 pass/0 fail, incluida una regresión para
  catálogos con contexto pequeño. PTY desde la fuente incluido en ambas suites.
- El historial que fallaba es aceptado por DeepSeek con la corrección. Pedido
  Tetris aislado ejecutó escrituras/ediciones sin HTTP 400 ni recuperaciones por
  length; QA detenida por su timeout de 240 s durante verificaciones del juego.
  No se afirma juego terminado/jugable. Evidencia local en `private/`, sin
  modificar configuración personal, sesión original ni publicar nuevos binarios.

### Configurado — Sponsor con PayPal

- Añadido `.github/FUNDING.yml` con el enlace PayPal proporcionado por el usuario
  como destino del botón Sponsor. Sin SDK ni scripts de pagos en el repositorio.
- Enlace comprobado en navegador: formulario `s42-agent`, Donation en USD e
  importe elegido por quien aporta. Validación del YAML y del destino HTTPS.

### Configurado — Bienvenida en GitHub Discussions

- Discussions ya estaba habilitado con seis categorías. Publicada y fijada en
  la portada la [bienvenida EN/ES](https://github.com/stock42/s42-agent/discussions/1)
  en Announcements, con portada del proyecto, instalación, manuales, capturas,
  contribuciones y v0.1.0. Autor: lortmorris.
- README EN/ES incorporan acceso a la comunidad. Categoría, contenido publicado
  y pin comprobados mediante API y navegador; captura local en `private/`.
  Sin cambios de runtime, builds ni visibilidad del repositorio.
- El usuario eligió PayPal para financiación. El fragmento SDK recibido no
  incluye enlace de pago ni hostedButtonId; se pidió ese dato para completar
  FUNDING.yml. No se publicó el SDK como enlace de aportes.

### Publicado — Prerelease v0.1.0

- Publicada [v0.1.0](https://github.com/stock42/s42-agent/releases/tag/v0.1.0)
  como prerelease, sin marcarla latest. Tag sobre `0ae2315`; doce assets:
  seis ejecutables Linux/macOS/Windows x64/ARM64, instaladores Bash/PowerShell,
  licencia, manifiesto, checksums y paquete conjunto tar.gz.
- [CI](https://github.com/stock42/s42-agent/actions/runs/37012524161) y
  [workflow de release](https://github.com/stock42/s42-agent/actions/runs/37012748815)
  completados correctamente. SHA-256 de assets comprobados; paquete descargado
  y sus doce archivos internos cotejados con los assets y la metadata.
- Instalador Linux del paquete descargado probado en carpeta temporal. Smoke
  del ejecutable Linux x64 fuera del checkout y sin Bun/Node en PATH: versión
  0.1.0, TUI, edición, shell, MCP y skill con fixtures; cierre restaurado.
  Otros sistemas fueron cross-compilados; no se probó su ejecución nativa.
- Comprobación actualizada de GitHub detectó repositorio público, con PublicEvent
  del usuario el 1 de octubre. El estado privado de la consulta inicial estaba
  desactualizado. No se modificó la visibilidad; se pidió confirmar la preferencia.
  README y notas EN/ES reflejan la publicación y explican acceso privado condicional.

### Preparado — Administración GitHub y prerelease privada

- Acceso GitHub configurado verificado con permisos de administración sobre
  stock42/s42-agent. El usuario autorizó gestionar packages/releases y eligió
  publicar v0.1.0 como prerelease dentro del repositorio privado.
- Workflow de distribución toma la versión de package.json y sube el tar.gz
  conjunto además de los once assets existentes. Guías EN/ES, notas e
  instrucciones de instalación privada actualizadas; sin cambiar visibilidad.
- CI remoto del commit 96e32f8: primer intento agotó 15 s en WebView; segundo
  intento completado correctamente sin modificar código. Prueba WebView local:
  dos pass, cero fail. Publicación se ejecuta después de validar los assets.

### Actualizado — Push al terminar cada tarea

- Regla Git actualizada por pedido del usuario: pull antes de empezar;
  CHANGELOG, commit y push al terminar, sin solicitar otra confirmación.
  Comprobar que el remoto recibe el commit e informar fallas concretas, sin force.
- Guías de contribución y publicación EN/ES alineadas con el nuevo flujo.
  Publicar releases, cambiar visibilidad y anunciar conserva su autorización
  explícita. Pull correcto; revisión documental y de los commits pendientes.

### Corregido — Documentación pública bilingüe

- Completadas las versiones faltantes: manual detallado inglés, contratos de
  tools y guía de publicación EN/ES, notas de v0.1.0 y galería en español.
  README, CONTRIBUTING y esas cinco guías forman siete pares con navegación
  recíproca; los enlaces de cada idioma apuntan a su propia versión.
- README español incorpora la sección de teclado/idioma/paletas y la tabla de
  tools presentes en inglés. Guías de contribución alineadas con SQLite temporal,
  pruebas de navegador y llavero aislado; indican mantener ambos idiomas.
  Índice de AGENTS actualizado. Sin cambios en fuente, instaladores ni imágenes.
- Validación: 365 enlaces locales/de fuente y 14 anchors; las 16 URLs absolutas
  de las notas resuelven a archivos del árbol preparado para el tag. Siete pares
  con igual cantidad de secciones y bloques de código; Markdown renderizado para
  los 14 documentos. Galerías conservan las mismas imágenes originales.
- Cuatro tests del plan de release correctos y plan local con seis binarios/once
  assets verificado. Pull correcto; sin rebuild, push ni publicación.

### Mejorado — Portada e instalación en README

- README inglés/español con título y navegación centrados, cinco badges y
  portada de assets/github/social-preview.jpg. La ilustración está identificada;
  las capturas reales y la galería quedan después de instalación y primer uso.
- Instalación oficial de Bun con curl/Bash y PowerShell, más opción desplegable
  para fijar Bun 1.4.2. Comandos simples de los instaladores Bash/PowerShell
  existentes, enlaces a sus archivos y alternativa local desde dist/.
- URLs públicas de instaladores/release comprobadas: todavía devuelven 404.
  README indica que las descargas requieren publicar el repositorio y v0.1.0.
- Validación: cinco tests de instaladores correctos, typecheck, sintaxis Bash,
  enlaces locales y presentación en navegador EN/ES. Binario Linux x64 instalado
  en carpeta temporal desde dist/ y versión 0.1.0 verificada sin Bun/Node en PATH.
  Pull correcto; sin recompilar, publicar ni validar runtime Windows/macOS.

### Eliminado — Campaña española anterior

- Confirmada `s42-agent-real-tui-2026-10-01` como campaña final: cinco PNG en
  español y cinco en inglés, conservados en private/assets/banners/.
- Eliminada por pedido del usuario la campaña española reemplazada
  `s42-agent-launch-2026-10-01`: cinco PNG, README y prompts de generación.
  Retirada también su carpeta original vacía; índice, referencias e inventario
  privados actualizados.
- Verificados los diez hashes de las imágenes finales y la eliminación de
  ambas ubicaciones de la serie anterior. Pull correcto; sin cambios de código,
  regeneración de imágenes ni publicación.

### Limpieza — Contenido público y archivo privado

- 152 archivos (aproximadamente 31 MiB) archivados en `private/`: informes y
  capturas de QA, planes/fases, investigación interna, campañas/anuncios,
  prompts de imágenes, PNG maestro y capturas duplicadas. Seis scripts de
  QA/benchmark de tareas puntuales conservados como referencia; cinco comandos
  correspondientes retirados de package.json. El fixture histórico de stress
  falla al recibir GET /props y termina con código 1 en la fuente actual.
- `private/` ignorado por Git y excluido del typecheck. Contenido original
  verificado por SHA-256, incluida la edición local previa de final-validation.md.
  Conservar fuente, tests, CI, instaladores, scripts de build/release/smoke,
  manuales públicos, JPEG social y las 35 capturas finales del README.
- README EN/ES, manual, contratos, galería, AGENTS y guía de release depurados
  de enlaces a material interno. Los enlaces históricos de QA en este changelog
  conservan sus rutas como texto. Metadata mínima de release en docs/releases;
  builds y smoke escriben resultados solo en dist/, sin duplicarlos en docs/qa.
- Validación: typecheck y suite con llavero aislado (181 pass, 0 fail); hashes
  de las 35 capturas y enlaces locales comprobados. Plan local de release con
  seis binarios y once assets verificado desde una copia pública sin private/.
  Pull correcto; sin cambios de runtime, recompilación, push ni publicación.

## 2026-10-01

### Preparado — Flujo final de publicación de v0.1.0

- Workflow manual Prepare draft release: tipos/tests con llavero temporal,
  seis compilados, smoke Linux x64 y empaquetado antes de crear draft/prerelease.
  GITHUB_TOKEN, target SHA exacto y once assets; sin trigger de push/PR.
- release-draft.ts valida versión, nombres/targets, tamaños/hashes/checksums,
  copias de instaladores/licencia y notas antes de mostrar el plan local.
  --create llama GitHub CLI para subir un borrador; no ejecutado contra GitHub.
- Notas de release con URLs absolutas al tag; anuncios ES/EN actualizados a la
  campaña final, números de línea, WebServer y preview con fuente/binarios.
  Metadata, AGENTS y guía de publicación completados.
- Typecheck y cuatro pruebas del plan correctos; integridad de seis compilados
  comprobada. Sin cambios de runtime, rebuild innecesario o benchmark nuevo.
  Pull correcto; edición ajena de final-validation.md conservada.

### Agregado — Instaladores y compilados para Windows, Linux y macOS

- README inglés/español con selector de idioma, imágenes nuevas de campaña,
  un comando por SO, instalación de Bun 1.4.2, clonación y ejecución/build.
  Distinguen Bun requerido para fuente de runtime incluido en el binario.
- install.sh/install.ps1 detectan x64/ARM64, comprueban SHA-256/versión e
  instalan sin admin con PATH; instalación desde dist y opción de no modificar
  perfiles para QA. URLs remotas identificadas como pendientes de publicación.
- build:release genera seis binarios, incluido Windows ARM64, checksums,
  manifiestos/instaladores y paquete gzip nativo con doce archivos en dist/.
  Bun Shell para builds y Bun.Archive con bytes explícitos; paquete inspeccionado
  con sus seis tamaños/hashes y metadata. Guía/metadata de publicación actualizadas.
- Typecheck y frozen install correctos; suite aislada 177 pass/0 fail. Cinco
  tests nuevos de instalador, bootstrap HTTP con binario real y CLI local probados.
  Smoke Linux x64 fuera del checkout y sin Bun/Node en PATH correcto; fixture
  HTTP actualizado para GET de metadata. PowerShell parseado en Linux.
- Runtime Windows/macOS/ARM64 pendiente. Sin benchmark nuevo, push o release;
  pull correcto y edición ajena de final-validation.md conservada fuera del commit.

### Agregado — Campaña comercial con referencias de la TUI real

- Diez nuevas piezas image_gen, cinco en español y cinco en inglés, PNG RGB
  1254×1254: QBasic, proyectos/WebServer, idiomas/seis temas, modelos/tools y
  benchmark. Estética común azul/cian, titulares grandes y referencias reales.
- Galerías y captions bilingües, prompts, manifiesto con hashes/procedencia y
  README EN/ES actualizados. Campañas anteriores y 35 screenshots conservados;
  composiciones generadas identificadas aparte de los JPEG originales.
- Cinco métricas históricas cotejadas con su JSON y revisadas en ambas piezas;
  decimales ingleses corregidos con image_gen, unidad MiB y condiciones explícitas.
- Diez imágenes inspeccionadas y decodificadas; dimensiones, JSON, referencias,
  enlaces y hashes de originales comprobados. ZIP local en out/marketing/.
  Pull correcto; edición ajena de final-validation.md fuera del commit.
  Sin cambios de runtime, builds, benchmarks nuevos ni publicación externa.

### Agregado — Galería de screenshots y presentación del repositorio

- Directorio raíz screenshots/ con 35 JPEG reales: 28 capturas nuevas de
  index.ts en Bun PTY/xterm.js/Chrome y 7 copias de QA anterior, sin alterar píxeles.
  Galería por funciones y manifiesto con procedencia, dimensiones y SHA-256.
- Chat local GLM-4.7-Flash con read real, actividad, tokens/tok/s; archivos y
  búsqueda, P:/F:, seis paletas, español/inglés, proveedores, proyectos,
  promptings/metavariables, MCP, catálogo nativo, skills.sh y About.
- README EN/ES con portadas reales, miniaturas enlazadas, temas desplegables y
  las cinco piezas promocionales existentes por idioma en sección de ilustraciones.
  Originales históricos y alcance del benchmark conservados; AGENTS y QA actualizados.
- Typecheck correcto, imágenes/hashes/enlaces comprobados y presentación local
  revisada en Chrome. Config SQLite temporal, sin credenciales personales.
  Pull correcto; cambio ajeno de final-validation.md preservado fuera del commit.
  Sin cambios de runtime, builds, benchmarks nuevos ni publicación externa.

### Agregado — WebServer del proyecto

- Tools → WebServer: puerto configurable (inicial 3000), iniciar/aplicar,
  detener, URL/estado y apertura del navegador predeterminado mediante Bun Shell.
- Bun.serve/Bun.file sirven la carpeta del proyecto en 127.0.0.1: HTML/CSS/JS,
  imágenes/binarios, MIME, HEAD/rangos, index.html o listado navegable. Archivo
  activo dentro del proyecto abre directamente; refresh ve cambios en disco.
- Un servidor por proyecto, puertos independientes; cerrar modal/cambiar de tab
  lo conserva, cerrar proyecto/cambiar carpeta/salir lo detiene. Puerto ocupado
  conserva el anterior; fallo al abrir navegador mantiene URL/servidor.
- ES/EN y 60×16 con prompt visible, botones separados y foco conservado tras error.
  README, manual, SPECS, AGENTS, fase 19 y QA/capturas reales actualizados.
- Typecheck correcto; suite completa 172 pass/0 fail. HTTP real, entrypoint PTY
  y Chrome Linux comprobados con HTML/CSS/JS/SVG y clic funcional. Apertura en
  Windows/macOS pendiente. Sin builds, dependencias nuevas ni publicación.
  Pull correcto; edición ajena de final-validation.md preservada.

### Agregado — Números de línea y capturas de la TUI real

- Margen de números de línea lógica en chats y archivos: wrap sin repetir,
  crecimiento de dígitos, scroll/Unicode/resize, selección y sintaxis conservados.
  Prompt sin numeración; seis paletas y monocromo. No modifica mensajes ni archivos.
- Cinco JPEG 1680×897 de index.ts ejecutándose en Bun PTY y xterm.js/Chrome:
  chat local GLM, explorador, TypeScript, selector de temas y About con Nord.
  Píxeles originales y manifiesto con hashes; ilustraciones anteriores separadas.
- README EN/ES reemplaza la portada ilustrada por captura real; manual, AGENTS
  y QA actualizados. Typecheck correcto; suite completa 167 pass/0 fail.
  Pull correcto, cambio ajeno de final-validation.md preservado fuera del commit.
  Sin builds, benchmarks nuevos ni publicación externa.

### Agregado — Campaña comercial en inglés

- Cinco nuevas versiones PNG 1254×1254 en assets/banners/s42-agent-launch-2026-10-01-en/:
  TUI QBasic, proyectos/archivos, idiomas/temas, modelos/tools y benchmark.
- Headlines, menús, chat, ejemplos, temas y captions en inglés; originales
  españoles conservados. Prompts de generación y corrección numérica registrados.
- Benchmark histórico conserva sus cinco cifras y condiciones; puntos decimales,
  unidad MiB y exclusión de inferencia LLM explícita. Revisión visual y de PNG,
  dimensiones, JSON y enlaces; ZIP de entrega local en out/marketing/.
- Pull correcto; cambios previos de final-validation.md preservados. Sin cambios
  de runtime, nuevos benchmarks, builds ni publicación externa.

### Preparado — Publicación GitHub y anuncio de la preview v0.1.0

- README EN/ES con portada horizontal, quickstart, capacidades y estado real;
  manual anterior conservado en docs/USAGE.es.md. CONTRIBUTING bilingüe,
  plantillas de bugs/features y PR listas para colaboración.
- Notas de prerelease fuente v0.1.0, descripción/topics/homepage en JSON y
  anuncios LinkedIn ES/EN, mensajes cortos, post de benchmark y orden del carrusel.
  Social Preview JPEG 1774×887, 250.795 bytes, PNG/prompt conservados.
- CI remota previa fallaba en el test de Bun.secrets por falta de Secret Service.
  Workflow prepara D-Bus/gnome-keyring temporal aislado; conserva la cobertura
  sin credenciales reales. Suite local completa con ese entorno: 161 pass/0 fail.
- Install frozen y typecheck correctos; suite normal 161 pass/0 fail. Copia limpia
  fuera del checkout instala, abre index.ts en PTY con SQLite temporal y restaura
  el terminal. Metadata, enlaces y revisión visual documentados en QA.
- Pull correcto con origin/main. Repo privado verificado; sin push, cambios de
  visibilidad, release, anuncios enviados, builds o benchmarks nuevos.
  Edición previa de final-validation.md conservada fuera del commit.

### Agregado — Cinco imágenes comerciales de S42 Agent

- Campaña en español con cinco PNG cuadrados de 1254 × 1254 px: TUI QBasic,
  proyectos/archivos, idiomas/seis temas, modelos/tools/MCP/skills/CLI y benchmark.
- Estética común azul DOS/cian, ventanas y menús de terminal. Textos comerciales
  y prompts conservados junto a las piezas en assets/banners/.
- Benchmark reproduce final-validation.md con cifras, unidades, versión,
  host y condiciones; identifica el registro histórico y excluye inferencia LLM.
- Revisión visual de textos y métricas; cinco PNG válidos y dimensiones iguales.
  Sin cambios de runtime, builds, nuevos benchmarks o publicación externa.
  Pull falló por main sin upstream; cambios previos de QA preservados.

### Corregido — Coding local, actividad por pestaña y SQLite

- llama.cpp consulta /props al descubrir/enviar: tools, contexto y visión reales.
  Repara catálogos antiguos sin tools; GLM local reporta contexto 128768 frente
  al 8192 anterior. Salida automática hasta 8192 o un cuarto del contexto;
  modelos editados manualmente conservan sus valores. Metadata opcional con
  timeout corto y fallback; cancelar el turno sí interrumpe.
- Prompt exige artefactos funcionales completos en disco y razonamiento breve;
  write agrega append=true para construir archivos por partes. Pedido exacto de
  Tetris ejecutado con GLM-4.7-Flash: exit 0, HTML 28.696 bytes, list/write, tres
  requests. Chrome comprobó lógica, perspectiva 3D CSS y Web Audio activo tras
  clic nativo. Limitaciones visuales/alcance de esa muestra registradas en QA.
- Pestañas P:proyecto/F:archivo y spinner de cada proyecto activo cada 200 ms,
  incluso viendo otro proyecto o un archivo; finalización independiente.
- E/S y promedio tok/s cambian durante streaming con timings_per_token de
  llama.cpp o uso progresivo del proveedor. Snapshots sobre requests finalizadas,
  sin contar chunks ni duplicar tokens/requests. Datos ausentes conservan N/D.
- Persistencia global agent.sqlite con bun:sqlite, WAL, configuración y eventos
  indexados por sesión. Importación atómica JSON/JSONL conserva originales,
  defaults, borradores e historial; claves permanecen en Bun.secrets. Locks y
  recuperación de proceso muerto sin repetir tools. --config JSON compatible;
  SQLite alternativo disponible para TUI/CLI, que informa ID reanudable.
- README/AGENTS/SPECS/TOOLS, fase 18 y QA actualizados. Typecheck correcto;
  suite completa 161 pass/0 fail, revisión focalizada 19 pass/0 fail. TUI index.ts
  PTY con migración XDG temporal, CLI con tools/SQLite, tres proyectos y archivo
  visible comprobados. Config personal y cambios ajenos preservados.
- Pull falló por main sin upstream; trabajo local, sin builds ni push.


### Corregido — Modelo global persistente y APIs nativas de Bun

- Elegir modelo guarda sesión/proyecto/default global, heredado en nuevas
  sesiones y proyectos. Config anterior con un único modelo del proveedor default
  lo recupera sin requests al iniciar. Rutas por SO conservadas, con fallback
  de variables vacías y AppData estándar; --config sigue siendo override.
- API keys TUI con Bun.secrets en llavero del SO, referencias en JSON, campos
  enmascarados y hint guardada/vacío conserva. Recuperación asíncrona en TUI/CLI;
  alternativa de entorno y errores concretos si el llavero falla. Overrides CLI
  quedan en memoria y otro endpoint descarta referencia/caché previa.
- Shell/Git/nvidia-smi usan Bun Shell ($). Proceso interno del mismo entrypoint
  conserva timeout, cancelación de árbol, cwd, streams y argv escapados; MCP
  stdio conserva Bun.spawn para RPC bidireccional. Compatibilidad de sintaxis
  Bun y buffer del intérprete documentados.
- Tool scrape con Bun.WebView: DOM JavaScript real, CSS, texto/HTML, título,
  URL y enlaces, recorte, timeout/cancelación y cierre. Backend solo al usarla,
  compartido hasta salir; navegador instalado en Linux/Windows, WebKit macOS.
- README/AGENTS/SPECS/TOOLS, fase 17 y QA actualizados. Typecheck correcto;
  suite completa 150 pass/0 fail; revisión focalizada final 22 pass/0 fail.
  Llavero real Linux + reapertura index.ts PTY autenticada verificados con fixture;
  Chrome real para scraping. Sin config personal modificada, builds ni push.
  Pull falló por main sin upstream; trabajo ajeno preservado.

### Eliminado — CLAUDE.md

- Eliminado CLAUDE.md del checkout por pedido del usuario. Era un archivo sin
  versionar; se registra aquí su eliminación. Verificada su ausencia.
- Pull falló por main sin upstream; cambios ajenos preservados.

### Agregado — Crédito de desarrollo en About

- Ayuda → About muestra `Building with Codex & GPT-6.1 Sol` debajo del autor,
  conservando el texto literal en español e inglés.
- Typecheck y prueba existente de About correctos; sin builds ni push.
  Pull falló por main sin upstream; cambios ajenos preservados.

### Agregado — Agente desde command line sin TUI

- --prompting activa src/cli.ts desde index.ts antes de cargar App/terminal;
  --llm_server, --llm_port, --llm_apikey y --reasoning on/off, junto a los flags
  existentes de proyecto/cwd/modelo/proveedor/config/sesión. Valores separados
  o con =, validación y ayuda actualizada. Overrides/clave en memoria.
- Mismo runTurn, tools nativas, instrucciones, MCP/skills y etapas. Respuesta
  streaming por stdout; reasoning opcional, tools/resultados, sesión y tokens
  por stderr. Config/borradores/pestañas intactos; nueva sesión o reapertura.
  SIGINT/SIGTERM cancelan, conservan parciales y liberan locks (130/143).
- Typecheck, suite completa 142 tests / 30 archivos y pruebas CLI/TUI finales
  correctas. GLM-4.7-Flash real leyó/editó/verificó una suma: read/read/edit/shell/
  read, test independiente correcto, 12158 entrada/450 salida y 36,5 tok/s.
  QA histórica (`docs/qa/cli.md`), README/specs/AGENTS/fase16 actualizados.
  Sin builds ni push; pull falló por main sin upstream. Cambios ajenos preservados.

### Mejorado — Promedio tok/s identificado en Prompt

- Contador explícito `Tokens E/S … · Prom. … tok/s` arriba a la derecha;
  `Avg.` en inglés. Promedio observado por turno conservado y N/D sin medición.
- Typecheck y 23 tests relevantes / 499 assertions correctos: promedio ponderado
  entre requests con tasas distintas, contadores grandes/parcial a 60 columnas,
  ES/EN, recursos ocultos y borrador sin superposición. Seis capturas tmux desde
  index.ts con fixture SSE; QA histórica (`docs/qa/persistent-indicators.md`).
  Sin builds ni push; pull falló por main sin upstream. Cambios ajenos preservados.

### Agregado — Archivos en pestañas y resaltado de sintaxis

- Abrir desde el explorador usa una pestaña junto al proyecto, con nombre del
  archivo como título, ruta/lenguaje/tamaño y todo el panel central. Texto UTF-8
  completo de solo lectura; Prompt, chat, cwd/modelo y adjuntos conservados.
- HTML/CSS/JavaScript/TypeScript con colores por token, incluyendo style/script
  en HTML. Resaltado léxico propio sin dependencias, ejecución ni cambios en disco;
  paletas/selección/monocromo respetados. Otros textos y binarios tienen fallback.
- Reabrir conserva la vista/scroll; teclado/mouse recorren proyectos y archivos.
  Ctrl+W/× cierra archivos sin cerrar el proyecto; enviar vuelve al chat, streams
  en background no reemplazan el archivo. Vistas de archivo transitorias.
- Typecheck y suite completa 136 tests / 29 archivos correctos; pruebas finales
  de archivos/sintaxis también correctas. index.ts real en PTY, archivo >64 KiB,
  Unicode, ES/EN, selección, resize, cierre, errores y contexto LLM aislado.
  QA y capturas histórica (`docs/qa/file-tabs.md`), README/specs/AGENTS/fase15 actualizados.
  Sin builds ni push; pull falló por main sin upstream. Cambios ajenos preservados.


### Mejorado — Autores del chat con colores distintos

- Vos en amarillo y Agente en cian en QBasic; tonos distintos en las otras cinco
  paletas, incluido el fallback ANSI16. Historial, streaming y estado del agente
  usan estilos propios; cuerpo neutral, selección conservada y negrita sin color.
- Colores asignados según el rol del mensaje, sin confundir etiquetas citadas
  dentro del texto ni guardar escapes ANSI en las sesiones. ES/EN y reapertura
  mantienen la identificación de autores.
- Typecheck y 131 tests / 27 archivos / 2260 assertions correctos; index.ts real
  en PTY, seis paletas, selección, resize y ocultar/mostrar reasoning.
  QA histórica (`docs/qa/chat-colors.md`). Sin builds ni push; pull falló por main sin upstream.


### Agregado — Actividad animada en el proyecto y estado en el chat

- Título del proyecto con animación ASCII durante el turno, incluso antes del
  primer texto. Nombre intacto, indicador visible en títulos largos y estado
  transitorio por pestaña. Timer cada 200 ms, detenido en fin/error/cancelación/
  cierre y sin repintados de animación sobre una pestaña visible idle.
- Estado conectando/razonando/respondiendo/tools en una fila del chat, fuera del
  scroll. Prompt conserva modo, borrador, tokens, adjuntos y nueva línea durante
  el turno. Razón real recibida sigue respetando Vista → Ver razonamiento.
- Typecheck y 129 tests / 26 archivos / 2111 assertions correctos: animación sin
  deltas, ES/EN, ocultar reasoning, scroll/foco/draft, títulos Unicode largos,
  dos turnos, resize 60×16, fin/cancel/error/cierre e idle. Siete capturas tmux
  desde index.ts revisadas. README/specs/AGENTS/fase13/QA actualizados.
  Sin builds ni push; pull fallido por main sin upstream. Trabajo ajeno preservado.

### Corregido — Indicadores siempre visibles en la TUI

- Prompt sin botón Enviar/Cancelar, con borrador de ancho completo. Tokens de
  entrada/salida y tok/s siempre arriba a la derecha en una fila propia; Enter,
  Shift+Enter y Ctrl+C conservan envío, línea y cancelación.
- CPU % y RAM/disco/VRAM usado/total en barra inferior persistente, con filas
  adaptadas al ancho. Vista ofrece on/off por recurso guardado en ui.resources;
  se eliminó el modal de datos y no existe toggle para ocultar tokens.
- Tok/s calculado con salida reportada y tiempo real de requests, excluyendo
  tools; incluye red/primer token. Uso/timing persisten por turno/pestaña;
  config/sesiones anteriores compatibles, N/D si falta medición, parcial si
  falta uso. Cantidades grandes abreviadas en UI, exactas en sesión.
- ES/EN, typecheck y 127 tests / 25 archivos / 1980 assertions correctos.
  Seis capturas tmux desde index.ts: 100×32, 80×24, 60×16, toggle CPU,
  explorador y adjunto. GLM real: 151 entrada / 92 salida, 104,4 tok/s observados.
  README/specs/AGENTS/fase12/QA actualizados. Sin builds ni push; pull fallido
  por main sin upstream. Cambios ajenos conservados fuera del commit.

### Ajustado — Márgenes verticales del explorador

- El explorador deja hasta dos filas libres arriba y abajo dentro del editor,
  con altura reducida y posición recalculada al abrir/redimensionar. En tamaños
  compactos reduce los márgenes para conservar lista, búsqueda y acciones.
- Mantiene el ancho y el prompt fijo visible. Typecheck y 16 tests relevantes
  correctos; terminal tmux desde index.ts revisado a 100×32, 80×24 y 60×16.
  Pruebas existentes de carga adaptadas a archivos que requieren scroll.
  Sin builds ni push; git pull falló por main sin upstream.

### Agregado — Identidad, skills internas y tools Markdown/WebSocket

- Investigación de ocho papers primarios sobre agentes, interfaz de tools,
  feedback y skills. docs/AGENT-INTELLIGENCE.md distingue evidencia, decisiones
  aplicadas y propuestas futuras; no afirma mejoras de inteligencia sin eval A/B.
- Prompt inicial propio en src/agent/prompt.ts, con identidad S42 y etapas
  verificables. src/agent/skills contiene software-project, debug-and-verify y
  create-pdf, incluidos como texto; el modelo ve metadatos y usa internal_skill
  para cargar instrucciones. Resultado Markdown legible en chat, sin ejecutar
  scripts; skills externas y su registro conservan su mecanismo existente.
- markdown_html usa Bun.markdown.html desde texto/archivo, fragmento o HTML
  standalone, salida a archivo y preview UTF-8 acotado con JSON válido.
  PDF es una skill que requiere un renderizador instalado, no una API Bun nativa.
- websocket usa el cliente Bun ws/wss, headers/subprotocolos, envío de texto,
  recepción texto/base64, límites, timeout/cancelación con parciales y limpieza.
  Once tools en catálogo ES/EN; llamadas/resultados persistidos y visibles.
- Typecheck y 124 tests / 25 archivos / 1911 assertions correctos. GLM-4.7-Flash
  ejecutó las tres tools con HTML/eco WS comprobados: 2 requests, 4589 entrada /
  481 salida, 5,126 s. Intermitencia en un test existente de cancelación shell
  registrada en QA; pasó aislado y en la suite final. Cinco capturas tmux de
  index.ts a 100×32/60×16 revisadas.
  README/specs/AGENTS/contratos/fase14/QA actualizados. Sin builds ni push;
  pull fallido por main sin upstream. Cambios ajenos conservados fuera del commit.

### Mejorado — Paletas oscuras y tres combinaciones clásicas

- Dark · Grafito y Green · Bosque reemplazan los tonos planos de grises/verdes:
  fondos profundos, menús/diálogos oscuros, texto suave y selección plateada/menta.
  Estilos por rol semántico y escritorio; QBasic sigue como default, sin cambios.
- Nord · Ártico, Dracula · Violeta y Gruvbox · Retro cálido disponibles en Vista
  → Paleta de colores, en español/inglés y con persistencia. Config conserva
  IDs grayscale/green y acepta nord/dracula/gruvbox. RGB y fallback ANSI16.
- Typecheck y 41 tests relevantes correctos (6 archivos, 1018 assertions):
  contraste, seis paletas, selección/persistencia/aislamiento, scroll en 60×16,
  repintado e idle, PTY, ANSI16 y NO_COLOR. Diez capturas tmux desde index.ts
  revisadas; README/specs/AGENTS/QA actualizados. Sin builds ni push.
  Pull fallido por main sin upstream.

### Mejorado — About con identidad y capacidades

- Ayuda → About presenta el espíritu QBasic, tools de archivos/búsqueda/comandos/
  HTTP, proyectos en pestañas, promptings con metavariables, MCP, skills y elección
  de modelos locales/remotos. Incluye portabilidad Bun a Windows/Linux/macOS,
  Powered by César Casas., MIT., versión real del paquete y LinkedIn del autor.
- Modal en español/inglés con cabecera de color, área de solo lectura y scroll,
  cierre por teclado/mouse y tamaño adaptable sin tapar el prompt fijo.
- Typecheck y 36 tests relevantes correctos (5 archivos, 725 assertions).
  Siete capturas de index.ts/tmux en 120×40, 100×30 y 60×16: lectura, scroll,
  inglés y reapertura sin color. README/specs/AGENTS/QA actualizados.
  Sin builds ni push; pull fallido por main sin upstream.

### Agregado — Idioma y razonamiento en Vista

- Vista → Language cambia español/inglés en vivo: menús, botones, formularios,
  ayuda, avisos/estados, métricas y etiquetas del chat. Anchos/hit boxes de menú
  siguen la traducción; nombres, archivos, prompts, modelo y resultados intactos.
- Vista → Ver razonamiento: on/off oculta o muestra historial y deltas ya recibidos,
  incluso durante un turno, en todas las pestañas. Reasoning persiste siempre;
  respuesta, tool calls y resultados siguen disponibles. Sin encabezados duplicados
  al reactivar en streaming. Preferencias ui.language/ui.showReasoning guardadas,
  defaults/migración es/true; formularios aceptan sí/yes y proyecto/project.
- Typecheck y 117 tests correctos (24 archivos). index.ts en tmux: elección con
  teclado, resize 100×30/60×16 y reapertura sin color; pruebas de mouse inyectado,
  SSE/cancelación/reanudación y fallo de guardado. Fase13/README/specs/AGENTS/QA
  actualizados. Sin builds ni push; pull fallido por main sin upstream.

### Agregado — Tools nativas, explorador grande y recursos

- src/agent/tools con un archivo/schema/handler por read/write/edit/list/find/
  search/fetch/shell. Catálogo Tools → Nativas y docs/TOOLS.md con contratos.
  Find por nombre/glob; fetch HTTP con métodos, headers, JSON/forms/multipart/
  texto, status de errores, límites, timeout y cancelación. APIs Bun incluidas.
- Explorador adaptable al editor: ruta base + Buscar, recorrido de disco fuera
  del proyecto, resultados ordenados con ubicación, cancelación, preview y
  adjuntos. Compacto 60×16 conserva resultados clicables y prompt fijo visible.
- Barra inferior con CPU/RAM/disco/VRAM usados/libres y tokens E/S de la pestaña;
  Vista → Recursos y tokens ofrece detalle/origen. Muestreo cada 2 s sin requests
  superpuestas; N/D si SO/driver no informa, sin instalar utilidades/drivers.
- Uso real del proveedor acumulado entre requests/tools/etapas/length, parcial
  explícito y persistencia de último turno compatible con sesiones v1.
- Typecheck y 111 tests correctos, 23 archivos; GLM real ejecutó find + fetch POST
  y reportó 2520 entrada / 360 salida. Capturas de index.ts/tmux 190×50, 80×24,
  60×16 inspeccionadas. VRAM N/D por driver/library mismatch del host.
  Fase12/specs/README/AGENTS/QA actualizados. Sin builds nuevos. Pull fallido por
  main sin upstream; cierre local sin push, cambios ajenos preservados.

### Agregado — Recuperación por etapas, About y catálogo directo

- Límite de salida length tipado: conserva texto/reasoning parcial y pide al
  mismo modelo dividir el pedido en etapas pequeñas, con entregas en el chat.
  Calls truncadas descartadas, presupuesto conservado, maxSteps y cancelación
  vigentes. No se reintentan HTTP/timeout ni se reproducen tools ya realizadas.
- Guía insertada al comenzar cada etapa, manteniendo assistant/tool/results;
  sufijo de continuación oculto durante SSE y antes de persistir texto. Corregida
  una repetición detectada en GLM real al reenviar la guía tras cada herramienta.
- Ayuda → About: Powered by César Casas., MIT., S42 Agent. y versión real desde
  package.json. Buscador/resultados muestran https://skills.sh; consulta directa
  al catálogo /api/search comprobada desde helper y TUI, con 20 resultados reales.
- Typecheck y 105 tests correctos (21 archivos, 1285 assertions), GLM real con
  primer corte provocado y dos archivos escritos; tmux 80×24/60×16 inspeccionado.
  Fase11, specs, README, AGENTS y QA actualizados. Sin builds nuevos. Pull fallido
  por main sin upstream; commit local, sin push.

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
