# S42 Agent — campaña comercial

Serie de cinco piezas en español, generadas con la herramienta integrada
`image_gen` y revisadas visualmente. Formato PNG, **1254 × 1254 px**, relación
**1:1**, para usar como carrusel o publicaciones individuales.

La identidad combina azul DOS, cian y blanco cálido con títulos grandes,
tipografía monoespaciada y ventanas inspiradas en QBasic. Las interfaces de las
piezas 01–04 son ilustraciones comerciales de funcionalidades existentes;
no son capturas de una ejecución ni evidencias de inferencia.

## Serie y textos sugeridos

| Pieza | Archivo | Texto para acompañar la publicación |
| --- | --- | --- |
| 01 · Un superagente. Con alma de QBasic. | [PNG](01-superagente-qbasic.png) | S42 Agent lleva el coding con IA a una terminal con personalidad: ventanas, mouse, menús y atajos inspirados en Vim. Desarrollado con Bun, open source y con licencia MIT. |
| 02 · Tus proyectos. Sin perder el hilo. | [PNG](02-proyectos-y-archivos.png) | Trabajá con varios proyectos, abrí archivos en pestañas y explorá carpetas fuera del proyecto. Buscá por nombre o glob y leé HTML, CSS, JavaScript y TypeScript con colores de sintaxis. |
| 03 · Tu idioma. Tu estilo. | [PNG](03-idiomas-y-temas.png) | Español o inglés. QBasic, Grafito, Bosque, Nord, Dracula o Gruvbox. Registrá cada proyecto con Name + Folder y escribí con Enter para enviar y Shift+Enter para una nueva línea. |
| 04 · Tu modelo. Poder para construir. | [PNG](04-modelos-y-herramientas.png) | Elegí tu modelo: llama.cpp local, DeepSeek u otro proveedor compatible. S42 Agent incluye 12 tools nativas, MCP, skills, prompts con metavariables y ejecución desde CLI sin cargar la TUI. El modelo elegido debe soportar las capacidades que se usan. |
| 05 · Rápido. Y con números. | [PNG](05-benchmark.png) | Benchmark registrado de S42 Agent v0.1.0 en Linux x64: arranque p95 de 24,43 ms, input p95 de 35,95 ms y RSS en reposo de 46,64 MiB. Medición de bytes en PTY con caché caliente; excluye inferencia LLM y pintura del emulador. |

## Fuente y alcance del benchmark

La pieza 05 reproduce los resultados de
[final-validation.md](../../../docs/qa/final-validation.md) y su registro
[benchmark-s42-agent-0.1.0-linux-x64.json](../../../docs/qa/benchmark-s42-agent-0.1.0-linux-x64.json).
Se usan comas decimales para el texto comercial en español.

| Medición | Resultado |
| --- | --- |
| Arranque p95 | 24,43 ms |
| Input p95 | 35,95 ms |
| Delta SSE a frame p95 | 4,07 ms |
| Memoria RSS en reposo | 46,64 MiB |
| Reanudar una sesión de 1.000 mensajes | 42,07 ms |

Condiciones: 30 arranques, 100 entradas y 20 deltas SSE; caché del SO caliente;
recepción de bytes en PTY, sin medir pintura gráfica ni inferencia del modelo.
Host registrado: Intel Core Ultra 9 275HX, Ubuntu 24.04.5, Bun 1.4.2.
Estos son resultados históricos del binario identificado en el registro;
no se ejecutó un benchmark nuevo para esta campaña ni se extrapolan al código
actual, a otros sistemas o a la velocidad de un LLM.

Las demás afirmaciones se contrastaron con README.md, AGENTS.md,
docs/TOOLS.md y el catálogo de herramientas y paletas de la fuente actual.
No se incluyeron comparaciones con competidores ni promesas sobre runtimes
de otros sistemas pendientes de validación.

## Prompts y revisión

[prompts.json](prompts.json) conserva los cinco prompts de generación y las
correcciones de las piezas 03 y 05. La primera pieza fija la referencia de
estilo para las cuatro siguientes. Se revisaron los textos, los doce nombres
de herramientas, los seis temas y las cinco cifras del benchmark. Se ajustaron
los menús de los ejemplos en inglés, el indicador de Enter y la unidad MiB.

Se verificaron los cinco archivos PNG, sus dimensiones cuadradas y su lectura
desde el repositorio. No se modificó código de runtime ni se hicieron builds,
pruebas de inferencia o publicaciones externas en esta tarea.
