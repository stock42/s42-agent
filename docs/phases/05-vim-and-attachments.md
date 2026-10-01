# Fase 05 — Vim, drag & drop y adjuntos

Estado: **Pendiente**. Dependencias: [01](01-terminal-ui.md),
[02](02-projects-and-sessions.md), [03](03-providers-and-local-llm.md),
[04](04-agent-loop-and-tools.md). Requisitos: R07, R08.
Contratos: SPECS §5 y §10.

## Objetivo

Operar el agente con el subconjunto Vim acordado y transformar archivos arrastrados
al terminal en adjuntos verificables, con alternativas de teclado.

## Tareas

- [ ] F05-01. Implementar INSERT/NORMAL con foco explícito, movimientos, edición
  y undo del borrador conforme al mapa de SPECS; arrancar en INSERT.
- [ ] F05-02. Conectar acciones globales y leader con selectores de proyectos,
  modelos, proveedores, sesiones, adjuntos y ayuda; permitir desactivar Vim.
- [ ] F05-03. Validar bindings configurables por contexto y documentar los que el
  terminal no distingue. Mantener Ctrl+J como newline portable. Menús, controles
  y diálogos tienen prioridad sobre Vim; mouse y teclado siguen siendo operables.
- [ ] F05-04. Implementar parser de rutas pegadas: POSIX, espacios/comillas,
  Windows/UNC, Unicode, `file://` y múltiples archivos; sin evaluar como shell.
- [ ] F05-05. Integrar drop mediante bracketed paste en ambos modos y fallback
  sin marcadores en INSERT. No enviar inferencia por drop/paste.
- [ ] F05-06. Crear `/attach`, `/detach` y gestión con Ctrl+F, mostrando lista,
  tamaño, ruta y errores en el mismo borrador.
- [ ] F05-07. Preparar texto UTF-8 e imágenes de modelos con capacidad explícita;
  validar límites y rechazar modalidades sin soporte con mensaje accionable.
- [ ] F05-08. Revalidar archivos antes del envío y persistir el contenido enviado
  con la sesión; reabrir sin sustituirlo por una nueva versión del archivo original.
- [ ] F05-09. Probar automáticamente secuencias de paste y manualmente drag &
  drop desde el SO. Registrar formatos observados por terminal y plataforma.
- [ ] F05-10. Repetir atajos y adjuntos desde el binario; registrar evidencia,
  actualizar CHANGELOG y hacer el commit de cada tarea completada.

## Escenarios de aceptación

1. Escribir un prompt, pasar a NORMAL, navegar/editar/deshacer y volver a INSERT;
   Ctrl+P elige otro proyecto inactivo sin perder los borradores. La ayuda refleja
   el modo/foco y no promete acciones Vim inexistentes.
2. Pegar contenido que contiene `i`, `dd`, Escape y Enter en NORMAL: se inserta
   como paste, sin movimientos, eliminación ni envío.
3. Arrastrar dos archivos con espacios y tildes desde un explorador real. Ambos
   aparecen como adjuntos pendientes y solo se envían después de Enter explícito.
4. En terminal sin marcadores, en INSERT, pegar una línea de rutas y pulsar Enter:
   adjunta sin enviar. Con `/attach` se obtiene el mismo contenido.
5. Pegar un bloque de código que menciona un path: permanece como texto, sin
   convertir referencias arbitrarias en adjuntos.
6. Archivo ausente, ilegible, demasiado grande, carpeta o PDF: error visible sin
   bloqueo ni envío engañoso. Quitar el adjunto permite continuar.
7. Modelo sin imágenes: no enviar una imagen incompatible. Modelo/endpoint fixture
   con imágenes: verificar bytes/payload real y límite después de base64.
8. Tras enviar un texto adjunto, modificar o borrar el archivo original y reabrir:
   el historial conserva el contenido enviado. Antes de enviar, el cambio pide
   actualizar la previsualización de forma explícita.
9. Repetir los casos de rutas en Linux, macOS y Windows. Las rutas simuladas
   validan el parser, pero no sustituyen el drop manual en cada terminal.

## Evidencia

| Tarea/caso | Secuencia, captura o fixture | Resultado, SO y terminal/versión |
| --- | --- | --- |
| — | — | Pendiente; no ejecutado. |

## Cierre

Mapa Vim implementado y documentado, drop real probado en los terminales declarados
soportados y fallback por teclado disponible. No exige implementar un editor completo.
