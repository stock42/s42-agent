# Fase 17 — Config global y APIs nativas Bun

Estado: **Completada desde fuente en Linux**. Requisito R32; depende de 02–04,
08, 12 y 16. Runtime Windows/macOS pendiente; no se hicieron builds.

- [x] Verificar rutas globales por SO y conservar --config explícito.
- [x] Corregir fallback de variables vacías y AppData ausente.
- [x] Recordar selección automáticamente en sesión/proyecto/default global.
- [x] Recuperar config antigua con modelo único sin requests al iniciar.
- [x] Persistir claves TUI con Bun.secrets y referencias en JSON; campos
  enmascarados, estado guardada y vacío conserva, alternativa variable.
- [x] Recuperar claves en otro proceso y comprobar autenticación tras reinicio.
- [x] Usar Bun Shell para shell/Git/nvidia-smi conservando cwd, timeout,
  cancelación de árbol, resultados y escape de argv internos.
- [x] Agregar scrape con Bun.WebView, CSS/texto/HTML/enlaces, contenido JS,
  límites, timeout/cancelación y cierre; catálogo ES/EN.
- [x] Actualizar README, AGENTS, SPECS, TOOLS y CHANGELOG.

| Evidencia | Resultado |
| --- | --- |
| bun run typecheck | Sin errores. |
| bun test | 150 pass, 0 fail; 32 archivos, 2733 assertions antes del hint final del formulario. |
| bun test focalizado final | 22 pass, 0 fail; 5 archivos. |
| [QA](../qa/global-config-and-bun-native.md) | Persistencia entre procesos y navegador reales; fixtures de fallos/límites. |
| [Llavero Linux](../qa/global-config-live.json) | Formulario → llavero → cierre → index.ts en PTY → autenticación, exit 0. |

Git pull falló por main sin upstream. Trabajo local, sin push; configuración
personal y docs/qa/final-validation.md ajeno preservados. APIs Secrets/WebView
experimentales: uso explícitamente solicitado por el usuario. No se descargaron
navegadores ni se validó runtime de otros SO.
