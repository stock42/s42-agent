# Fase 00 — Componentes QBasic y demo de viabilidad TUI

Estado: **Pendiente**. Dependencia: [SPECS.md](../SPECS.md).
Requisitos: R01, R02, R03, R04, R05, R13, R14, R15, R16, R17.

## Objetivo

Construir primero una demo interactiva estilo QBasic con mouse, ventanas,
botones y menús desplegables. Comprobar la viabilidad visual y de interacción
antes de desarrollar el agente, su cliente LLM o sus herramientas.

La base Bun y el primer binario se resuelven dentro de este hito visual; no
anteponer una fase separada de backend o una CLI sin componentes.

## Tareas

- [ ] F00-01. Revisar el scaffold existente, `CLAUDE.md`, package, lockfile y
  tsconfig. Conservar los archivos del usuario; no reinicializar el repositorio.
- [ ] F00-02. Registrar/fijar Bun y dependencias de desarrollo; preparar scripts de
  demo, typecheck, test y build con Bun. Mantener un paquete y cero dependencias
  de runtime. Respetar el mecanismo de entorno y no crear `.env.local`.
- [ ] F00-03. Crear `src/tui-demo.ts` independiente del agente, con ayuda/version y
  error no TTY. Sin requests LLM, tools, persistencia de proyectos ni red.
- [ ] F00-04. Implementar lifecycle del terminal: raw mode, pantalla alternativa,
  cursor, dimensiones, paste, mouse SGR y cleanup idempotente.
- [ ] F00-05. Implementar parser incremental compartido de teclado, mouse y paste,
  normalizando coordenadas por celda sin confundir eventos con texto del usuario.
- [ ] F00-06. Crear renderer de grilla, clipping y filas modificadas, con paleta
  QBasic centralizada y ancho Unicode correcto. No emitir frames en reposo.
- [ ] F00-07. Implementar `Desktop` y `Window`: marco, título, cierre, foco,
  superposición y movimiento arrastrando la barra de título.
- [ ] F00-08. Implementar `Button`, `MenuBar` y `MenuPopup`: estados de botón,
  clic/release, desplegables, opciones deshabilitadas, cierre afuera y Escape.
- [ ] F00-09. Implementar controles `TextInput` y `SelectList`, y un diálogo modal
  reutilizando Window. Tab, flechas y rueda invocan las mismas acciones que mouse.
- [ ] F00-10. Componer una demo que ejercite los componentes: abrir dos ventanas,
  mover/enfocar/cerrar, editar un campo, elegir una lista, abrir/cerrar un modal.
  Identificar claramente sus datos como fixtures de la demo visual.
- [ ] F00-11. Probar input partido, hit testing, capas, clipping, captura durante
  drag y modal, resize y restauración. Registrar mouse real por separado de PTY.
- [ ] F00-12. Compilar `s42-tui-demo` con `bun build --compile`; ejecutar fuera del
  checkout. Medir arranque, respuesta de input y repintados según SPECS §12.
- [ ] F00-13. Documentar ejecución, atajos, componentes y evidencia de viabilidad.
  Registrar límites reales de terminal/SO; actualizar CHANGELOG y hacer commit.

## Escenarios de aceptación

1. En un terminal real 80×24, abrir un menú superior con clic y elegir una opción
   de su desplegable. Repetir con F10/flechas/Enter y cerrar con Escape/clic afuera.
2. Pulsar un botón: feedback de presionado y una sola acción al release dentro.
   Soltar afuera y pulsar un botón deshabilitado no activan acciones.
3. Abrir dos ventanas superpuestas; clic enfoca/eleva la visible, mover por el
   título y cerrar con `[X]`. Un control tapado no recibe clic a través de la ventana.
4. Abrir modal sobre las ventanas: mouse/teclado no atraviesan el diálogo; cerrar
   restaura el foco previo. Tab y Shift+Tab recorren sus controles.
5. Escribir tildes/Unicode en un input, pegar texto sin activar atajos y elegir una
   lista con clic/flechas; la rueda desplaza esa lista sin desplazar otra ventana.
6. Cambiar 80×24 → 120×40 → 60×16 con menú/ventana abiertos: clipping correcto,
   título/cierre accesibles y controles con coordenadas nuevas.
7. Verificar estados legibles sin color, error limpio fuera de TTY y restauración
   de raw mode, cursor, pantalla y mouse al salir por Ctrl+C/SIGTERM/error controlado.
8. Inyectar secuencias SGR y Unicode fragmentadas en PTY: mismos eventos que
   completas. Esa prueba no sustituye el mouse físico del primer escenario.
9. Compilar y repetir el flujo desde el binario fuera del checkout. Documentar
   explícitamente si aún falta un destino sin Bun/Node para validar independencia.
10. Medir primer frame/input y observar idle: no redibujar sin cambios ni atribuir
    rendimiento a una captura. La demo no conecta proveedores ni ejecuta coding.

## Evidencia

| Tarea/caso | Comando, captura o artefacto | Resultado, entorno y tipo de prueba |
| --- | --- | --- |
| — | — | Pendiente; no ejecutado. |

## Cierre

Completar cuando la demo QBasic y su binario funcionan, los componentes pueden
reutilizarse, los escenarios de mouse/teclado están comprobados y se registró la
viabilidad con limitaciones reales. No avanzar a proveedores/tools antes de
comprobar este hito. Una captura estática o un parser aislado no cierran la fase.
