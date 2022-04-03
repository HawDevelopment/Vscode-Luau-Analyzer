import * as vscode from "vscode";
import FileAnalyzer from "./FileAnalyzer";
import { getRojoProjectPath, getTypeDefsPath, pickFilePath } from "./Utils";

function getWorkspacePath(): string | null {
    let folders = vscode.workspace.workspaceFolders;
    if (!folders) {
        return null;
    }
    return folders[0].uri.fsPath;
}

export let ExtensionContext: vscode.ExtensionContext;
export let RojoProjectPath: string | undefined;
export let TypeDefsPath: string | undefined;
export let AnalyzerCommand: string;
export let ConfigurationName = "vscode-luau-analyzer";

class Extension {
    collection: vscode.DiagnosticCollection;
    fileAnalyzers: Map<string, FileAnalyzer>;
    
    constructor() {
        this.fileAnalyzers = new Map<string, FileAnalyzer>();
        
        this.collection = vscode.languages.createDiagnosticCollection("luau");
        ExtensionContext.subscriptions.push(this.collection);
    }
    
    deleteFileAnalyzer(document: vscode.TextDocument) {
        let path = document.uri.fsPath;
        this.fileAnalyzers.delete(path);
    }
    
    updateDiagnostics(document: vscode.TextDocument): void {
        let path = document.uri.fsPath;
        if (document && (path.endsWith(".lua") || path.endsWith(".luau"))) {
            let analyzer = this.fileAnalyzers.get(path);
            if (!analyzer) {
                analyzer = new FileAnalyzer(document, this.collection, getWorkspacePath());
                this.fileAnalyzers.set(path, analyzer);
            }
            analyzer.runDiagnostics();
        }
    }
    
    updateAllFiles() {
        this.fileAnalyzers.forEach((analyzer) => {
            analyzer.runDiagnostics();
        })
    }
    
    registerCommands() {
        ExtensionContext.subscriptions.push(
            vscode.commands.registerCommand(ConfigurationName + ".setRojoProject", async () => {
                let path = await pickFilePath("rojo project", ".project.json");
                if (!path) { return; }
                ExtensionContext.workspaceState.update("rojoLastPath", path);
                RojoProjectPath = path;
                this.updateAllFiles();
            }),
            vscode.commands.registerCommand(ConfigurationName + ".setTypeDefsPath", async () => {
                let path = await pickFilePath("type definitions", ".d.lua");
                if (!path) { return; }
                ExtensionContext.workspaceState.update("typeDefsLastPath", path);
                TypeDefsPath = path;
                this.updateAllFiles();
            })
        );
    }
    
    updateConfigs() {
        let config = vscode.workspace.getConfiguration(ConfigurationName);
        
        if (config.get("usesLuauAnalyzeRojo") == true) {
            getRojoProjectPath().then((path) => {
                if (path !== RojoProjectPath) {
                    RojoProjectPath = path;
                    this.updateAllFiles();
                }
            });
            getTypeDefsPath().then((path) => {
                if (path !== TypeDefsPath) {
                    TypeDefsPath = path;
                    this.updateAllFiles();
                }
            });
        }
        
        let command = config.get("analyzerCommand");
        if (command) {
            AnalyzerCommand = command as string;
        } else {
            vscode.window.showErrorMessage("Luau Analyzer command not found! Setting command to: `luau-analyze`");
            AnalyzerCommand = "luau-analyze";
            config.update("analyzerCommand", AnalyzerCommand, true);
        }
    }
    
    activate() {
        this.updateConfigs()
        ExtensionContext.subscriptions.push(vscode.workspace.onDidChangeConfiguration(this.updateConfigs));
        
        if (vscode.window.activeTextEditor) {
            this.updateDiagnostics(vscode.window.activeTextEditor.document);
        }
        
        this.registerCommands();
        
        ExtensionContext.subscriptions.push(
            vscode.workspace.onDidOpenTextDocument((document) => {
                this.updateDiagnostics(document);
            }),
            vscode.workspace.onDidChangeTextDocument((event) => {
                this.updateDiagnostics(event.document);
            }),
            vscode.workspace.onDidCloseTextDocument((document) => {
                this.collection.delete(document.uri);
                this.deleteFileAnalyzer(document);
            }),
        );
    }
    
    deactivate() {
        this.collection.dispose();
        this.fileAnalyzers.clear();
    }
}

let extension: Extension;

export function activate(context: vscode.ExtensionContext) {
    ExtensionContext = context;
    
    extension = new Extension()
    extension.activate();
    console.log("Luau Analyzer extension activated.");
}

export function deactivate() {
    extension.deactivate()
}
