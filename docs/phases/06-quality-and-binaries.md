# Fase 06 — Validación integrada, rendimiento y distribución

Estado: **Pendiente**. Dependencias: fases [00](00-tui-viability.md) a
[05](05-vim-and-attachments.md). Requisitos: R01–R17.
Contratos: SPECS §12, §13 y §14.

## Objetivo

Cerrar el MVP con pruebas del recorrido completo, objetivos medidos y binarios
ejecutados en las plataformas que se declaren soportadas.

## Tareas

- [ ] F06-01. Ejecutar typecheck y suites de comportamiento/integración con
  `bun:test`; distinguir casos reales, fixtures, skips y fallas.
- [ ] F06-02. Completar el recorrido de dos proyectos: seleccionar modelo, adjuntar,
  solicitar una edición, verificarla, cancelar otro turno, cerrar y reanudar.
- [ ] F06-03. Ejecutar 50 ciclos de apertura/cancelación/cierre, una sesión fixture
  de 30 min y fallas de red, disco, resize y comandos con descendientes.
- [ ] F06-04. Crear mediciones Bun para inicio, latencia de input/frames, memoria
  idle y reanudación; usar los fixtures y objetivos de SPECS §12.
- [ ] F06-05. Comparar build normal y flags minify/sourcemap/bytecode. Evaluar smol
  solo ante necesidad medida; documentar flags, tamaño y resultados.
- [ ] F06-06. Generar los targets de SPECS §13 desde scripts TypeScript/Bun, con
  versión, checksum y assets embebidos. Mantener datos/config fuera del binario.
- [ ] F06-07. Ejecutar smoke de cada target en su SO/arquitectura, fuera del checkout
  y sin Bun/Node. Separar los targets compilados que aún no tienen validación runtime.
- [ ] F06-08. Comprobar TUI QBasic, mouse, ventanas/menús, tool shell, restauración
  y drop en la matriz de terminales;
  publicar solo la compatibilidad comprobada. Registrar lo pendiente sin ocultarlo.
- [ ] F06-09. Completar README con instalación del binario, proyectos, configuración,
  servidor local externo, modelos, atajos, adjuntos y solución de errores reales.
- [ ] F06-10. Conciliar SPECS, fases, AGENTS y CHANGELOG con la implementación final,
  sus limitaciones y los comandos que existen; hacer el commit de cada tarea.

Esta fase prepara artefactos de distribución. Publicarlos en un remoto, crear una
release o desplegar un sitio requiere una tarea explícita; no inferir publicación
a partir de un build o commit.

## Escenarios de aceptación

1. Flujo completo con modelo local real y archivos de prueba: diff correcto y
   verificación ejecutada, no solamente explicación textual de lo que haría.
2. El mismo flujo con un segundo proveedor fixture no mezcla endpoint, sesión,
   modelo, credenciales o carpeta de proyecto.
3. Cierres controlados restauran el terminal en los 50 ciclos. Prueba prolongada
   no deja procesos del turno ni crecimiento de memoria sin explicación.
4. Resultados p95/RSS incluyen hardware, SO, Bun y fixture; separar inferencia de
   overhead del harness. Si hay incumplimientos, corregir o registrar el bloqueo.
5. Cada binario declarado soportado corre sin archivos del checkout, Bun, Node,
   dependencias de runtime instaladas ni descargas automáticas del harness. Probar
   clic, rueda, arrastre de ventanas y cierre de menús con mouse real, además del teclado.
6. Configurar un endpoint local caído, un modelo inválido y uno sin herramientas:
   errores comprensibles sin fallback cloud ni efectos duplicados.
7. El README permite reproducir una sesión local desde el binario con su servidor
   externo. No presenta capacidades pendientes como disponibles.

## Evidencia

| Tarea/caso | Artefacto o comando | Resultado y entorno |
| --- | --- | --- |
| — | — | Pendiente; no ejecutado. |

| Target | Compilado | Ejecutado sin Bun/Node | Terminal/drop | Estado |
| --- | --- | --- | --- | --- |
| Linux x64 | Pendiente | Pendiente | Pendiente | Pendiente |
| Linux arm64 | Pendiente | Pendiente | Pendiente | Pendiente |
| macOS x64 | Pendiente | Pendiente | Pendiente | Pendiente |
| macOS arm64 | Pendiente | Pendiente | Pendiente | Pendiente |
| Windows x64 | Pendiente | Pendiente | Pendiente | Pendiente |

## Cierre

MVP comprobado en el alcance declarado, resultados de rendimiento registrados y
artefactos reproducibles. No cerrar con plataformas requeridas sin validar: si no
hay equipos disponibles, dejar esa tarea pendiente y declarar el soporte parcial.
