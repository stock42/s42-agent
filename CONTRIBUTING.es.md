# Contribuir a S42 Agent

[English](CONTRIBUTING.md)

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
bun run index.ts --config /tmp/s42-contribution/config.json --cwd /ruta/proyecto-de-prueba
```

## Cambios

1. Sincronizá tu rama con `git pull` y mantené el cambio dentro del issue/pedido.
2. Usá TypeScript estricto; conservá `index.ts` como entrypoint. Componentes
   visuales en `src/ui/components/`; sin dependencias de runtime nuevas por rutina.
3. Validá `bun run typecheck` y `bun test`. Para cambios de TUI, revisá 80×24 y
   60×16, mouse/teclado, resize y modo sin color. No asignar teclas F1–F12.
4. Probá con configuración y proyectos temporales. Streaming, tools y sesiones
   deben conservar el proyecto que originó cada turno, aunque cambie la pestaña.
5. Actualizá README/docs si cambia el uso y CHANGELOG antes de hacer el commit.
6. Abrí un PR con problema, comportamiento resultante y validación ejecutada.

Los tests de fuente no requieren modelos ni API keys. Indicá por separado si
usaste un fixture, un proveedor real, mouse inyectado o mouse físico. Las pruebas
de binarios se hacen para cambios de distribución; no sustituyen la revisión TUI.

## Contenido del repositorio

Versionar tests, CI y herramientas reutilizables de build/release. Los informes
de smoke y manifiestos de build quedan en `dist/`, ignorado por Git. Planes,
informes locales, scripts de validación de tareas puntuales, campañas y prompts
de imágenes van en `private/`, también ignorado. Fuente, tests, CI y releases
deben funcionar sin esos archivos locales.

## Reportar un problema

Incluí SO, terminal, versión Bun, tamaño de ventana, pasos y comportamiento
esperado/observado. Para proveedores/MCP, indicar tipo y error recibido. Compartí
una configuración mínima con credenciales y datos personales retirados.

El workflow de CI usa las acciones oficiales [checkout](https://github.com/actions/checkout)
y [setup-bun](https://github.com/oven-sh/setup-bun) y ejecuta install/typecheck/tests
en Linux. La ejecución remota de CI se verifica en GitHub después de publicar.

El test de API key en el entrypoint real usa Bun.secrets. En Linux necesita
Secret Service; CI instala las dependencias del SO y usa un llavero temporal
en D-Bus aislado con credenciales de fixture.

Las contribuciones se distribuyen bajo la [licencia MIT](LICENSE).
