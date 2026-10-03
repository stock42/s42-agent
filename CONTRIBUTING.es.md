# Contribuir a S42 Agent

[English](CONTRIBUTING.md) · **Español**

Leé [AGENTS.md](AGENTS.md) antes de cambiar código. El objetivo es mantener un
harness pequeño, rápido y estable, con runtime Bun y una TUI estilo QBasic.

## Entorno

```bash
git clone https://github.com/stock42/s42-agent.git
cd s42-agent
bun install --frozen-lockfile
bun run dev
```

Bun 1.4.2 y terminal ANSI de al menos 60×16. Para una prueba aislada:

```bash
bun run index.ts --config /tmp/s42-contribution/agent.sqlite --cwd /ruta/proyecto-de-prueba
```

Los tests de fuente no requieren un LLM ni API key. Los tests de integración de
navegador usan uno compatible instalado y omiten ese escenario si no está disponible.

## Cambios

1. Ejecutá `git pull` en tu rama configurada antes de empezar. Conservá los cambios ajenos.
2. Usá TypeScript estricto; conservá `index.ts` como entrypoint. Componentes
   visuales en `src/ui/components/`; tools nativas en `src/agent/tools/`.
3. Validá `bun run typecheck` y `bun test`. Para cambios de TUI, revisá 80×24 y
   60×16, mouse/teclado, resize y modo sin color. No asignar teclas F1–F12.
4. Probá con configuración y proyectos temporales. Streaming, tools y sesiones
   deben conservar el proyecto que originó cada turno, aunque cambie la pestaña.
5. Actualizá ambas versiones de idioma de la documentación relevante y CHANGELOG antes del commit.
6. Hacé push del commit de la tarea a la rama remota configurada, sin force.
7. Abrí un PR con problema, comportamiento resultante y validación ejecutada.

Usá las APIs de Bun cuando correspondan. Evitá agregar dependencias de runtime
sin una necesidad concreta. Las pruebas de binarios se hacen para cambios de
distribución; no sustituyen la revisión TUI.

## Validación del flujo de tareas

`tests/workflow-integration.test.ts` recorre aplicación explícita de AGENTS.md, inicialización Git, pedido TUI, pruebas Bun y cierre Git reales, equivalente CLI, recuperación y un segundo proyecto. Su proveedor es un fixture de protocolo; no valida un modelo real. Las suites de tareas/Git/browser cubren conflictos, cierre interrumpido, evidencia vencida y propiedad de recursos.

La aceptación Chrome DevTools MCP es opt-in y usa programas externos ya instalados:

```bash
S42_CHROME_MCP_ENTRY=/ruta/absoluta/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js \
S42_BROWSER_NODE=/ruta/absoluta/node \
bun test tests/browser-real.test.ts
```

Sin esa variable el escenario Chrome real no se registra. Los tests de protocolo y la suite de fuente no prueban operación de Chrome/modelo. Usá `bun run dev` con configuración temporal para revisar la UI; registrá mouse físico del emulador por separado de eventos PTY inyectados.

## Contenido del repositorio

Versionar tests, CI y herramientas reutilizables de build/release. Los informes
de smoke y manifiestos de build quedan en `dist/`, ignorado por Git. Planes,
informes locales, scripts de validación de tareas puntuales, campañas y prompts
de imágenes van en `private/`, también ignorado. Fuente, tests, CI y releases
deben funcionar sin esos archivos locales.

## Reportar un problema

Se reciben reportes en español e inglés. Incluí SO, terminal, dimensiones,
versiones Bun/S42 Agent, pasos y comportamiento esperado/observado. Para
proveedores/MCP, indicá modelo o transporte y error recibido. Retirá credenciales
y datos privados de proyectos de los ejemplos compartidos.

Distinguí fixtures de validación con modelo real, y eventos de mouse inyectados
de interacción física en terminal. Cross-compilar no demuestra runtime en destino.

## CI y licencia

[CI](.github/workflows/ci.yml) usa las acciones oficiales checkout/setup-bun y
ejecuta instalación frozen, typecheck y tests en Linux. No publica releases ni
paquetes. Los tests de credenciales usan SQLite temporal y verifican autenticación
tras reiniciar sin D-Bus ni llavero de escritorio. Verificá CI remoto después de
subir el commit revisado.

Las contribuciones se distribuyen bajo la [licencia MIT](LICENSE).
