# Validación integral — s42-agent 0.1.0

Entrega local Bun 1.4.2 / TypeScript 7.0.2, Linux x64 Ubuntu 24.04.5,
Intel Core Ultra 9 275HX, RAM 65274432 KiB. Cero dependencias de runtime del harness.
No hay push, release ni despliegue. Cada pull falló por main sin upstream.
.gitignore y CLAUDE.md preexistentes del usuario quedaron excluidos de commits.

## Producto y pruebas

- Projects Name/Folder, explorer fuera del proyecto y sesiones aisladas.
- Models/proveedores configurables al primer uso, sin inferir un modelo inexistente.
- TUI QBasic, respuestas read-only, prompt fijo, Enter enviar y Shift+Enter línea,
  mouse SGR, Vim y menús desplazables; F1–F12 sin acciones.
- MCP CRUD/stdio/HTTP/enabled; calls, progreso y resultados en el chat.
- Skills global/proyecto, YAML, carga progresiva, /skill, búsqueda e instalación
  desde skills.sh. Catálogo Vercel instalado temporalmente con reglas preservadas.
- Suite fuente completa final: **81 tests, 741 assertions, 16 archivos, cero
  fallas**, typecheck correcto. [Salida reproducible](final-tests.txt).
- GLM-4.7-Flash real: [QA](local-llm.md) y [registro](local-llm.json).
  Read/edit/shell reales, diff correcto y bun test exit0, verificación independiente,
  reasoning, cancelación parcial y reapertura. Skill QA invocada y tools MCP usadas.
  El servidor MCP QA es un fixture de protocolo Bun; la inferencia LLM es real.

## Estabilidad

[50 ciclos](tui-stress.json): 50 procesos TUI abiertos, reasoning SSE recibido,
cancelación, resize a 60×16 y cierre. Restauración de cursor/mouse/paste en 50/50,
sin error. Directorio protegido produjo EACCES. Descendientes shell/stdio Linux
comprobados por bun:test; fallas HTTP, stream truncado y recuperación cubiertos.

La [prueba prolongada](tui-soak.json) completó **1800.009 s, 60 ciclos y exit0**:
20 respuestas completas, 20 cancelaciones parciales, 20 errores HTTP503. RSS
58.08 → 61.44 MiB; máximo 63.61 MiB, dentro del objetivo de 100 MiB. Se registra
la variación observada sin afirmar ausencia de fugas para duraciones mayores.
Su proceso fuente se inició antes de incorporar menús/loop MCP y skills: cubre el
núcleo TUI/sesión/stream/cancelación/resize. Las extensiones se validaron luego con
fixtures, GLM y smoke del binario. No extender el resultado del soak a capacidades
que no se ejercitaron. El script es reproducible para repetirlo sobre la fuente final.

## Rendimiento

Datos finales: [benchmark Linux x64](benchmark-s42-agent-0.1.0-linux-x64.json).
30 arranques, 100 entradas, 20 deltas SSE, 50 ciclos de explorador y sesión de
1.000 mensajes (379463 bytes). Caché del SO caliente; se mide recepción de bytes
en PTY, sin pintura del emulador gráfico. SSE incluye el transporte HTTP local
pero excluye inferencia. Cero bytes emitidos durante 10 s idle.

| Objetivo | Resultado registrado |
| --- | --- |
| Arranque p95 ≤ 200 ms | 24.43 ms |
| Input p95 ≤ 50 ms | 35.95 ms |
| Delta a frame p95 ≤ 100 ms | 4.07 ms |
| RSS idle ≤ 100 MiB | 46.64 MiB |
| Reanudar 1000 mensajes ≤ 1 s | 42.07 ms |

La comparación de [flags](build-comparison.json) y benchmarks
[normal](benchmark-s42-agent-0.1.0-normal.json),
[minify/map](benchmark-s42-agent-0.1.0-minify-map.json),
[bytecode](benchmark-s42-agent-0.1.0-bytecode.json) se ejecutó antes de los últimos
ajustes de UI. Cada registro conserva el SHA de su binario. Normal: 23.4 ms p95,
81.50 MB; minify/map: 25.2 ms, 81.57 MB; bytecode: 13.4 ms, 83.55 MB. El flag
bytecode requirió poner el arranque en una función async: Bun rechazó el await
superior original. El wrapper pasa tests fuente/PTY y compila las tres variantes.
Se conserva **build normal**: cumple los objetivos, menor tamaño y flags mínimos
para todos los targets. No se necesita smol: RSS ampliamente bajo el objetivo.
No atribuir las pequeñas diferencias de input a los flags sin más muestras.

## Distribución local

[Manifest y checksums](build-targets.json), [smoke](binary-smoke.json).
Cinco targets generados con scripts Bun, versión, tamaño, SHA y assets importados.
Config, sesiones, credenciales y modelos externos no se incluyen en los binarios.

| Target | Compilado | Runtime |
| --- | --- | --- |
| Linux x64 | Sí | Config/sesión/SSE/MCP/YAML/skill/read/edit/shell/cierre en PTY |
| Linux arm64 | Sí | Pendiente; no hay host de destino disponible |
| macOS x64 | Sí | Pendiente; no hay host de destino disponible |
| macOS arm64 | Sí | Pendiente; no hay host de destino disponible |
| Windows x64 | Sí | Pendiente; no hay host de destino disponible |

Linux se copió a una carpeta externa, con PATH /nonexistent. Se invocó el
**ejecutable directamente**, sin archivos del checkout ni runtime Bun/Node en PATH.
El host sí tiene Bun para el driver PTY y los servidores fixture externos; no se
simula que fue desinstalado. Los comandos shell nativos siguen siendo externos.
Windows tiene taskkill implementado; no se da por validado su árbol de procesos.

## Tareas que requieren un entorno externo

| Tarea | Pendiente concreto |
| --- | --- |
| F00-11 / cierre de F01 | Mouse físico en emulador gráfico: clic, release, rueda, arrastre, menús y foco |
| F04-08 | Descendientes/cancelación en Windows y macOS ejecutados en destino |
| F05-09 | Arrastrar archivos desde el SO, con espacios, múltiples archivos e imagen |
| F06-07 | Runtime macOS/Windows/arm64; comprobar ausencia de Bun/Node en esos hosts |
| F06-08 | Matriz de terminales y mouse/drop físicos |

La sesión ofrece control de navegador, sin superficie nativa de escritorio para
mover archivos desde el SO al terminal. Eventos SGR/paste inyectados validan el
parser/renderer; no sustituyen esos casos. Quedan identificados en cada fase y
no se marcan completos por cross-compilar o pasar fixtures.
