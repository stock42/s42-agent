import { Extensions } from "./ui/extensions.ts";
import { Promptings } from "./ui/promptings.ts";
import { basename, dirname, resolve, sep } from "node:path";
import { ConfigStore, defaultProviders, modelSelection, normalizeFolder, storagePaths, validateConfig, type Project, type Provider, type Model, type ResourceIndicators } from "./storage/config.ts";
import { saveCredential, deleteCredential } from "./storage/credentials.ts";
import { Session, listSessions } from "./storage/sessions.ts";
import type { Message, Selection, ToolCall } from "./agent/messages.ts";
import { createWorkspaceView } from "./ui/workspace.ts";
import { choose, form, info } from "./ui/dialogs.ts";
import { palettes, theme, type PaletteId } from "./ui/theme.ts";
import { CompletionError, credential, discoverModels } from "./llm/client.ts";
import { runTurn } from "./agent/loop.ts";
import { markdownText } from "./ui/markdown.ts";
import { contentWithAttachments, hasImages, parsePaths, pastedPaths, snapshot, validateAttachments, type Attachment } from "./agent/attachments.ts";
import { bindings, type Action } from "./ui/bindings.ts";
import type { InputEvent } from "./ui/types.ts";
import { readdir } from "node:fs/promises";
import { FileExplorer } from "./ui/components/file-explorer.ts";
import { TabBar } from "./ui/components/tab-bar.ts";
import { createProjectTab, type ProjectTab } from "./project-tab.ts";
import { showAbout } from "./ui/about.ts";
import { SystemMonitor, metricLines, tokenLine } from "./system/metrics.ts";
import { activeHistory } from "./agent/context.ts";
import { nativeTools } from "./agent/tools.ts";
import { emptyUsage } from "./agent/usage.ts";
import type { Language } from "./ui/i18n.ts";
import type { TextFragment } from "./ui/components/text-area.ts";
import { openFileTab, type FileTab } from "./file-tab.ts";
import type { TabItem } from "./ui/components/tab-bar.ts";
import { ProjectWebServers } from "./system/webserver.ts";
import { showWebServer } from "./ui/webserver.ts";

export interface AppOptions { config?: string; project?: string; cwd?: string; provider?: string; model?: string; session?: string }
export class App {
  readonly view = createWorkspaceView({ name: "s42-agent", path: "" }, false);
  readonly desktop = this.view.desktop;
  readonly tabs: ProjectTab[] = [createProjectTab(this.view)];
  readonly fileTabs: FileTab[] = [];
  private activeFile?: FileTab;
  private activeTab = this.tabs[0]!;
  get project() { return this.activeTab.project; }
  get session() { return this.activeTab.session; }
  get selection() { return this.activeTab.selection; }
  set selection(value: Selection) { this.activeTab.selection = value; }
  get status() { return this.activeTab.status; }
  set status(value: string) { this.activeTab.status = value; }
  get busy() { return this.activeTab.busy; }
  set busy(value: boolean) { this.activeTab.busy = value; }
  readonly keys = new Map<string, string>();
  get attachments() { return this.activeTab.attachments; }
  set attachments(value: Attachment[]) { this.activeTab.attachments = value; }
  readonly extensions:Extensions;
  readonly promptings: Promptings;
  readonly metrics: SystemMonitor;
  readonly webservers = new ProjectWebServers();
  get mode() { return this.activeTab.mode; }
  set mode(value: "INSERT" | "NORMAL") { this.activeTab.mode = value; }
  private get pending() { return this.activeTab.pending; }
  private set pending(value: string) { this.activeTab.pending = value; }
  private get pasting() { return this.activeTab.pasting; }
  private set pasting(value: boolean) { this.activeTab.pasting = value; }
  private operations: Promise<unknown> = Promise.resolve();
  private opening = false;
  private activityTimer?: ReturnType<typeof setInterval>;
  private activityFrame = 0;
  private get controller() { return this.activeTab.controller; }
  private set controller(value: AbortController | undefined) { this.activeTab.controller = value; }
  private constructor(readonly store: ConfigStore, readonly sessionsPath: string, readonly cwd: string) {
    this.selection = modelSelection(store.value);
    this.desktop.palette = store.value.ui.palette;
    this.desktop.language = store.value.ui.language;
    this.metrics = new SystemMonitor(() => this.project?.path ?? this.cwd);
    this.desktop.statusLines = () => metricLines(this.metrics.snapshot, this.store.value.ui.resources, this.desktop.width, this.desktop.t);
    this.desktop.onStart = () => this.metrics.start(() => {
      const rows = Math.max(1, this.desktop.statusLines!().length);
      if (this.view.promptWindow.bounds.y + this.view.promptWindow.bounds.height !== this.desktop.height - rows) this.desktop.resize(this.desktop.width, this.desktop.height);
      this.desktop.invalidate();
    });
    const { promptWindow } = this.view;
    this.bindTab(this.activeTab);
    this.desktop.tabs = new TabBar(() => this.tabItems(),
      () => this.activeFile?.id ?? this.activeTab.id, id => this.run(() => this.activateTab(id)), id => this.run(() => this.closeTab(id)), () => this.projects());
    const resize=this.desktop.onResize!;
    this.desktop.onResize=(width,height)=>{resize(width,height);if(this.attachments.length && promptWindow.client.height<4){
      promptWindow.bounds.height++;promptWindow.bounds.y--;this.view.editorWindow.bounds.height--;this.desktop.floatingArea={...this.view.editorWindow.bounds};
    }};
    this.view.editorWindow.onLayout = client => {
      this.view.editorWindow.titleSuffix = !this.activeFile && this.activeTab.agentState ? ` · ${["|", "/", "-", "\\"][this.activityFrame]}` : "";
      this.view.response.bounds.y = 1; this.view.response.bounds.height = Math.max(1, client.height - 1 - Number(!this.activeFile && Boolean(this.activeTab.agentState)));
      this.view.response.bounds.width = Math.max(1, client.width - 2);
    };
    this.view.editorWindow.onDraw = (canvas, client) => {
      if (this.activeFile) {
        const file = this.activeFile;
        canvas.text(client.x + 1, client.y, [this.project?.name, file.language?.toUpperCase() ?? "TXT", this.desktop.t(`${file.size} bytes · solo lectura`), file.path].filter(Boolean).join(" · "), theme.window, client.width - 2);
        return;
      }
      let context = this.desktop.t("No hay modelo configurado. Models → Proveedores");
      try { const { provider, model } = this.current(); context = `${provider.name} · ${model.id} · ${this.session?.state.id.slice(0, 8) ?? ""}`; } catch {}
      canvas.text(client.x + 1, client.y, context, theme.window, client.width - 2);
      if (this.activeTab.agentState) {
        const label = `${this.desktop.t("Agente")}:`, y = client.y + client.height - 1;
        canvas.text(client.x + 1, y, label, theme.chatAgent, client.width - 2);
        canvas.text(client.x + 1 + Bun.stringWidth(label), y, ` ${this.desktop.t(this.activeTab.agentState)}`, theme.window, client.width - 2 - Bun.stringWidth(label));
      }
    };
    promptWindow.onLayout = client => {
      const { prompt } = this.view;
      prompt.bounds.y = 1; prompt.bounds.width = Math.max(1, client.width - 2);
      prompt.bounds.height = Math.max(1, client.height - 2 - (this.attachments.length ? 1 : 0));
    };
    promptWindow.onDraw = (canvas, client) => {
      const tokens = tokenLine(this.activeTab.tokens, this.desktop.t, this.activeTab.contextUsage, client.width - 2);
      canvas.text(client.x + client.width - 1 - Bun.stringWidth(tokens), client.y, tokens, theme.window);
      if (this.attachments.length) canvas.text(client.x + 1, client.y + client.height - 2,
        this.desktop.t(`Adjuntos (${this.attachments.length}): ${this.attachments.map(a => `${a.name} ${a.size} B`).join(" · ")} · ${this.bindingLabel("attachments")}`), theme.window, client.width - 2);
      const hint=this.desktop.t("Shift+Enter: línea"), available=Math.max(1,client.width - 5 - Bun.stringWidth(hint));
      canvas.text(client.x + 1, client.y + client.height - 1, this.activeTab.agentState ? this.mode : `${this.mode} · ${this.statusText()}`, theme.window, available);
      canvas.text(client.x + 1 + available,client.y + client.height - 1," · "+hint,theme.window,client.width - available - 2);
    };
    this.extensions=new Extensions({desktop:this.desktop,store:this.store,cwd:this.cwd,project:()=>this.project,idle:()=>this.requireIdle(),change:task=>this.change(async()=>{this.requireIdle();await task();}),run:task=>this.run(task),task:(label,operation)=>this.task(label,operation),status:text=>{if(text.startsWith("/skill ")){this.view.prompt.setValue(text+" ");this.desktop.focus(this.view.promptWindow);}else this.status=text;this.desktop.invalidate();}});
    this.promptings = new Promptings({ desktop: this.desktop, store: this.store, idle: () => this.requireIdle(),
      change: work => this.change(work), run: work => this.run(work), load: (text, execute) => this.loadPrompting(text, execute),
      status: text => { this.status = text; this.desktop.invalidate(); } });
    this.desktop.menu.menus.splice(0, this.desktop.menu.menus.length,
      { label: "Archivo", items: [
        { label: "Explorador de archivos", run: () => this.explore() },
        { label: "Adjuntos", run: () => this.attachmentMenu() },
        { label: "Salir", shortcut: "Ctrl+Q", run: () => this.desktop.onExit() },
      ] },
      { label: "Projects", hotkey: "p", items: [
        { label: "Abrir proyecto", shortcut: "Ctrl+P", run: () => this.projects() },
        { label: "Agregar proyecto", run: () => this.projectForm() },
        { label: "Editar proyecto", run: () => this.projectForm(this.project) },
        { label: "Quitar del registro", run: () => this.removeProject() },
        { label: "Nueva sesión", run: () => this.run(() => this.newSession()) },
        { label: "Sesiones", shortcut: "Ctrl+R", run: () => this.sessions() },
        { label: "Pestaña anterior", shortcut: "Alt+←", run: () => this.cycleTab(-1) },
        { label: "Pestaña siguiente", shortcut: "Alt+→", run: () => this.cycleTab(1) },
        { label: "Cerrar pestaña", shortcut: "Ctrl+W", run: () => this.run(() => this.closeTab(this.activeTab.id)) },
      ] },
      { label: "Models", hotkey: "m", items: [
        { label: "Elegir modelo", shortcut: "Ctrl+O", run: () => this.models() },
        { label: "Configurar modelo", run: () => this.modelForm() },
        { label: "Agregar modelo", run: () => this.modelForm(true) },
        { label: "Quitar modelo", run: () => this.removeModel() },
        { label: "Proveedores", shortcut: "Ctrl+B", run: () => this.providers() },
        { label: "Nuevo proveedor", run: () => this.providers(true) },
        { label: "Descubrir /models", run: () => this.run(() => this.discover()) },
        { label: "Guardar default", run: () => this.run(() => this.saveDefault()) },
        { label: "Default del proyecto", run: () => this.run(() => this.saveProjectDefault()) },
        { label: "Quitar proveedor", run: () => this.removeProvider() },
      ] },
      { label: "Promptings", hotkey: "t", items: [
        { label: "Biblioteca", run: () => this.promptings.library() },
        { label: "Nuevo prompting", run: () => this.promptings.editor() },
        { label: "Guardar prompt actual", run: () => this.promptings.editor(undefined, this.view.prompt.value) },
      ] },
      { label: "Tools", hotkey: "o", items: [
        { label: "WebServer", run: () => this.webServer() },
        { label: "Nativas · catálogo", run: () => choose(this.desktop, this.desktop.t("Tools nativas"), nativeTools.map(tool => ({ label: tool.definition.function.name, value: tool })), tool => info(this.desktop, this.desktop.t(`Tool · ${tool.definition.function.name}`), [this.desktop.t(tool.definition.function.description), "", JSON.stringify(tool.definition.function.parameters, null, 2)])) },
        { label: "MCP · servidores", run: () => this.extensions.servers() },
        { label: "MCP · agregar stdio", run: () => this.extensions.serverForm("stdio") },
        { label: "MCP · agregar HTTP", run: () => this.extensions.serverForm("http") },
        { label: "Skills · registradas", run: () => this.extensions.skills() },
        { label: "Skills · registrar SKILL.md", run: () => this.extensions.skillForm() },
        { label: "Skills · buscar en skills.sh", run: () => this.extensions.search() },
      ] },
      { label: "Vista", items: [
        { label: "Respuestas", run: () => { this.displayTab(this.activeTab); this.desktop.focus(this.view.editorWindow); } },
        { label: "Prompt", run: () => this.desktop.focus(promptWindow) },
        { label: "Paleta de colores", run: () => this.colorPalette() },
        ...(["cpu", "ram", "disk", "gpu"] as const).map(key => ({
          label: `${this.resourceLabel(key)}: ${store.value.ui.resources[key] ? "on" : "off"}`,
          run: () => this.run(() => this.toggleResource(key)),
        })),
        { label: "Language", run: () => this.language() },
        { label: `Ver razonamiento: ${store.value.ui.showReasoning ? "on" : "off"}`, run: () => this.run(() => this.toggleReasoning()) },
        { label: "Cambiar panel", shortcut: "Ctrl+N", run: () => this.desktop.cycle() },
        { label: "Cerrar auxiliar", shortcut: "Ctrl+W", run: () => this.desktop.close() },
        { label: "Activar / desactivar Vim", run: () => this.run(async () => {
          const next = structuredClone(this.store.value); next.ui.vimMode = !next.ui.vimMode;
          await this.store.save(next); for (const tab of this.tabs) { tab.mode = "INSERT"; tab.pending = ""; }
          this.status = `Vim ${next.ui.vimMode ? "activado" : "desactivado"}`;
        }) },
      ] },
      { label: "Ayuda", hotkey: "y", align: "right", items: [
        { label: "Atajos y mouse", run: () => this.desktop.onHelp() },
        { label: "About", run: () => showAbout(this.desktop) },
      ] },
    );
    const actionLabels:Record<Action,string>={projects:"Abrir proyecto",models:"Elegir modelo",providers:"Proveedores",sessions:"Sesiones",attachments:"Adjuntos",explorer:"Explorador de archivos",mcp:"MCP · servidores",skills:"Skills · registradas",promptings:"Biblioteca",help:"Atajos y mouse"};
    for(const menu of this.desktop.menu.menus) for(const item of menu.items) {
      const action=(Object.keys(actionLabels) as Action[]).find(action=>actionLabels[action]===item.label);if(action)item.shortcut=this.bindingLabel(action);
    }
    this.desktop.onHelp = () => info(this.desktop, this.desktop.t("Ayuda · " + this.mode), [
      "Enter enviar · Shift+Enter nueva línea", ...Object.entries(bindings(this.store.value.ui.bindings).global).map(([action,key])=>`${key}: ${this.desktop.t(actionLabels[action as Action])}`), "Ctrl+C: cancelar turno · Ctrl+Q: salir",
      "Esc: INSERT → NORMAL → menú; modal: cerrar", "NORMAL: h/j/k/l w/b 0/$ · i/a/I/A · x dd u", "Conversación: j/k Ctrl+D/U gg/G; solo lectura",
      ...Object.entries(bindings(this.store.value.ui.bindings).normal).map(([action,key])=>`${key}: ${this.desktop.t(actionLabels[action as Action])}`), "Ctrl+N: cambiar panel",
      "Comandos: /help /projects /models /providers", "/sessions /files /new /attach ruta /detach /quit", "/mcp /skills /skill nombre prompt · Alt+C MCP · Alt+S Skills",
      "/promptings: biblioteca · menú Promptings: guardar borrador",
      "Alt+←/→: pestaña · Alt+1…9: pestaña · Ctrl+W: cerrar",
      "~ en pestaña: turno activo · Ctrl+C cancela la actual",
    ].map(this.desktop.t));
    this.desktop.onShortcut = event => {
      if (event.type !== "key") return false;
      const { prompt } = this.view;
      if (event.key === "ctrl+c" && this.busy) { this.cancel(); return true; }
      if (event.key === "ctrl+c" && this.tabs.some(tab => tab.busy)) { this.status = "Hay proyectos trabajando: elegí su pestaña para cancelar, o Ctrl+Q para salir"; return true; }
      if(["escape","tab","shift+tab","ctrl+n","ctrl+w"].includes(event.key))this.pending="";
      if (this.desktop.modal || this.desktop.menu.opened >= 0) return false;
      if (event.key === "alt+left" || event.key === "alt+right") { this.cycleTab(event.key === "alt+right" ? 1 : -1); return true; }
      if (/^alt\+[1-9]$/.test(event.key)) {
        const tab = this.tabItems()[Number(event.key.slice(4)) - 1]; if (tab) this.run(() => this.activateTab(tab.id)); return true;
      }
      if (event.key === "ctrl+w" && this.desktop.active?.fixed) { this.run(() => this.closeTab(this.activeFile?.id ?? this.activeTab.id)); return true; }
      if (event.key === "escape" && this.store.value.ui.vimMode && this.mode === "INSERT" && this.desktop.active === promptWindow && promptWindow.focusedId === prompt.id) { this.mode = "NORMAL"; this.pending = ""; return true; }
      if (event.key === "tab" && this.mode === "NORMAL" && this.desktop.active?.fixed) {
        this.desktop.focus(this.desktop.active === promptWindow ? this.view.editorWindow : promptWindow); promptWindow.focusedId = prompt.id; this.pending = ""; return true;
      }
      if(event.key==="tab" && this.desktop.active===promptWindow && promptWindow.focusedId===prompt.id && this.mode==="INSERT") {
        const text=prompt.value, commands=["/help","/projects","/providers","/models","/sessions","/files","/mcp","/skills","/skill","/promptings","/new","/attach","/detach","/quit"];
        if(/^\/[a-z]*$/.test(text)) {const matches=commands.filter(c=>c.startsWith(text));if(matches.length){prompt.setValue(matches[0]!);return true;}}
        if(text.startsWith("/attach ")) {this.run(async()=>{const raw=text.slice(8),path=resolve(this.project?.path??this.cwd,raw);const entries=await readdir(dirname(path),{withFileTypes:true});const prefix=basename(path);const candidates=entries.filter(e=>e.name.startsWith(prefix));
          if(candidates.length===1) prompt.setValue(`/attach ${JSON.stringify((raw.slice(0,raw.length-prefix.length)+candidates[0]!.name)+(candidates[0]!.isDirectory()?sep:""))}`);
          else this.status=`${candidates.length} candidatos`;this.desktop.invalidate();});return true;}
      }
      const configured = bindings(this.store.value.ui.bindings);
      const action = Object.entries(configured.global).find(([,key]) => key === event.key)?.[0] as Action | undefined;
      if (!action) return false; this.pending = ""; this.action(action); return true;
    };
    this.desktop.onControlInput = event => this.input(event);
    this.desktop.footer=()=>this.mode==="NORMAL" ? "i Insertar  Tab Panel  Espacio Leader  Esc Menú  ^Q Salir"
      : this.desktop.active===promptWindow && this.store.value.ui.vimMode ? `Enter Enviar  Esc NORMAL  ^N Panel  ${this.bindingLabel("attachments").replace("Ctrl+","^")} Adjuntos  ^Q Salir` : "Esc Menú  Tab Foco  ^N Panel  Alt+Y Ayuda  ^Q Salir";
    this.desktop.onBeforeExit = async () => {
      for (const tab of this.tabs) tab.controller?.abort(new Error("Turno cancelado; cerrando s42-agent"));
      for (const window of [...this.desktop.windows].reverse()) if (!window.fixed) this.desktop.close(window);
      await this.metrics.stop();
      let pending: Promise<unknown>; do { pending = this.operations; await pending; } while (pending !== this.operations);
      for (const tab of this.tabs) tab.controller?.abort(new Error("Turno cancelado; cerrando s42-agent"));
      await Promise.all(this.tabs.map(tab => tab.turn));
      clearInterval(this.activityTimer); this.activityTimer = undefined;
      await this.webservers.close();
      for (const tab of this.tabs) { await this.saveDraft(tab); await tab.session?.close(); }
    };
    this.desktop.resize(this.desktop.width, this.desktop.height);
  }
  static async open(options: AppOptions = {}): Promise<App> {
    const paths = storagePaths(options.config), store = await ConfigStore.load(paths.config, paths.legacy), app = new App(store, paths.sessions, process.cwd());
    app.opening = true;
    try {
      let project: Project | undefined;
      if (options.cwd) {
        const path = await normalizeFolder(options.cwd, app.cwd);
        project = store.value.projects.find(p => p.path === path) ?? await store.project(basename(path), path, app.cwd);
      } else if (options.project) project = store.resolveProject(options.project);
      else project = store.value.projects.find(p => p.id === (store.value.lastProjectId ?? store.value.defaults.projectId)) ?? store.value.projects[0];
      const restore = store.value.workspace?.openProjectIds.slice();
      for (const id of restore ?? []) {
        const saved = store.value.projects.find(p => p.id === id); if (saved) await app.switchProject(saved);
      }
      if (project && (options.cwd || options.project || restore === undefined || restore.includes(project.id))) await app.switchProject(project, options.session);
      if (options.provider || options.model) await app.selectModel({ providerId: options.provider ?? app.selection.providerId, modelId: options.model ?? app.selection.modelId });
      app.opening = false;
      if (app.tabs.some(tab => tab.project) || restore !== undefined) await app.saveWorkspace();
      app.showContext(); if (!store.value.projects.length) app.projectForm();
      return app;
    } catch (error) {
      await app.metrics.stop();
      for (const tab of app.tabs) await tab.session?.close().catch(() => {});
      throw error;
    }
  }
  run(work: () => Promise<unknown>): void {
    const tab = this.activeTab;
    this.operations = this.operations.then(work).catch(e => { tab.status = (e as Error).message; this.showContext(tab); this.desktop.invalidate(); });
  }
  private change(work: () => Promise<void>): Promise<void> {
    const pending=this.operations.then(work); this.operations=pending.catch(()=>{}); return pending;
  }
  colorPalette(): void {
    const ids = Object.keys(palettes) as PaletteId[], current = this.store.value.ui.palette;
    choose(this.desktop, this.desktop.t("Paleta de colores"), ids.map(value => ({ label: `${this.desktop.t(palettes[value].label)}${value === current ? this.desktop.t(" (actual)") : ""}`, value })), value => this.run(async () => {
      const next = structuredClone(this.store.value); next.ui.palette = value;
      await this.store.save(next);
      this.desktop.palette = value; this.status = `Paleta: ${palettes[value].label}`;
      this.desktop.invalidate();
    }), ids.indexOf(current));
  }
  language(): void {
    const values: Language[] = ["es", "en"];
    choose(this.desktop, this.desktop.t("Language"), values.map(value => ({
      label: `${value === "es" ? "Español" : "English"}${value === this.store.value.ui.language ? this.desktop.t(" (actual)") : ""}`, value,
    })), value => this.run(() => this.setLanguage(value)), values.indexOf(this.store.value.ui.language));
  }
  async setLanguage(language: Language): Promise<void> {
    const next = structuredClone(this.store.value); next.ui.language = language;
    await this.store.save(next); this.desktop.language = language;
    this.refreshPresentation();
  }
  async toggleReasoning(): Promise<void> {
    const next = structuredClone(this.store.value); next.ui.showReasoning = !next.ui.showReasoning;
    await this.store.save(next);
    const item = this.desktop.menu.menus.find(menu => menu.label === "Vista")!.items.find(item => item.label.startsWith("Ver razonamiento:"))!;
    item.label = `Ver razonamiento: ${next.ui.showReasoning ? "on" : "off"}`;
    this.refreshPresentation();
  }
  private resourceLabel(key: keyof ResourceIndicators): string {
    return { cpu: "CPU", ram: "RAM", disk: "Disco", gpu: "VRAM" }[key];
  }
  async toggleResource(key: keyof ResourceIndicators): Promise<void> {
    const next = structuredClone(this.store.value); next.ui.resources[key] = !next.ui.resources[key];
    await this.store.save(next);
    const label = this.resourceLabel(key);
    const item = this.desktop.menu.menus.find(menu => menu.label === "Vista")!.items.find(item => item.label.startsWith(label + ":"))!;
    item.label = `${label}: ${next.ui.resources[key] ? "on" : "off"}`;
    this.desktop.resize(this.desktop.width, this.desktop.height); this.desktop.invalidate();
  }
  private refreshPresentation(): void {
    for (const tab of this.tabs) {
      tab.rendered = new WeakMap(); this.showHistory(false, tab); this.showContext(tab);
    }
    for (const file of this.fileTabs) if (file.binary) file.content.placeholder = this.desktop.t("Archivo binario; la vista de archivos admite texto UTF-8.");
    this.desktop.resize(this.desktop.width, this.desktop.height); this.desktop.invalidate();
  }
  private requireIdle(tab = this.activeTab): void { if (tab.busy) throw new Error("Hay un turno activo: cancelalo antes de cambiar de contexto"); }
  private async saveDraft(tab = this.activeTab): Promise<void> {
    if (tab.session) await tab.session.append({ type: "draft", text: tab.prompt.value, attachments: tab.attachments.map(a => a.path) });
  }
  private async loadPrompting(text: string, execute: boolean): Promise<void> {
    this.requireIdle();
    this.view.prompt.setValue(text); this.mode = "INSERT"; this.pending = "";
    this.desktop.focus(this.view.promptWindow); this.view.promptWindow.focusedId = this.view.prompt.id;
    this.status = "Prompting cargado · Enter enviar"; this.desktop.invalidate();
    await this.saveDraft();
    if (execute) await this.submit(true);
  }
  async switchProject(project: Project, id?: string): Promise<void> {
    const folder = await normalizeFolder(project.path, this.cwd);
    const server = this.webservers.get(project.id);
    if (server && server.root !== folder) await this.webservers.stop(project.id);
    const existing = this.tabs.find(tab => tab.project?.id === project.id);
    if (existing && (id === undefined || existing.session?.state.id === id)) {
      existing.project = project; await this.activateTab(existing.id); return;
    }
    if (existing?.busy) throw new Error(`${project.name}: cancelá el turno antes de cambiar de sesión`);
    const tab = existing ?? this.tabs.find(tab => !tab.project) ?? createProjectTab();
    const next = await Session.open(this.sessionsPath, project.id, id ?? project.lastSessionId);
    try { if (!next.state.events.length) await next.append({ type: "session", title: new Date().toLocaleString(this.desktop.language) }); await this.saveDraft(tab); await tab.session?.close(); }
    catch (e) { await next.close(); throw e; }
    tab.project = project; tab.session = next; tab.attachments = [];
    for (const path of next.state.attachments) try { tab.attachments.push(await snapshot(path, project.path)); } catch (e) { next.state.notices.push(`Adjunto ${path}: ${(e as Error).message}`); }
    tab.mode = "INSERT"; tab.pending = ""; tab.panel = "prompt"; tab.focusedId = tab.prompt.id;
    tab.selection = modelSelection(this.store.value, next.state.selection, project.selection);
    tab.prompt.setValue(next.state.draft); tab.rendered = new WeakMap(); tab.status = "Listo";
    const lastTurn = next.state.events.findLast(event => event.type === "turn");
    tab.tokens = lastTurn?.type === "turn" ? lastTurn.tokens : undefined;
    tab.contextUsage = next.state.contextUsage;
    project.lastSessionId = next.state.id;
    this.bindTab(tab); if (!this.tabs.includes(tab)) this.tabs.push(tab);
    this.showHistory(true, tab); this.showContext(tab);
    await this.activateTab(tab.id);
  }
  private bindTab(tab: ProjectTab): void {
    tab.prompt.onSubmit = () => this.run(() => this.submit());
  }
  private tabItems(): TabItem[] {
    return this.tabs.flatMap(tab => [
      ...(tab.project ? [{ id: tab.id, label: `P:${tab.project.name}`, busy: tab.busy, activity: tab.agentState ? ["|", "/", "-", "\\"][this.activityFrame] : undefined }] : []),
      ...this.fileTabs.filter(file => file.ownerId === tab.id).map(file => ({ id: file.id, label: `F:${file.name}`, busy: false })),
    ]);
  }
  async openFile(path: string, ownerId = this.activeTab.id): Promise<void> {
    const owner = this.tabs.find(tab => tab.id === ownerId); if (!owner) return;
    const absolute = resolve(owner.project?.path ?? this.cwd, path);
    let file = this.fileTabs.find(file => file.ownerId === ownerId && file.path === absolute);
    if (!file) {
      try { file = await openFileTab(absolute, ownerId); }
      catch (error) { owner.status = (error as Error).message; this.desktop.invalidate(); throw error; }
      if (!this.tabs.includes(owner)) return;
      if (file.binary) file.content.placeholder = this.desktop.t("Archivo binario; la vista de archivos admite texto UTF-8.");
      this.fileTabs.push(file);
    }
    await this.activateTab(file.id);
  }
  private rememberPanel(tab: ProjectTab): void {
    if (this.activeFile) return;
    tab.panel = this.desktop.active === this.view.editorWindow ? "editor" : "prompt";
    tab.focusedId = tab.panel === "editor" ? this.view.editorWindow.focusedId : this.view.promptWindow.focusedId;
  }
  private displayTab(tab: ProjectTab): void {
    this.activeFile = undefined;
    this.activeTab = tab;
    this.view.response = tab.response; this.view.prompt = tab.prompt;
    this.view.editorWindow.controls.splice(0, this.view.editorWindow.controls.length, tab.response);
    this.view.promptWindow.controls.splice(0, this.view.promptWindow.controls.length, tab.prompt);
    this.view.editorWindow.title = tab.project?.name ?? "s42-agent";
    if (!this.desktop.modal) for (const window of [...this.desktop.windows]) if (!window.fixed) this.desktop.close(window);
    this.desktop.resize(this.desktop.width, this.desktop.height);
    const panel = tab.panel === "editor" ? this.view.editorWindow : this.view.promptWindow;
    panel.focusedId = tab.focusedId; this.desktop.focus(panel);
    this.showContext(tab); this.desktop.invalidate();
  }
  private async saveWorkspace(): Promise<void> {
    if (this.opening) return;
    const next = structuredClone(this.store.value);
    next.workspace = { openProjectIds: this.tabs.flatMap(tab => tab.project ? [tab.project.id] : []) };
    if (this.project) next.lastProjectId = this.project.id; else delete next.lastProjectId;
    for (const tab of this.tabs) {
      const project = next.projects.find(p => p.id === tab.project?.id);
      if (project && tab.session) project.lastSessionId = tab.session.state.id;
    }
    await this.store.save(next);
  }
  async activateTab(id: string): Promise<void> {
    const file = this.fileTabs.find(file => file.id === id);
    if (file) {
      const owner = this.tabs.find(tab => tab.id === file.ownerId); if (!owner) return;
      if (owner !== this.activeTab) await this.activateTab(owner.id);
      this.rememberPanel(owner);
      this.activeFile = file; this.view.response = file.content;
      this.view.editorWindow.controls.splice(0, this.view.editorWindow.controls.length, file.content);
      this.view.editorWindow.title = file.name; this.view.editorWindow.focusedId = file.content.id;
      this.desktop.resize(this.desktop.width, this.desktop.height); this.desktop.focus(this.view.editorWindow); this.desktop.invalidate();
      return;
    }
    const tab = this.tabs.find(tab => tab.id === id); if (!tab) return;
    const previous = this.activeTab;
    if (tab !== previous) {
      this.rememberPanel(previous);
      await this.saveDraft(previous);
    }
    this.displayTab(tab); await this.saveWorkspace();
  }
  cycleTab(direction: number): void {
    const tabs = this.tabItems(), index = tabs.findIndex(tab => tab.id === (this.activeFile?.id ?? this.activeTab.id));
    if (tabs.length) { const tab = tabs[(index + direction + tabs.length) % tabs.length]!; this.run(() => this.activateTab(tab.id)); }
  }
  async closeTab(id = this.activeFile?.id ?? this.activeTab.id): Promise<void> {
    const fileIndex = this.fileTabs.findIndex(file => file.id === id);
    if (fileIndex >= 0) {
      const [file] = this.fileTabs.splice(fileIndex, 1);
      if (this.activeFile === file) this.displayTab(this.activeTab);
      this.desktop.invalidate(); return;
    }
    const index = this.tabs.findIndex(tab => tab.id === id), tab = this.tabs[index]; if (!tab) return;
    if (tab.busy) throw new Error(`${tab.project?.name ?? "Proyecto"}: cancelá el turno antes de cerrar la pestaña`);
    await this.saveDraft(tab); await tab.session?.close(); this.tabs.splice(index, 1);
    if (tab.project) await this.webservers.stop(tab.project.id);
    for (let i = this.fileTabs.length - 1; i >= 0; i--) if (this.fileTabs[i]!.ownerId === tab.id) this.fileTabs.splice(i, 1);
    if (!this.tabs.length) { const empty = createProjectTab(); this.bindTab(empty); this.tabs.push(empty); }
    if (this.activeTab === tab) this.displayTab(this.tabs[Math.min(index, this.tabs.length - 1)]!);
    await this.saveWorkspace(); this.desktop.invalidate();
  }
  async newSession(): Promise<void> { this.requireIdle(); if (!this.project) { this.projectForm(); return; } await this.switchProject(this.project, crypto.randomUUID()); }
  webServer(): void {
    if (!this.project) { this.projectForm(); return; }
    showWebServer(this.desktop, this.project, this.webservers, work => this.change(work), this.activeFile?.path);
  }
  projects(): void {
    if (!this.store.value.projects.length) { this.projectForm(); return; }
    choose(this.desktop, this.desktop.t("Projects · abrir"), this.store.value.projects.map(value => ({ label: `${this.tabs.some(t => t.project?.id === value.id) ? this.desktop.t("[abierto] ") : ""}${value.name} · ${value.path}`, value })), p => this.run(() => this.switchProject(p)));
  }
  projectForm(project?: Project): void {
    if (project && this.tabs.some(tab => tab.project?.id === project.id && tab.busy)) { this.status = "Cancelá el turno antes de editar proyectos"; return; }
    form(this.desktop, this.desktop.t(project ? "Projects · editar" : "Projects · nuevo"), [{ label: this.desktop.t("Nombre"), value: project?.name ?? basename(this.cwd) }, {
      label: this.desktop.t("Carpeta"), value: project?.path ?? this.cwd, browse: (value,select,parent) => {
        const explorer=new FileExplorer(this.desktop,this.cwd,{parent,initialPath:value,pickFolder:select}); this.run(()=>explorer.show());
      },
    }], ([name, path]) => this.change(async () => {
      const saved = await this.store.project(name!, path!, this.cwd, project?.id);
      await this.switchProject(saved);
    }));
  }
  removeProject(): void {
    choose(this.desktop, this.desktop.t("Quitar proyecto del registro"), this.store.value.projects.map(value => ({ label: value.name, value })), project => this.run(async () => {
      const tab = this.tabs.find(tab => tab.project?.id === project.id);
      if (tab) await this.closeTab(tab.id);
      const next = structuredClone(this.store.value); next.projects = next.projects.filter(p => p.id !== project.id);next.skills=next.skills.filter(s=>s.projectId!==project.id); if (next.lastProjectId === project.id) delete next.lastProjectId;
      if (next.workspace) next.workspace.openProjectIds = next.workspace.openProjectIds.filter(id => id !== project.id);
      await this.store.save(next);
    }));
  }
  sessions(): void { this.run(async () => { if (!this.project) { this.projectForm(); return; } const project = this.project;
    choose(this.desktop, this.desktop.t("Sesiones"), (await listSessions(this.sessionsPath, project.id)).map(value => ({ label: `${value.title} · ${value.id.slice(0, 8)}`, value })), s => this.run(() => this.switchProject(project, s.id))); }); }
  current(tab = this.activeTab): { provider: Provider; model: Model } {
    const provider = this.store.value.providers.find(p => p.id === tab.selection.providerId), model = provider?.models.find(m => m.id === tab.selection.modelId);
    if (!provider || !model) throw new Error("No hay modelo configurado. Abrí Models → Proveedores."); return { provider, model };
  }
  private contextLabel(tab = this.activeTab): { source: string; text: string } {
    try {
      const { provider, model } = this.current(tab), label = `${provider.name} · ${model.id}`;
      return { source: label + (model.capabilities.tools ? "" : " · sin tools"),
        text: label + (model.capabilities.tools ? "" : this.desktop.t(" · sin tools")) };
    } catch {
      const source = "No hay modelo configurado. Abrí Models → Proveedores.";
      return { source, text: this.desktop.t(source) };
    }
  }
  private statusText(): string {
    const context = this.contextLabel();
    return this.status === context.source ? context.text : this.desktop.t(this.status);
  }
  showContext(tab = this.activeTab): void {
    try {
      const { provider, model } = this.current(tab);
      let usage = tab.contextUsage;
      if (usage?.providerId !== provider.id || usage.modelId !== model.id) {
        const saved = tab.session?.state.contextUsage;
        if (saved?.providerId === provider.id && saved.modelId === model.id) usage = tab.contextUsage = saved;
      }
      if (usage?.providerId !== provider.id || usage.modelId !== model.id) tab.contextUsage = { providerId: provider.id, modelId: model.id, window: model.contextWindow, estimated: true };
      else if (model.contextWindow !== undefined) tab.contextUsage = { ...usage, window: model.contextWindow };
    } catch { tab.contextUsage = undefined; }
    const selected = this.contextLabel(tab);
    tab.response.placeholder = `${tab.project?.path ?? this.desktop.t("Abrí un proyecto en Projects o registrá uno con Name y Folder.")}\n\n${selected.text}`;
    if (!tab.session?.state.messages.length && tab.status === "Listo") tab.status = selected.source;
    this.desktop.invalidate();
  }
  showHistory(reset = true, tab = this.activeTab): void {
    const messages = tab.session?.state.messages ?? [];
    const names = new Map(messages.flatMap(m => m.tool_calls?.map(call => [call.id, call.function.name] as const) ?? []));
    const rendered = messages.map(m => {
      let cached = tab.rendered.get(m); if (cached !== undefined) return cached;
      let content = typeof m.content === "string" ? m.content : m.content?.map(part => part.type === "text" ? part.text : this.desktop.t("[Imagen adjunta guardada en la sesión]")).join("\n");
      if(m.role==="tool" && typeof content==="string") try {
        const result=JSON.parse(content);if(typeof result.output==="string" && typeof result.failed==="boolean") {
          let output=result.output;try{const shell=JSON.parse(output);if(typeof shell.stdout==="string")output=`${shell.stdout}${shell.stderr?"\nstderr:\n"+shell.stderr:""}`;}catch{}
          content=`${result.failed?"Error":"OK"}${result.exitCode!==undefined?" · exit "+result.exitCode:""} · ${result.durationMs} ms\n${output}`;
        }
      }catch{}
      const reasoning=m.reasoning_content ?? m.reasoning;
      const label=this.desktop.t(m.role === "user" ? "Vos" : m.role === "assistant" ? "Agente" : `Herramienta · ${names.get(m.tool_call_id ?? "") ?? m.tool_call_id ?? this.desktop.t("resultado")}`);
      const sections=[reasoning && this.store.value.ui.showReasoning ? this.desktop.t("Razonamiento:")+"\n"+reasoning : "", m.role === "assistant" ? markdownText(content ?? "") : content ?? "",
        m.tool_calls?.map(c => `Tool call · ${c.function.name}\n${c.function.arguments}`).join("\n\n") ?? ""].filter(Boolean);
      cached = sections.length ? `${label}:\n${sections.join("\n\n")}` : "";
      tab.rendered.set(m, cached); return cached;
    });
    const fragments: TextFragment[] = [];
    for (const [index, text] of rendered.entries()) {
      if (!text) continue;
      if (fragments.length) fragments.push({ text: "\n\n" });
      const role = messages[index]!.role, end = text.indexOf("\n");
      if (role === "user" || role === "assistant") {
        fragments.push({ text: text.slice(0, end), style: role === "user" ? theme.chatUser : theme.chatAgent }, { text: text.slice(end) });
      } else fragments.push({ text });
    }
    if (tab.session?.state.notices.length) fragments.push({ text: "\n\n" + tab.session.state.notices.map(this.desktop.t).join("\n") });
    if (this.store.value.ui.showReasoning) for (const event of tab.session?.state.events ?? []) {
      if (event.type !== "compaction-part") continue;
      const reasoning = event.message.reasoning_content ?? event.message.reasoning;
      if (reasoning) fragments.push({ text: `\n\n${this.desktop.t("Razonamiento · compactación:")}\n${reasoning}`, style: theme.chatAgent });
    }
    for (const chunk of tab.live.filter(chunk => !chunk.reasoning || this.store.value.ui.showReasoning)) {
      fragments.push({ text: `\n\n${this.desktop.t(chunk.label)}\n`, style: chunk.id === "answer" || chunk.reasoning ? theme.chatAgent : undefined }, { text: chunk.text });
    }
    if (reset) tab.response.setValue(fragments, "end"); else tab.response.update(fragments);
  }
  async selectModel(selection: Selection): Promise<void> { const tab = this.activeTab; this.requireIdle(tab); const old = tab.selection; tab.selection = selection;
    try {
      const {model} = this.current(tab); if (!model.capabilities.images && hasImages(tab.session ? activeHistory(tab.session.state) : [])) throw new Error("La sesión contiene imágenes: elegí un modelo con imágenes o creá /new");
      const next = structuredClone(this.store.value);
      next.defaults = { ...next.defaults, ...selection };
      if (tab.project) next.projects.find(p => p.id === tab.project!.id)!.selection = { ...selection };
      await this.store.save(next);
      if (tab.project) tab.project.selection = { ...selection };
      await tab.session?.append({ type: "selection", selection }); if (tab.session) tab.session.state.selection = selection;
    }
    catch (e) { tab.selection = old; throw e; } tab.status = "Modelo elegido"; this.showContext(tab); }
  models(providerId?: string, ids?: string[]): void {
    const providers = this.store.value.providers.filter(p => !providerId || p.id === providerId);
    choose(this.desktop, providerId ? `Models · ${providers[0]?.name}` : this.desktop.t("Models · elegir"), providers.flatMap(p => p.models.filter(m => !ids || ids.includes(m.id)).map(m => ({
      label: `${p.name} · ${m.name}${m.name === m.id ? "" : " · " + m.id}`, value: { providerId: p.id, modelId: m.id },
    }))), s => this.run(() => this.selectModel(s)));
  }
  providers(add = false): void {
    const presets = defaultProviders();
    const providers = [...presets.map(p => this.store.value.providers.find(saved => saved.id === p.id) ?? p), ...this.store.value.providers.filter(p => !presets.some(preset => preset.id === p.id))];
    const entries: { label: string; value: Provider | undefined }[] = providers.map(value => ({ label: `${value.name} · ${value.baseUrl}`, value }));
    if (add) entries.push({ label: this.desktop.t("Otro proveedor · configuración manual"), value: undefined });
    choose(this.desktop, this.desktop.t(add ? "Nuevo proveedor" : "Proveedores"), entries, p => this.run(async () => {
      this.requireIdle(); p ? this.providerForm(p) : this.modelForm(true, true);
    }));
  }
  providerForm(provider: Provider): void {
    const url=new URL(provider.baseUrl),port=url.port;url.port="";
    const preset = provider.id === "deepseek" || provider.kind === "llama.cpp";
    form(this.desktop, this.desktop.t(`${provider.name} · configurar`),[
      {label: this.desktop.t("API key · llavero"),value:"",secret:true,placeholder:provider.apiKeySecret ? "Guardada · vacío conserva" : "Opcional · guardar en el SO"}, {label: this.desktop.t("Variable API key"),value:provider.apiKeyEnv??""}, {label: this.desktop.t("Host / URL base"),value:url.href.replace(/\/$/,"")},
      {label: this.desktop.t("Puerto"),value:port}, {label: this.desktop.t("Nombre"),value:provider.name},
    ], async ([apiKey,env,host,port,name]) => {
      let ids: string[] | undefined;
      await this.change(async()=>{
        this.requireIdle();const endpoint=new URL(host!);if(port && (!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535))throw new Error("Puerto inválido");endpoint.port=port??"";
        const next=structuredClone(this.store.value),p=next.providers.find(p=>p.id===provider.id)??structuredClone(provider);
        p.name=name!;p.baseUrl=endpoint.href.replace(/\/$/,"");p.apiKeyEnv=env?.trim()||undefined;
        const changedEndpoint = p.baseUrl !== provider.baseUrl.replace(/\/$/, "");
        if (changedEndpoint) p.apiKeySecret = undefined;
        if (!next.providers.some(saved => saved.id === p.id)) next.providers.push(p);
        // Validate locally before contacting the configured endpoint.
        validateConfig(next);
        const sessionKey = apiKey?.trim() || (!changedEndpoint ? this.keys.get(p.id) : undefined);
        if (preset) {
          const models = await this.providerModels(p, sessionKey); ids = models.map(m => m.id);
          for (const model of models) if (!p.models.some(saved => saved.id === model.id)) p.models.push(model);
        }
        if (apiKey?.trim()) await saveCredential(p, apiKey.trim(), this.store.path);
        await this.store.save(next); if (changedEndpoint) this.keys.delete(p.id);
        if (apiKey?.trim()) this.keys.set(p.id, apiKey.trim()); this.showContext();
      });
      return ids ? () => this.models(provider.id, ids) : undefined;
    });
  }
  modelForm(add = false, newProvider = false): void {
    if (this.busy) { this.status = "Cancelá el turno antes de configurar modelos"; return; }
    const provider = this.store.value.providers.find(p => p.id === this.selection.providerId) ?? this.store.value.providers[0];
    const model = add ? undefined : provider?.models.find(m => m.id === this.selection.modelId);
    const url = new URL(newProvider ? "http://127.0.0.1:8080/v1" : provider?.baseUrl ?? "http://127.0.0.1:8080/v1"), port = url.port; url.port = "";
    form(this.desktop, this.desktop.t("Models · host, puerto y modelo"), [
      { label: this.desktop.t("ID del modelo"), value: model?.id ?? "" }, { label: this.desktop.t("Nombre"), value: model?.name ?? "" }, { label: this.desktop.t("Host / URL base"), value: url.href.replace(/\/$/, "") },
      { label: this.desktop.t("Puerto"), value: port }, { label: this.desktop.t("API key · llavero"), value: "", secret: true, placeholder: !newProvider && provider?.apiKeySecret ? "Guardada · vacío conserva" : "Opcional · guardar en el SO" }, { label: this.desktop.t("Variable API key"), value: newProvider ? "" : provider?.apiKeyEnv ?? "" },
      { label: this.desktop.t("Tools / imágenes (sí/no)"), value: `${model?.capabilities.tools ? (this.desktop.language === "en" ? "yes" : "sí") : "no"}/${model?.capabilities.images ? (this.desktop.language === "en" ? "yes" : "sí") : "no"}` },
    ], ([id, name, host, port, apiKey, apiKeyEnv, caps]) => this.change(async () => {
      this.requireIdle(); if (!id?.trim()) throw new Error("Escribí el ID real del modelo");
      const endpoint = new URL(host!); if (port && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)) throw new Error("Puerto inválido"); endpoint.port = port ?? "";
      const next = structuredClone(this.store.value), providerId = newProvider ? crypto.randomUUID() : provider?.id ?? "llama.cpp";
      let configured = next.providers.find(p => p.id === providerId);
      if (!configured) { configured = { id: providerId, name: newProvider ? endpoint.host : "Local · llama.cpp", kind: newProvider ? "openai-compatible" : "llama.cpp", baseUrl: endpoint.href, models: [] }; next.providers.push(configured); }
      const changedEndpoint = configured.baseUrl.replace(/\/$/, "") !== endpoint.href.replace(/\/$/, "");
      if (changedEndpoint) configured.apiKeySecret = undefined;
      configured.baseUrl = endpoint.href.replace(/\/$/, ""); configured.apiKeyEnv = apiKeyEnv?.trim() || undefined;
      const capabilities = caps!.toLowerCase().split("/"); if (capabilities.length !== 2 || !capabilities.every(c => ["sí", "si", "yes", "no"].includes(c))) throw new Error("Capacidades: sí/no, no/no o sí/sí");
      const saved: Model = { manual: true, id: id.trim(), name: name?.trim() || id.trim(), capabilities: { tools: capabilities[0] !== "no", images: capabilities[1] !== "no" } };
      if (add && configured.models.some(m => m.id === saved.id)) throw new Error("Ese modelo ya está registrado");
      configured.models = [...configured.models.filter(m => m.id !== (model?.id ?? saved.id)), saved];
      validateConfig(next);
      if (apiKey?.trim()) await saveCredential(configured, apiKey.trim(), this.store.path);
      await this.store.save(next); if (changedEndpoint) this.keys.delete(providerId);
      if (apiKey?.trim()) this.keys.set(providerId, apiKey.trim());
      await this.selectModel({ providerId, modelId: saved.id });
    }));
  }
  removeModel(): void { choose(this.desktop, this.desktop.t("Quitar modelo"), this.store.value.providers.flatMap(p => p.models.map(m => ({ label: `${p.name} · ${m.id}`, value: { p: p.id, m: m.id } }))), s => this.run(async () => {
    this.requireIdle(); const next = structuredClone(this.store.value); next.providers.find(p => p.id === s.p)!.models = next.providers.find(p => p.id === s.p)!.models.filter(m => m.id !== s.m); await this.store.save(next); this.showContext();
  })); }
  async saveDefault(): Promise<void> { this.requireIdle(); this.current(); const next = structuredClone(this.store.value); next.defaults = { ...this.selection, projectId: this.project?.id }; await this.store.save(next); this.status = "Default guardado"; this.desktop.invalidate(); }
  async saveProjectDefault(): Promise<void> { this.requireIdle(); this.current(); if (!this.project) throw new Error("Elegí un proyecto"); const next=structuredClone(this.store.value); next.projects.find(p=>p.id===this.project!.id)!.selection={...this.selection}; await this.store.save(next); this.project.selection={...this.selection}; this.status="Default del proyecto guardado"; }
  removeProvider(): void { choose(this.desktop, this.desktop.t("Quitar proveedor"),this.store.value.providers.map(value=>({label:value.name,value})),p=>this.run(async()=>{
    this.requireIdle(); const next=structuredClone(this.store.value); next.providers=next.providers.filter(provider=>provider.id!==p.id); await deleteCredential(p); await this.store.save(next); this.keys.delete(p.id); this.showContext();
  })); }
  private async providerModels(provider: Provider, sessionKey?: string): Promise<Model[]> {
    const tab = this.activeTab; this.requireIdle(tab);
    const key=await credential(provider,sessionKey ?? this.keys.get(provider.id));
    if (provider.id === "deepseek" && !key) throw new Error("Ingresá una API key de DeepSeek o su variable de entorno");
    this.requireIdle(tab); const controller = new AbortController();
    tab.controller = controller; tab.busy = true;
    tab.status = `Consultando modelos de ${provider.name}…`; this.desktop.invalidate();
    try {
      const models = await discoverModels(provider, key, controller.signal);
      if (!models.length) throw new Error(`${provider.name}: no hay modelos disponibles`);
      tab.status = `${models.length} modelos disponibles · elegí uno`; return models;
    } catch (error) { tab.status = (error as Error).message; throw error; }
    finally {tab.busy=false;tab.controller=undefined;this.desktop.invalidate();}
  }
  async discover(): Promise<void> {
    this.requireIdle(); const provider = this.store.value.providers.find(p => p.id === this.selection.providerId); if (!provider) throw new Error("Elegí un proveedor");
    const models = await this.providerModels(provider);
    const next = structuredClone(this.store.value), configured = next.providers.find(p => p.id === provider.id)!;
    for (const model of models) if (!configured.models.some(m => m.id === model.id)) configured.models.push(model);
    await this.store.save(next); this.models(provider.id, models.map(m => m.id)); this.desktop.invalidate();
  }
  private action(action: Action): void {
    ({projects:()=>this.projects(),models:()=>this.models(),providers:()=>this.providers(),sessions:()=>this.sessions(),attachments:()=>this.attachmentMenu(),explorer:()=>this.explore(),mcp:()=>this.extensions.servers(),skills:()=>this.extensions.skills(),promptings:()=>this.promptings.library(),help:()=>this.desktop.onHelp()})[action]();
  }
  explore(): void {
    if(this.desktop.modal)return;
    const owner = this.activeTab;
    const explorer=new FileExplorer(this.desktop,this.activeFile ? dirname(this.activeFile.path) : this.project?.path ?? this.cwd,{
      attach:path=>this.change(()=>this.attach([path])), openFile:path=>this.change(()=>this.openFile(path, owner.id)),
    });this.run(()=>explorer.show());
  }
  private bindingLabel(action:Action):string{return bindings(this.store.value.ui.bindings).global[action]!.replace(/^(ctrl|alt)\+([a-z])$/,(_match,mod,key)=>(mod==="ctrl"?"Ctrl":"Alt")+"+"+key.toUpperCase());}
  private input(event: InputEvent): boolean {
    if (this.desktop.modal) return false;
    const control = this.desktop.active?.controls.find(c=>c.id===this.desktop.active?.focusedId);
    if (control !== this.view.prompt && control !== this.view.response) { this.pending=""; return false; }
    if (this.pasting) { this.run(async()=>{ if(!this.input(event)) control.handle(event); this.desktop.invalidate(); }); return true; }
    if (event.type === "paste") {
      this.pending="";
      if (control === this.view.response) return false;
      this.pasting=true;
      this.run(async()=>{ try { const paths=this.project ? await pastedPaths(event.text,this.project.path):undefined;
        if (paths) await this.attach(paths); else this.view.prompt.handle(event); this.desktop.invalidate(); } finally { this.pasting=false; } });
      return true;
    }
    if (event.type !== "key" || !this.store.value.ui.vimMode || this.mode !== "NORMAL") return false;
    const key=event.text ?? event.key;
    if (this.pending === "leader") {
      this.pending=""; const action=Object.entries(bindings(this.store.value.ui.bindings).normal).find(([,binding])=>binding===`leader+${key}`)?.[0] as Action|undefined;
      if (action) this.action(action); return true;
    }
    if (key === " ") { this.pending="leader"; this.status="Leader: p proyecto · m modelo · s sesión · e archivos · f adjunto · c MCP · k skills · t promptings · ? ayuda"; return true; }
    const prior=this.pending; this.pending="";
    if (control === this.view.response) {
      if (prior==='g' && key==='g') return this.view.response.vim('gg');
      if (key==='g') {this.pending='g';return true;}
      return this.view.response.vim(key) || Boolean(event.text);
    }
    if (prior==='d' && key==='d') return this.view.prompt.vim('dd');
    if (key==='d') {this.pending='d';return true;}
    if (['i','a','I','A'].includes(key)) {this.view.prompt.vim(key);this.mode='INSERT';return true;}
    if (this.view.prompt.vim(key)) return true;
    if (event.text || ['backspace','delete','enter','shift+enter','ctrl+j'].includes(event.key)) return true;
    return false;
  }
  async attach(paths: string[]): Promise<void> {
    if (!this.project || !this.session) throw new Error("Elegí un proyecto antes de adjuntar");
    const added:Attachment[]=[];
    for (const path of paths) { const item=await snapshot(path,this.project.path); if (![...this.attachments,...added].some(a=>a.path===item.path)) added.push(item); }
    validateAttachments([...this.attachments,...added],true); this.attachments.push(...added);
    this.desktop.resize(this.desktop.width,this.desktop.height);
    this.status=`${this.attachments.length} adjuntos preparados; Enter para enviar`; await this.saveDraft(); this.desktop.invalidate();
  }
  attachmentMenu(): void {
    choose(this.desktop, this.desktop.t("Adjuntos"),[{label: this.desktop.t("Agregar por ruta"),value:"add"},{label:this.desktop.t(`Ver / quitar (${this.attachments.length})`),value:"remove"}],action=>{
      if(action==='remove') this.detach(); else form(this.desktop, this.desktop.t("Adjuntar archivos"),[{label: this.desktop.t("Rutas"),value:""}],([text])=>this.change(async()=>{
        const paths=await pastedPaths(text!,this.project?.path ?? this.cwd) ?? parsePaths(text!); if(!paths) throw new Error("Escribí una ruta válida"); await this.attach(paths);
      }));
    });
  }
  detach(): void { choose(this.desktop, this.desktop.t("Quitar adjunto"),this.attachments.map(value=>({label:`${value.path} · ${value.size} B`,value})),a=>this.run(async()=>{
    this.attachments=this.attachments.filter(item=>item!==a); this.desktop.resize(this.desktop.width,this.desktop.height); await this.saveDraft(); this.status="Adjunto quitado"; this.desktop.invalidate();
  })); }
  async task<T>(label:string,operation:(signal:AbortSignal)=>Promise<T>):Promise<T>{
    this.requireIdle(); const tab = this.activeTab, controller = new AbortController();
    tab.controller=controller;tab.busy=true;tab.status=label;this.desktop.invalidate();
    try{const result=await operation(controller.signal);tab.status="Listo";return result;}catch(error){tab.status=(error as Error).message;throw error;}finally{tab.controller=undefined;tab.busy=false;this.desktop.invalidate();}
  }
  cancel(): void { this.controller?.abort(new Error("Turno cancelado; los efectos ya realizados se conservan")); }
  private startActivity(): void {
    if (this.activityTimer) return;
    this.activityFrame = 0;
    this.activityTimer = setInterval(() => {
      this.activityFrame = (this.activityFrame + 1) % 4;
      if (this.tabs.some(tab => tab.agentState)) this.desktop.invalidate();
    }, 200);
    this.activityTimer.unref();
  }
  private stopActivity(): void {
    if (this.tabs.some(tab => tab.agentState)) return;
    clearInterval(this.activityTimer); this.activityTimer = undefined;
  }
  private async message(message: Message, tab: ProjectTab): Promise<void> { await tab.session!.append({ type: "message", message }); tab.session!.state.messages.push(message); }
  async submit(literal = false): Promise<void> {
    const tab = this.activeTab, text = tab.prompt.value;
    if (!literal && text.startsWith("/attach ")) {
      const raw=text.slice(8), paths=await pastedPaths(raw,this.project?.path ?? this.cwd) ?? parsePaths(raw); if(!paths) throw new Error("Ruta inválida"); await this.attach(paths); this.view.prompt.setValue(""); return;
    }
    const dropped=!literal && this.project && await pastedPaths(text,this.project.path);
    if(dropped) {this.requireIdle();await this.attach(dropped);this.view.prompt.setValue("");await this.saveDraft();return;}
    if(!literal && text.startsWith("/skill ")){
      const name=text.trim().split(/\s+/)[1];const skill=this.store.value.skills.find(s=>s.name===name && s.enabled && (!s.projectId||s.projectId===this.project?.id));
      if(!skill)throw new Error("Skill no habilitada para este proyecto. Abrí Tools → Skills.");
      if(text.trim()===`/skill ${name}`){this.view.prompt.setValue(`/skill ${name} `);this.status="Agregá el pedido y pulsá Enter";return;}
    }
    if (!literal && text.startsWith("/") && !text.startsWith("/skill ")) {
      const commands: Record<string, () => void> = { "/promptings":()=>this.promptings.library(), "/mcp":()=>this.extensions.servers(),"/skills":()=>this.extensions.skills(),"/projects": () => this.projects(), "/models": () => this.models(), "/providers": () => this.providers(), "/sessions": () => this.sessions(), "/files":()=>this.explore(), "/new": () => this.run(() => this.newSession()), "/help": () => this.desktop.onHelp(), "/attach":()=>this.attachmentMenu(), "/detach":()=>this.detach(), "/quit": () => this.desktop.onExit() };
      const action = commands[text.trim()]; if (!action) throw new Error("Comando desconocido. /help"); this.view.prompt.setValue(""); action(); return;
    }
    this.requireIdle(tab); if (!text.trim() && !tab.attachments.length) return;
    if (!tab.project || !tab.session) throw new Error("Registrá o elegí un proyecto antes de enviar");
    const { provider, model } = this.current(tab), session = tab.session, project = tab.project;
    if(!model.capabilities.images && hasImages(activeHistory(session.state))) throw new Error("La sesión contiene imágenes; elegí otro modelo o /new");
    const refreshed=await Promise.all(tab.attachments.map(a=>snapshot(a.path,project.path)));
    const changed=refreshed.some((a,i)=>a.hash!==tab.attachments[i]!.hash); tab.attachments=refreshed;
    validateAttachments(tab.attachments,model.capabilities.images);
    if(changed) {this.desktop.invalidate();throw new Error("Un adjunto cambió: vista actualizada. Revisá Ctrl+F y pulsá Enter de nuevo.");}
    const content=contentWithAttachments(text,tab.attachments);
    if (this.activeFile) { this.displayTab(tab); this.desktop.focus(this.view.promptWindow); }
    const key = await credential(provider, this.keys.get(provider.id));
    this.requireIdle(tab);
    const controller = new AbortController(), context = structuredClone({ mcpServers: this.store.value.mcpServers, skills: this.store.value.skills });
    tab.busy = true; tab.controller = controller; tab.tokens = emptyUsage();
    tab.agentState = "Conectando…"; this.startActivity();
    tab.prompt.setValue(""); tab.attachments=[]; tab.status = "Conectando…"; this.desktop.invalidate();
    this.desktop.resize(this.desktop.width,this.desktop.height);
    tab.turn = (async () => {
      try {
        await this.message({ role: "user", content }, tab); await this.saveDraft(tab); this.showHistory(false, tab);
        const calls=new Map<number,ToolCall>();
        const resetLive=()=>{calls.clear();tab.live=[];};
        const appendLive=(id:string,label:string,delta:string)=>{
          const reasoning = id === "reasoning";
          const previousVisible = tab.live.findLast(chunk => !chunk.reasoning || this.store.value.ui.showReasoning);
          let chunk = tab.live.at(-1);
          if (!chunk || chunk.id !== id) { chunk = { id, label, text: "", reasoning }; tab.live.push(chunk); }
          chunk.text += delta;
          if (!reasoning || this.store.value.ui.showReasoning) {
            if(previousVisible!==chunk) tab.response.append(`\n\n${this.desktop.t(label)}\n`, id === "answer" || reasoning ? theme.chatAgent : undefined);
            tab.response.append(delta);
          }
          this.desktop.invalidate();
        };
        const result = await runTurn({ project, session, provider, model, key, signal: controller.signal, ...context,
          onModel: detected => this.change(async () => {
            const next = structuredClone(this.store.value), configured = next.providers.find(p => p.id === provider.id && p.baseUrl === provider.baseUrl);
            const index = configured?.models.findIndex(m => m.id === model.id) ?? -1;
            if (configured && index >= 0 && JSON.stringify(configured.models[index]) !== JSON.stringify(detected)) {
              configured.models[index] = detected; await this.store.save(next); this.showContext(tab); this.desktop.invalidate();
            }
          }),
          onUsage: usage => { tab.tokens = usage; this.desktop.invalidate(); },
          onContext: usage => { tab.contextUsage = usage; this.desktop.invalidate(); },
          onState: state => { if(state==="Conectando…")resetLive();tab.status = state; tab.agentState = state === "Respondiendo…" ? "Razonando…" : state; this.desktop.invalidate(); },
          onMessage: () => { resetLive();this.showHistory(false, tab);this.desktop.invalidate(); },
          onReasoning: delta => { tab.status=tab.agentState="Razonando…";appendLive("reasoning","Razonamiento:",delta); },
          onToolCall: (index,call) => {
            tab.status=tab.agentState="Recibiendo herramientas…";const previous=calls.get(index);calls.set(index,call);
            const id=`call-${index}-${call.function.name}`;
            appendLive(id,`Tool call · ${call.function.name || "recibiendo…"}${previous ? " · continuación" : ""}`,
              call.function.arguments.slice(previous?.function.arguments.length ?? 0));
          },
          onToolStart: call => { appendLive(`running-${call.id}`,`Herramienta · ${call.function.name} · ejecutando…`,""); },
          onDelta: delta => { tab.status = tab.agentState = "Respondiendo…";appendLive("answer","Agente:",delta); } });
        tab.status = result.tokens.reported ? `Listo · E/S ${result.tokens.input ?? "N/D"}/${result.tokens.output ?? "N/D"}${result.tokens.partial ? " · parcial" : ""}` : "Listo · uso no reportado";
        await session.append({ type: "turn", state: "completed", detail: tab.status, tokens: tab.tokens });
      } catch (e) {
        if (e instanceof CompletionError && (e.partial.content || e.partial.reasoning_content || e.partial.reasoning)) {
          const {tool_calls: _incomplete, ...partial}=e.partial; await this.message(partial, tab);
        }
        tab.status = (e as Error).message; session.state.notices.push(tab.status);
        await session.append({ type: "turn", state: controller.signal.aborted ? "cancelled" : "failed", detail: tab.status, tokens: tab.tokens });
      } finally { tab.busy = false; tab.controller = undefined; tab.agentState = undefined; this.stopActivity(); tab.live=[]; this.showHistory(false, tab); this.desktop.invalidate(); }
    })();
    // Keep configuration/input responsive while the request runs.
    void tab.turn.catch(e => { tab.status = `No se pudo guardar el turno: ${(e as Error).message}`; this.desktop.invalidate(); });
  }
}
