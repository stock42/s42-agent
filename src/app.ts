import { basename, dirname, resolve, sep } from "node:path";
import { ConfigStore, normalizeFolder, storagePaths, type Project, type Provider, type Model } from "./storage/config.ts";
import { Session, listSessions } from "./storage/sessions.ts";
import type { Message, Selection } from "./agent/messages.ts";
import { createWorkspaceView } from "./ui/workspace.ts";
import { choose, form } from "./ui/dialogs.ts";
import { createDemoPanels } from "./ui/demo.ts";
import { theme } from "./ui/theme.ts";
import { CompletionError, credential, discoverModels } from "./llm/client.ts";
import { runTurn } from "./agent/loop.ts";
import { markdownText } from "./ui/markdown.ts";
import { contentWithAttachments, hasImages, parsePaths, pastedPaths, snapshot, validateAttachments, type Attachment } from "./agent/attachments.ts";
import { bindings, type Action } from "./ui/bindings.ts";
import type { InputEvent } from "./ui/types.ts";
import { readdir } from "node:fs/promises";

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
  attachments: Attachment[] = [];
  mode: "INSERT" | "NORMAL" = "INSERT";
  private pending = "";
  private pasting = false;
  private operations: Promise<unknown> = Promise.resolve();
  private turn?: Promise<void>;
  private controller?: AbortController;
  private rendered = new WeakMap<Message, string>();
  private constructor(readonly store: ConfigStore, readonly sessionsPath: string, readonly cwd: string) {
    const { prompt, send, promptWindow } = this.view;
    const resize=this.desktop.onResize!;
    this.desktop.onResize=(width,height)=>{resize(width,height);if(this.attachments.length && promptWindow.client.height<3){
      promptWindow.bounds.height++;promptWindow.bounds.y--;this.view.editorWindow.bounds.height--;this.desktop.floatingArea={...this.view.editorWindow.bounds};
    }};
    this.view.editorWindow.onLayout = client => { this.view.response.bounds.y = 1; this.view.response.bounds.height = Math.max(1, client.height - 1); this.view.response.bounds.width = Math.max(1, client.width - 2); };
    this.view.editorWindow.onDraw = (canvas, client) => {
      let context = "No hay modelo configurado. Models → Configurar modelo";
      try { const { provider, model } = this.current(); context = `${provider.name} · ${model.id} · ${this.session?.state.id.slice(0, 8) ?? ""}`; } catch {}
      canvas.text(client.x + 1, client.y, context, theme.window, client.width - 2);
    };
    prompt.onSubmit = () => this.run(() => this.submit()); send.onClick = () => this.busy ? this.cancel() : this.run(() => this.submit());
    const promptLayout = promptWindow.onLayout!;
    promptWindow.onLayout = client => { promptLayout(client); if (this.attachments.length) prompt.bounds.height = Math.max(1, prompt.bounds.height - 1); };
    promptWindow.onDraw = (canvas, client) => {
      if (this.attachments.length) canvas.text(client.x + 1, client.y + client.height - 2,
        `Adjuntos (${this.attachments.length}): ${this.attachments.map(a => `${a.name} ${a.size} B`).join(" · ")} · Ctrl+F`, theme.window, client.width - 2);
      const hint="Shift+Enter: línea", available=Math.max(1,client.width - 5 - Bun.stringWidth(hint));
      canvas.text(client.x + 1, client.y + client.height - 1, `${this.mode} · ${this.status}`, theme.window, available);
      canvas.text(client.x + 1 + available,client.y + client.height - 1," · "+hint,theme.window,client.width - available - 2);
    };
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
        { label: "Descubrir /models", run: () => this.run(() => this.discover()) },
        { label: "Guardar default", run: () => this.run(() => this.saveDefault()) },
        { label: "Default del proyecto", run: () => this.run(() => this.saveProjectDefault()) },
        { label: "Quitar proveedor", run: () => this.removeProvider() },
      ] },
      { label: "Ventanas", items: [
        { label: "Respuestas", run: () => this.desktop.focus(this.view.editorWindow) },
        { label: "Prompt", run: () => this.desktop.focus(promptWindow) },
        { label: "Adjuntos", shortcut: "Ctrl+F", run: () => this.attachmentMenu() },
        { label: "Componentes", run: demo.components },
        { label: "Siguiente", shortcut: "Ctrl+N", run: () => this.desktop.cycle() },
        { label: "Cerrar auxiliar", shortcut: "Ctrl+W", run: () => this.desktop.close() },
      ] },
      { label: "Ayuda", hotkey: "y", align: "right", items: [{ label: "Atajos y mouse", run: () => this.desktop.onHelp() }, {label:"Activar / desactivar Vim",run:()=>this.run(async()=>{ const next=structuredClone(this.store.value); next.ui.vimMode=!next.ui.vimMode; await this.store.save(next); this.mode="INSERT"; this.pending="";this.status=`Vim ${next.ui.vimMode ? "activado" : "desactivado"}`; })}] },
    );
    this.desktop.onHelp = () => demo.dialog("Ayuda · " + this.mode, [
      "Enter enviar · Shift+Enter nueva línea", ...Object.entries(bindings(this.store.value.ui.bindings).global).map(([action,key])=>`${key}: ${action}`), "Ctrl+C: cancelar turno · Ctrl+Q: salir",
      "Esc: INSERT → NORMAL → menú; modal: cerrar", "NORMAL: h/j/k/l w/b 0/$ · i/a/I/A · x dd u", "Conversación: j/k Ctrl+D/U gg/G; solo lectura",
      "Leader: Espacio + p/m/s/f/? · Ctrl+N panel", "Comandos: /help /projects /models /providers", "/sessions /new /attach ruta /detach /quit",
    ]);
    this.desktop.onShortcut = event => {
      if (event.type !== "key") return false;
      if (event.key === "ctrl+c" && this.busy) { this.cancel(); return true; }
      if (this.desktop.modal || this.desktop.menu.opened >= 0) return false;
      if (event.key === "escape" && this.store.value.ui.vimMode && this.mode === "INSERT" && this.desktop.active === promptWindow && promptWindow.focusedId === prompt.id) { this.mode = "NORMAL"; this.pending = ""; return true; }
      if (event.key === "tab" && this.mode === "NORMAL" && this.desktop.active?.fixed) {
        this.desktop.focus(this.desktop.active === promptWindow ? this.view.editorWindow : promptWindow); promptWindow.focusedId = prompt.id; this.pending = ""; return true;
      }
      if(event.key==="tab" && this.desktop.active===promptWindow && promptWindow.focusedId===prompt.id && this.mode==="INSERT") {
        const text=prompt.value, commands=["/help","/projects","/providers","/models","/sessions","/new","/attach","/detach","/quit"];
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
      : this.desktop.active===promptWindow && this.store.value.ui.vimMode ? "Enter Enviar  Esc NORMAL  ^N Panel  ^F Adjuntos  ^Q Salir" : "Esc Menú  Tab Foco  ^N Panel  Alt+Y Ayuda  ^Q Salir";
    this.desktop.onBeforeExit = async () => { this.cancel(); let pending: Promise<unknown>; do { pending=this.operations; await pending; } while(pending!==this.operations); await this.turn; await this.saveDraft(); await this.session?.close(); };
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
  private change(work: () => Promise<void>): Promise<void> {
    const pending=this.operations.then(work); this.operations=pending.catch(()=>{}); return pending;
  }
  private requireIdle(): void { if (this.busy) throw new Error("Hay un turno activo: cancelalo antes de cambiar de contexto"); }
  private async saveDraft(): Promise<void> {
    if (this.session) await this.session.append({ type: "draft", text: this.view.prompt.value, attachments: this.attachments.map(a => a.path) });
  }
  async switchProject(project: Project, id?: string): Promise<void> {
    this.requireIdle(); await normalizeFolder(project.path, this.cwd);
    id ??= project.lastSessionId;
    if (this.project?.id === project.id && this.session?.state.id === id) return;
    const next = await Session.open(this.sessionsPath, project.id, id);
    try { if (!next.state.events.length) await next.append({ type: "session", title: new Date().toLocaleString("es") }); await this.saveDraft(); await this.session?.close(); }
    catch (e) { await next.close(); throw e; }
    this.project = project; this.session = next;
    this.attachments = [];
    for (const path of next.state.attachments) try { this.attachments.push(await snapshot(path, project.path)); } catch (e) { next.state.notices.push(`Adjunto ${path}: ${(e as Error).message}`); }
    this.mode = "INSERT"; this.pending = "";
    this.desktop.resize(this.desktop.width,this.desktop.height);
    this.selection = next.state.selection ?? project.selection ?? this.store.value.defaults;
    this.view.prompt.setValue(next.state.draft); this.view.editorWindow.title = project.name;
    const config = structuredClone(this.store.value); config.lastProjectId = project.id;
    config.projects.find(p => p.id === project.id)!.lastSessionId = next.state.id; project.lastSessionId = next.state.id;
    await this.store.save(config);
    this.status="Listo";this.showHistory(); this.showContext(); this.desktop.focus(this.view.promptWindow); this.desktop.invalidate();
  }
  async newSession(): Promise<void> { this.requireIdle(); if (!this.project) { this.projectForm(); return; } await this.switchProject(this.project, crypto.randomUUID()); }
  projects(): void { choose(this.desktop, "Proyectos", this.store.value.projects.map(value => ({ label: `${value.name} · ${value.path}`, value })), p => this.run(() => this.switchProject(p))); }
  projectForm(project?: Project): void {
    if (this.busy) { this.status = "Cancelá el turno antes de editar proyectos"; return; }
    form(this.desktop, project ? "Editar proyecto" : "Agregar proyecto", [{ label: "Nombre", value: project?.name ?? basename(this.cwd) }, { label: "Carpeta", value: project?.path ?? this.cwd }], ([name, path]) => this.change(async () => {
      const saved = await this.store.project(name!, path!, this.cwd, project?.id);
      await this.switchProject(saved);
    }));
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
    if (!this.session?.state.messages.length && this.status === "Listo") this.status = selected;
    this.desktop.invalidate();
  }
  showHistory(reset = true): void {
    const messages = this.session?.state.messages ?? [];
    const text = messages.map(m => {
      let cached = this.rendered.get(m); if (cached !== undefined) return cached;
      let content = typeof m.content === "string" ? m.content : m.content?.map(part => part.type === "text" ? part.text : "[Imagen adjunta guardada en la sesión]").join("\n");
      if(m.role==="tool" && typeof content==="string") try {
        const result=JSON.parse(content);if(typeof result.output==="string" && typeof result.failed==="boolean") {
          let output=result.output;try{const shell=JSON.parse(output);if(typeof shell.stdout==="string")output=`${shell.stdout}${shell.stderr?"\nstderr:\n"+shell.stderr:""}`;}catch{}
          content=`${result.failed?"Error":"OK"}${result.exitCode!==undefined?" · exit "+result.exitCode:""} · ${result.durationMs} ms\n${output}`;
        }
      }catch{}
      cached = `${m.role === "user" ? "Vos" : m.role === "assistant" ? "Agente" : "Herramienta"}:\n${m.role === "assistant" ? markdownText(content ?? "") : content ?? ""}${m.tool_calls ? "\n" + m.tool_calls.map(c => `${c.function.name} ${c.function.arguments}`).join("\n") : ""}`;
      this.rendered.set(m, cached); return cached;
    }).join("\n\n") + (this.session?.state.notices.length ? "\n\n" + this.session.state.notices.join("\n") : "");
    if (reset) this.view.response.setValue(text, "end"); else this.view.response.update(text);
  }
  async selectModel(selection: Selection): Promise<void> { this.requireIdle(); const old = this.selection; this.selection = selection;
    try { const {model} = this.current(); if (!model.capabilities.images && hasImages(this.session?.state.messages ?? [])) throw new Error("La sesión contiene imágenes: elegí un modelo con imágenes o creá /new"); await this.session?.append({ type: "selection", selection }); if (this.session) this.session.state.selection = selection; }
    catch (e) { this.selection = old; throw e; } this.status = "Modelo elegido"; this.showContext(); }
  models(): void { choose(this.desktop, "Models · elegir", this.store.value.providers.flatMap(p => p.models.map(m => ({ label: `${p.name} · ${m.id}`, value: { providerId: p.id, modelId: m.id } }))), s => this.run(() => this.selectModel(s))); }
  providers(): void { choose(this.desktop, "Proveedores", this.store.value.providers.map(value => ({ label: `${value.name} · ${value.baseUrl}`, value })), p => this.run(async () => {
    this.requireIdle();
    if(p.models.length) await this.selectModel({providerId:p.id,modelId:p.models[0]!.id});
    else {this.selection={providerId:p.id};await this.session?.append({type:"selection",selection:this.selection});if(this.session)this.session.state.selection=this.selection;this.showContext();}
    this.providerForm(p);
  })); }
  providerForm(provider: Provider): void {
    const url=new URL(provider.baseUrl),port=url.port;url.port="";
    form(this.desktop,"Proveedor · configurar",[{label:"Nombre",value:provider.name},{label:"Host / URL base",value:url.href.replace(/\/$/,"")},{label:"Puerto",value:port},{label:"Variable API key",value:provider.apiKeyEnv??""}],([name,host,port,env])=>this.change(async()=>{
      this.requireIdle();const endpoint=new URL(host!);if(port && (!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535))throw new Error("Puerto inválido");endpoint.port=port??"";
      const next=structuredClone(this.store.value),p=next.providers.find(p=>p.id===provider.id)!;p.name=name!;p.baseUrl=endpoint.href.replace(/\/$/,"");p.apiKeyEnv=env?.trim()||undefined;await this.store.save(next);this.showContext();
    }));
  }
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
    ], ([id, name, host, port, apiKey, apiKeyEnv, context, max, caps]) => this.change(async () => {
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
    }));
  }
  removeModel(): void { choose(this.desktop, "Quitar modelo", this.store.value.providers.flatMap(p => p.models.map(m => ({ label: `${p.name} · ${m.id}`, value: { p: p.id, m: m.id } }))), s => this.run(async () => {
    this.requireIdle(); const next = structuredClone(this.store.value); next.providers.find(p => p.id === s.p)!.models = next.providers.find(p => p.id === s.p)!.models.filter(m => m.id !== s.m); await this.store.save(next); this.showContext();
  })); }
  async saveDefault(): Promise<void> { this.requireIdle(); this.current(); const next = structuredClone(this.store.value); next.defaults = { ...this.selection, projectId: this.project?.id }; await this.store.save(next); this.status = "Default guardado"; this.desktop.invalidate(); }
  async saveProjectDefault(): Promise<void> { this.requireIdle(); this.current(); if (!this.project) throw new Error("Elegí un proyecto"); const next=structuredClone(this.store.value); next.projects.find(p=>p.id===this.project!.id)!.selection={...this.selection}; await this.store.save(next); this.project.selection={...this.selection}; this.status="Default del proyecto guardado"; }
  removeProvider(): void { choose(this.desktop,"Quitar proveedor",this.store.value.providers.map(value=>({label:value.name,value})),p=>this.run(async()=>{
    this.requireIdle(); const next=structuredClone(this.store.value); next.providers=next.providers.filter(provider=>provider.id!==p.id); await this.store.save(next); this.keys.delete(p.id); this.showContext();
  })); }
  async discover(): Promise<void> {
    this.requireIdle(); const provider = this.store.value.providers.find(p => p.id === this.selection.providerId); if (!provider) throw new Error("Elegí un proveedor");
    const key=credential(provider,this.keys.get(provider.id));this.controller=new AbortController();this.busy=true;this.view.send.label="Cancelar";
    this.status = "Consultando /models…"; this.desktop.invalidate();
    try {
    const ids = await discoverModels(provider, key, AbortSignal.any([this.controller.signal,AbortSignal.timeout(this.store.value.limits.firstEventMs)]));
    const next = structuredClone(this.store.value), configured = next.providers.find(p => p.id === provider.id)!;
    for (const id of ids) if (!configured.models.some(m => m.id === id)) configured.models.push({ id, name: id, contextWindow: 8192, maxOutputTokens: 2048, capabilities: { tools: false, images: false } });
    await this.store.save(next); this.status = "IDs descubiertos; configurá contexto y capacidades en Models"; this.models(); this.desktop.invalidate();
    } finally {this.busy=false;this.controller=undefined;this.view.send.label="Enviar";this.desktop.invalidate();}
  }
  private action(action: Action): void {
    ({projects:()=>this.projects(),models:()=>this.models(),providers:()=>this.providers(),sessions:()=>this.sessions(),attachments:()=>this.attachmentMenu(),help:()=>this.desktop.onHelp()})[action]();
  }
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
    if (key === " ") { this.pending="leader"; this.status="Leader: p proyecto · m modelo · s sesión · f adjunto · ? ayuda"; return true; }
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
    choose(this.desktop,"Adjuntos",[{label:"Agregar por ruta",value:"add"},{label:`Ver / quitar (${this.attachments.length})`,value:"remove"}],action=>{
      if(action==='remove') this.detach(); else form(this.desktop,"Adjuntar archivos",[{label:"Rutas",value:""}],([text])=>this.change(async()=>{
        const paths=await pastedPaths(text!,this.project?.path ?? this.cwd) ?? parsePaths(text!); if(!paths) throw new Error("Escribí una ruta válida"); await this.attach(paths);
      }));
    });
  }
  detach(): void { choose(this.desktop,"Quitar adjunto",this.attachments.map(value=>({label:`${value.path} · ${value.size} B`,value})),a=>this.run(async()=>{
    this.attachments=this.attachments.filter(item=>item!==a); this.desktop.resize(this.desktop.width,this.desktop.height); await this.saveDraft(); this.status="Adjunto quitado"; this.desktop.invalidate();
  })); }
  cancel(): void { this.controller?.abort(new Error("Turno cancelado; los efectos ya realizados se conservan")); }
  private async message(message: Message): Promise<void> { await this.session!.append({ type: "message", message }); this.session!.state.messages.push(message); }
  async submit(): Promise<void> {
    const text = this.view.prompt.value;
    if (text.startsWith("/attach ")) {
      const raw=text.slice(8), paths=await pastedPaths(raw,this.project?.path ?? this.cwd) ?? parsePaths(raw); if(!paths) throw new Error("Ruta inválida"); await this.attach(paths); this.view.prompt.setValue(""); return;
    }
    const dropped=this.project && await pastedPaths(text,this.project.path);
    if(dropped) {this.requireIdle();await this.attach(dropped);this.view.prompt.setValue("");await this.saveDraft();return;}
    if (text.startsWith("/")) {
      const commands: Record<string, () => void> = { "/projects": () => this.projects(), "/models": () => this.models(), "/providers": () => this.providers(), "/sessions": () => this.sessions(), "/new": () => this.run(() => this.newSession()), "/help": () => this.desktop.onHelp(), "/attach":()=>this.attachmentMenu(), "/detach":()=>this.detach(), "/quit": () => this.desktop.onExit() };
      const action = commands[text.trim()]; if (!action) throw new Error("Comando desconocido. /help"); this.view.prompt.setValue(""); action(); return;
    }
    this.requireIdle(); if (!text.trim() && !this.attachments.length) return;
    if (!this.project || !this.session) throw new Error("Registrá o elegí un proyecto antes de enviar");
    const { provider, model } = this.current(), session = this.session;
    if(!model.capabilities.images && hasImages(session.state.messages)) throw new Error("La sesión contiene imágenes; elegí otro modelo o /new");
    const refreshed=await Promise.all(this.attachments.map(a=>snapshot(a.path,this.project!.path)));
    const changed=refreshed.some((a,i)=>a.hash!==this.attachments[i]!.hash); this.attachments=refreshed;
    validateAttachments(this.attachments,model.capabilities.images);
    if(changed) {this.desktop.invalidate();throw new Error("Un adjunto cambió: vista actualizada. Revisá Ctrl+F y pulsá Enter de nuevo.");}
    const content=contentWithAttachments(text,this.attachments);
    const key = credential(provider, this.keys.get(provider.id));
    this.busy = true; this.controller = new AbortController(); this.view.send.label = "Cancelar";
    this.view.prompt.setValue(""); this.attachments=[]; this.status = "Conectando…"; this.desktop.invalidate();
    this.desktop.resize(this.desktop.width,this.desktop.height);
    this.turn = (async () => {
      try {
        await this.message({ role: "user", content }); await this.saveDraft(); this.showHistory(false);
        this.view.response.append("\n\nAgente:\n");
        const result = await runTurn({ project: this.project!, session, provider, model, key, signal: this.controller!.signal, limits: this.store.value.limits,
          onState: state => { this.status = state; this.desktop.invalidate(); },
          onMessage: () => { this.showHistory(false); this.view.response.append("\n\nAgente:\n"); this.desktop.invalidate(); },
          onDelta: delta => { this.status = "Respondiendo…"; this.view.response.append(delta); this.desktop.invalidate(); } });
        this.status = result.usage !== undefined ? `Listo · ${result.usage} tokens` : "Listo · uso no reportado";
        await session.append({ type: "turn", state: "completed", detail: this.status });
      } catch (e) {
        if (e instanceof CompletionError && e.partial.content) await this.message({ role: "assistant", content: e.partial.content });
        this.status = (e as Error).message; session.state.notices.push(this.status);
        await session.append({ type: "turn", state: this.controller!.signal.aborted ? "cancelled" : "failed", detail: this.status });
      } finally { this.busy = false; this.controller = undefined; this.view.send.label = "Enviar"; this.showHistory(false); this.desktop.invalidate(); }
    })();
    // Keep configuration/input responsive while the request runs.
    void this.turn.catch(e => { this.status = `No se pudo guardar el turno: ${(e as Error).message}`; this.desktop.invalidate(); });
  }
}
