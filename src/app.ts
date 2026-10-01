import { basename } from "node:path";
import { ConfigStore, normalizeFolder, storagePaths, type Project, type Provider, type Model } from "./storage/config.ts";
import { Session, listSessions } from "./storage/sessions.ts";
import type { Selection } from "./agent/messages.ts";
import { createWorkspaceView } from "./ui/workspace.ts";
import { choose, form } from "./ui/dialogs.ts";
import { createDemoPanels } from "./ui/demo.ts";
import { theme } from "./ui/theme.ts";

export interface AppOptions { config?: string; project?: string; cwd?: string; provider?: string; model?: string; session?: string }
export class App {
  readonly view = createWorkspaceView({ name: "s42-agent", path: "" });
  readonly desktop = this.view.desktop;
  project?: Project;
  session?: Session;
  selection: Selection = { providerId: "llama.cpp" };
  status = "Listo";
  busy = false;
  readonly keys = new Map<string, string>();
  private operations: Promise<unknown> = Promise.resolve();
  private constructor(readonly store: ConfigStore, readonly sessionsPath: string, readonly cwd: string) {
    const { prompt, send, promptWindow } = this.view;
    this.view.editorWindow.onLayout = client => { this.view.response.bounds.y = 1; this.view.response.bounds.height = Math.max(1, client.height - 1); this.view.response.bounds.width = Math.max(1, client.width - 2); };
    this.view.editorWindow.onDraw = (canvas, client) => {
      let context = "No hay modelo configurado. Models → Configurar modelo";
      try { const { provider, model } = this.current(); context = `${provider.name} · ${model.id} · ${this.session?.state.id.slice(0, 8) ?? ""}`; } catch {}
      canvas.text(client.x + 1, client.y, context, theme.window, client.width - 2);
    };
    prompt.onSubmit = () => this.run(() => this.submit()); send.onClick = () => this.run(() => this.submit());
    promptWindow.onDraw = (canvas, client) => canvas.text(client.x + 1, client.y + client.height - 1,
      `${this.status} · Shift+Enter: línea`, { fg: 7, bg: 4 }, client.width - 2);
    const demo = createDemoPanels(this.desktop);
    this.desktop.menu.menus.splice(0, this.desktop.menu.menus.length,
      { label: "Archivo", items: [
        { label: "Nueva sesión", run: () => this.run(() => this.newSession()) },
        { label: "Sesiones", shortcut: "Ctrl+R", run: () => this.sessions() },
        { label: "Salir", shortcut: "Ctrl+Q", run: () => this.desktop.onExit() },
      ] },
      { label: "Proyectos", hotkey: "p", items: [
        { label: "Elegir proyecto", shortcut: "Ctrl+P", run: () => this.projects() },
        { label: "Agregar proyecto", run: () => this.projectForm() },
        { label: "Editar proyecto", run: () => this.projectForm(this.project) },
        { label: "Quitar del registro", run: () => this.removeProject() },
      ] },
      { label: "Models", hotkey: "m", items: [
        { label: "Elegir modelo", shortcut: "Ctrl+O", run: () => this.models() },
        { label: "Configurar modelo", run: () => this.modelForm() },
        { label: "Agregar modelo", run: () => this.modelForm(true) },
        { label: "Quitar modelo", run: () => this.removeModel() },
        { label: "Proveedores", shortcut: "Ctrl+B", run: () => this.providers() },
        { label: "Nuevo proveedor", run: () => this.modelForm(true, true) },
        { label: "Guardar default", run: () => this.run(() => this.saveDefault()) },
      ] },
      { label: "Ventanas", items: [
        { label: "Respuestas", run: () => this.desktop.focus(this.view.editorWindow) },
        { label: "Prompt", run: () => this.desktop.focus(promptWindow) },
        { label: "Componentes", run: demo.components },
        { label: "Siguiente", shortcut: "Ctrl+N", run: () => this.desktop.cycle() },
        { label: "Cerrar auxiliar", shortcut: "Ctrl+W", run: () => this.desktop.close() },
      ] },
      { label: "Ayuda", hotkey: "y", align: "right", items: [{ label: "Atajos y mouse", run: () => this.desktop.onHelp() }] },
    );
    this.desktop.onShortcut = event => {
      if (event.type !== "key" || this.desktop.modal) return false;
      const actions: Record<string, () => void> = { "ctrl+p": () => this.projects(), "ctrl+o": () => this.models(), "ctrl+b": () => this.providers(), "ctrl+r": () => this.sessions() };
      const action = actions[event.key]; if (!action) return false; this.desktop.menu.close(); action(); return true;
    };
    this.desktop.onBeforeExit = async () => { await this.operations; await this.saveDraft(); await this.session?.close(); };
  }
  static async open(options: AppOptions = {}): Promise<App> {
    const paths = storagePaths(options.config), store = await ConfigStore.load(paths.config), app = new App(store, paths.sessions, process.cwd());
    let project: Project | undefined;
    if (options.cwd) {
      const path = await normalizeFolder(options.cwd, app.cwd);
      project = store.value.projects.find(p => p.path === path) ?? await store.project(basename(path), path, app.cwd);
    } else if (options.project) project = store.resolveProject(options.project);
    else project = store.value.projects.find(p => p.id === (store.value.lastProjectId ?? store.value.defaults.projectId)) ?? store.value.projects[0];
    if (project) await app.switchProject(project, options.session);
    if (options.provider || options.model) await app.selectModel({ providerId: options.provider ?? app.selection.providerId, modelId: options.model ?? app.selection.modelId });
    app.showContext(); if (!project) app.projectForm();
    return app;
  }
  run(work: () => Promise<unknown>): void {
    this.operations = this.operations.then(work).catch(e => { this.status = (e as Error).message; this.showContext(); this.desktop.invalidate(); });
  }
  private requireIdle(): void { if (this.busy) throw new Error("Hay un turno activo: cancelalo antes de cambiar de contexto"); }
  private async saveDraft(): Promise<void> {
    if (this.session) await this.session.append({ type: "draft", text: this.view.prompt.value, attachments: this.session.state.attachments });
  }
  async switchProject(project: Project, id?: string): Promise<void> {
    this.requireIdle(); await normalizeFolder(project.path, this.cwd);
    id ??= project.lastSessionId;
    if (this.project?.id === project.id && this.session?.state.id === id) return;
    const next = await Session.open(this.sessionsPath, project.id, id);
    try { if (!next.state.events.length) await next.append({ type: "session", title: new Date().toLocaleString("es") }); await this.saveDraft(); await this.session?.close(); }
    catch (e) { await next.close(); throw e; }
    this.project = project; this.session = next;
    this.selection = next.state.selection ?? project.selection ?? this.store.value.defaults;
    this.view.prompt.setValue(next.state.draft); this.view.editorWindow.title = project.name;
    const config = structuredClone(this.store.value); config.lastProjectId = project.id;
    config.projects.find(p => p.id === project.id)!.lastSessionId = next.state.id; project.lastSessionId = next.state.id;
    await this.store.save(config);
    this.showHistory(); this.showContext(); this.desktop.focus(this.view.promptWindow); this.desktop.invalidate();
  }
  async newSession(): Promise<void> { this.requireIdle(); if (!this.project) { this.projectForm(); return; } await this.switchProject(this.project, crypto.randomUUID()); }
  projects(): void { choose(this.desktop, "Proyectos", this.store.value.projects.map(value => ({ label: `${value.name} · ${value.path}`, value })), p => this.run(() => this.switchProject(p))); }
  projectForm(project?: Project): void {
    if (this.busy) { this.status = "Cancelá el turno antes de editar proyectos"; return; }
    form(this.desktop, project ? "Editar proyecto" : "Agregar proyecto", [{ label: "Nombre", value: project?.name ?? basename(this.cwd) }, { label: "Carpeta", value: project?.path ?? this.cwd }], async ([name, path]) => {
      const saved = await this.store.project(name!, path!, this.cwd, project?.id);
      await this.switchProject(saved);
    });
  }
  removeProject(): void {
    choose(this.desktop, "Quitar proyecto del registro", this.store.value.projects.map(value => ({ label: value.name, value })), project => this.run(async () => {
      this.requireIdle(); const next = structuredClone(this.store.value); next.projects = next.projects.filter(p => p.id !== project.id); if (next.lastProjectId === project.id) delete next.lastProjectId;
      await this.store.save(next);
      if (this.project?.id === project.id) { await this.saveDraft(); await this.session?.close(); this.session = undefined; this.project = undefined; this.view.prompt.setValue(""); this.view.response.setValue(""); this.view.editorWindow.title = "s42-agent"; this.showContext(); }
    }));
  }
  sessions(): void { this.run(async () => { if (!this.project) { this.projectForm(); return; } const project = this.project;
    choose(this.desktop, "Sesiones", (await listSessions(this.sessionsPath, project.id)).map(value => ({ label: `${value.title} · ${value.id.slice(0, 8)}`, value })), s => this.run(() => this.switchProject(project, s.id))); }); }
  current(): { provider: Provider; model: Model } {
    const provider = this.store.value.providers.find(p => p.id === this.selection.providerId), model = provider?.models.find(m => m.id === this.selection.modelId);
    if (!provider || !model) throw new Error("No hay modelo configurado. Abrí Models → Configurar modelo."); return { provider, model };
  }
  showContext(): void {
    let selected = "No hay modelo configurado. Abrí Models → Configurar modelo.";
    try { const { provider, model } = this.current(); selected = `${provider.name} · ${model.id}${model.capabilities.tools ? "" : " · sin tools"}`; } catch {}
    this.view.response.placeholder = `${this.project?.path ?? "Registrá un proyecto en Proyectos → Agregar proyecto."}\n\n${selected}`;
    if (!this.session?.state.messages.length) this.status = selected;
    this.desktop.invalidate();
  }
  showHistory(): void {
    const messages = this.session?.state.messages ?? [];
    this.view.response.setValue(messages.map(m => `${m.role === "user" ? "Vos" : m.role === "assistant" ? "Agente" : "Herramienta"}:\n${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}${m.tool_calls ? "\n" + m.tool_calls.map(c => `${c.function.name} ${c.function.arguments}`).join("\n") : ""}`).join("\n\n") + (this.session?.state.notices.length ? "\n\n" + this.session.state.notices.join("\n") : ""), "start");
  }
  async selectModel(selection: Selection): Promise<void> { this.requireIdle(); const old = this.selection; this.selection = selection;
    try { this.current(); await this.session?.append({ type: "selection", selection }); if (this.session) this.session.state.selection = selection; }
    catch (e) { this.selection = old; throw e; } this.status = "Modelo elegido"; this.showContext(); }
  models(): void { choose(this.desktop, "Models · elegir", this.store.value.providers.flatMap(p => p.models.map(m => ({ label: `${p.name} · ${m.id}`, value: { providerId: p.id, modelId: m.id } }))), s => this.run(() => this.selectModel(s))); }
  providers(): void { choose(this.desktop, "Proveedores", this.store.value.providers.map(value => ({ label: `${value.name} · ${value.baseUrl}`, value })), p => { this.selection = { providerId: p.id }; this.modelForm(); }); }
  modelForm(add = false, newProvider = false): void {
    if (this.busy) { this.status = "Cancelá el turno antes de configurar modelos"; return; }
    const provider = this.store.value.providers.find(p => p.id === this.selection.providerId) ?? this.store.value.providers[0];
    const model = add ? undefined : provider?.models.find(m => m.id === this.selection.modelId);
    const url = new URL(newProvider ? "http://127.0.0.1:8080/v1" : provider?.baseUrl ?? "http://127.0.0.1:8080/v1"), port = url.port; url.port = "";
    form(this.desktop, "Models · host, puerto y modelo", [
      { label: "ID del modelo", value: model?.id ?? "" }, { label: "Nombre", value: model?.name ?? "" }, { label: "Host / URL base", value: url.href.replace(/\/$/, "") },
      { label: "Puerto", value: port }, { label: "API key (sesión)", value: "" }, { label: "Variable API key", value: provider?.apiKeyEnv ?? "" },
      { label: "Contexto", value: String(model?.contextWindow ?? 8192) }, { label: "Máximo salida", value: String(model?.maxOutputTokens ?? 2048) },
      { label: "Tools / imágenes", value: `${model?.capabilities.tools ? "sí" : "no"}/${model?.capabilities.images ? "sí" : "no"}` },
    ], async ([id, name, host, port, apiKey, apiKeyEnv, context, max, caps]) => {
      this.requireIdle(); if (!id?.trim()) throw new Error("Escribí el ID real del modelo");
      const endpoint = new URL(host!); if (port && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)) throw new Error("Puerto inválido"); endpoint.port = port ?? "";
      const next = structuredClone(this.store.value), providerId = newProvider ? crypto.randomUUID() : provider?.id ?? "llama.cpp";
      let configured = next.providers.find(p => p.id === providerId);
      if (!configured) { configured = { id: providerId, name: newProvider ? endpoint.host : "Local · llama.cpp", kind: newProvider ? "openai-compatible" : "llama.cpp", baseUrl: endpoint.href, models: [] }; next.providers.push(configured); }
      configured.baseUrl = endpoint.href.replace(/\/$/, ""); configured.apiKeyEnv = apiKeyEnv?.trim() || undefined;
      const capabilities = caps!.toLowerCase().split("/"); if (capabilities.length !== 2 || !capabilities.every(c => ["sí", "si", "no"].includes(c))) throw new Error("Capacidades: sí/no, no/no o sí/sí");
      const saved: Model = { id: id.trim(), name: name?.trim() || id.trim(), contextWindow: Number(context), maxOutputTokens: Number(max), capabilities: { tools: capabilities[0] !== "no", images: capabilities[1] !== "no" } };
      if (add && configured.models.some(m => m.id === saved.id)) throw new Error("Ese modelo ya está registrado");
      configured.models = [...configured.models.filter(m => m.id !== (model?.id ?? saved.id)), saved];
      await this.store.save(next); if (apiKey) this.keys.set(providerId, apiKey);
      await this.selectModel({ providerId, modelId: saved.id });
    });
  }
  removeModel(): void { choose(this.desktop, "Quitar modelo", this.store.value.providers.flatMap(p => p.models.map(m => ({ label: `${p.name} · ${m.id}`, value: { p: p.id, m: m.id } }))), s => this.run(async () => {
    this.requireIdle(); const next = structuredClone(this.store.value); next.providers.find(p => p.id === s.p)!.models = next.providers.find(p => p.id === s.p)!.models.filter(m => m.id !== s.m); await this.store.save(next); this.showContext();
  })); }
  async saveDefault(): Promise<void> { this.requireIdle(); this.current(); const next = structuredClone(this.store.value); next.defaults = { ...this.selection, projectId: this.project?.id }; await this.store.save(next); this.status = "Default guardado"; this.desktop.invalidate(); }
  async submit(): Promise<void> {
    const text = this.view.prompt.value;
    if (text.startsWith("/")) {
      const commands: Record<string, () => void> = { "/projects": () => this.projects(), "/models": () => this.models(), "/providers": () => this.providers(), "/sessions": () => this.sessions(), "/new": () => this.run(() => this.newSession()), "/help": () => this.desktop.onHelp(), "/quit": () => this.desktop.onExit() };
      const action = commands[text.trim()]; if (!action) throw new Error("Comando desconocido. /help"); this.view.prompt.setValue(""); action(); return;
    }
    this.requireIdle(); if (!text.trim()) return;
    if (!this.project || !this.session) throw new Error("Registrá o elegí un proyecto antes de enviar");
    this.current(); throw new Error("Proveedor listo; transporte LLM en implementación");
  }
}
