import * as vscode from "vscode";
import { DiagnosticCollection } from "./DiagnosticCollection";
import FileAnalyzer from "./FileAnalyzer";
import { installTypes } from "./Utils";

function getWorkspacePath(): string | null {
    let folders = vscode.workspace.workspaceFolders;
    if (!folders) {
        return null;
    }
    return folders[0].uri.fsPath;
}

export const ConfigurationName = "vscode-luau-analyzer";
export let Extension: ExtensionClass;
export let ExtensionContext: vscode.ExtensionContext;

export let ExtensionSettings: {
    RojoProjectPath: string,
    TypeDefsPath: string,
    UsesLuauAnalyzeRojo: boolean,
    AnalyzerCommand: string,
    IgnoredPaths: string[],
    ReadFilesystemOnly: boolean,
};

let SourceMap: string = "";
let AnnotatedSource: string = "";

class ExtensionClass {
    collection: vscode.DiagnosticCollection;
    fileAnalyzers: Map<string, FileAnalyzer> = new Map();
    diagnosticCollections: Map<string, DiagnosticCollection> = new Map();
    context: vscode.ExtensionContext;
    
    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.collection = vscode.languages.createDiagnosticCollection("luau");
        context.subscriptions.push(this.collection);
    }
    
    isIgnored(path: string) {
        return ExtensionSettings.IgnoredPaths.some((ignoredPath) => {
            return ignoredPath.match(path);
        })
    }
    
    deleteFileAnalyzer(document: vscode.TextDocument) {
        let path = document.uri.fsPath;
        this.fileAnalyzers.delete(path);
    }
    
    createFileAnalyzer(document: vscode.TextDocument) {
        let analyzer = new FileAnalyzer(
            document,
            this.getOrCreateDiagnosticCollection(document.uri),
            getWorkspacePath()
        );
        this.fileAnalyzers.set(document.uri.fsPath, analyzer);
        return analyzer;
    }
    
    runOrCreateFileAnalyzer(document: vscode.TextDocument) {
        let path = document.uri.fsPath;
        if (document && (path.endsWith(".lua") || path.endsWith(".luau"))) {
            let analyzer = this.fileAnalyzers.get(path);
            if (!analyzer) {
                analyzer = this.createFileAnalyzer(document);
            }
            this.runFileAnalyzer(analyzer);
        }
    }
    
    runFileAnalyzer(analyzer: FileAnalyzer) {
        analyzer.runDiagnostics()
        this.applyAllDiagnosticCollections()
    }
    
    updateAllFileAnalyzers() {
        this.fileAnalyzers.forEach((analyzer) => {
            analyzer.rebuildArgs();
        })
    }
    
    runAllFileAnalyzers() {
        this.fileAnalyzers.forEach((analyzer) => {
            analyzer.runDiagnostics();
        })
    }
    
    applyDiagnosticCollection(collection: DiagnosticCollection) {
        if (!this.isIgnored(collection.uri.fsPath)) {
            collection.apply()
        }
        
        if (!(collection.changes) && !(this.fileAnalyzers.has(collection.uri.fsPath))) {
            this.diagnosticCollections.delete(collection.uri.fsPath);
        }
        collection.dispose()
    }
    
    applyAllDiagnosticCollections() {
        this.diagnosticCollections.forEach((collection) => {
            this.applyDiagnosticCollection(collection)
        })
    }
    
    getOrCreateDiagnosticCollection(uri: vscode.Uri) {
        let path = uri.fsPath;
        let collection = this.diagnosticCollections.get(path);
        if (!collection) {
            collection = new DiagnosticCollection(this.collection, uri);
            this.diagnosticCollections.set(path, collection);
        }
        return collection;
    }
    
    rojoGetActiveFile(): FileAnalyzer | undefined {
        let config = vscode.workspace.getConfiguration(ConfigurationName);
        
        if (config.get("usesLuauAnalyzeRojo") !== true) {
            vscode.window.showErrorMessage(`${ConfigurationName}: Cannot show file! Uses Luau Analyze Rojo is not enabled in configurations!`);
            return undefined;
        }
        
        let textEditor = vscode.window.activeTextEditor 
        if (!textEditor) { return; }
        let fileAnalyzer = this.fileAnalyzers.get(textEditor.document.uri.fsPath)!;
        return fileAnalyzer;
    }
    
    registerCommands() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(ConfigurationName + ".showSourceMap", () => {
                let fileAnalyzer = this.rojoGetActiveFile();
                if (!fileAnalyzer) { return; }
                SourceMap = fileAnalyzer.executeAnalyzer(["--dump-source-map"])
                
                vscode.workspace.openTextDocument({
                    language: "text",
                    content: SourceMap
                }).then((document) => {
                    vscode.window.showTextDocument(document);
                })
            }),
            vscode.commands.registerCommand(ConfigurationName + ".showAnnotations", () => {
                let fileAnalyzer = this.rojoGetActiveFile();
                if (!fileAnalyzer) { return; }
                AnnotatedSource = fileAnalyzer.executeAnalyzer(["--annotate"])
                
                vscode.workspace.openTextDocument({
                    language: "lua",
                    content: AnnotatedSource
                }).then((document) => {
                    vscode.window.showTextDocument(document);
                })
            }),
            vscode.commands.registerCommand(ConfigurationName + ".installTypes", () => {
                installTypes()
            }),
        )
    }
    
    updateConfigs() {
        let config = vscode.workspace.getConfiguration(ConfigurationName);
        
        let newSettings = {
            RojoProjectPath: config.get("rojoProject", "default.project.json"),
            TypeDefsPath: config.get("typeDefinition", "globalTypes.d.lua"),
            UsesLuauAnalyzeRojo: config.get("usesLuauAnalyzeRojo") as boolean,
            AnalyzerCommand: config.get("analyzerCommand", "luau-analyze"),
            IgnoredPaths: config.get("ignoredPaths", []) as string[],
            ReadFilesystemOnly: config.get("readFilesystemOnly", false),
        }
        
        ExtensionSettings = newSettings;
        
        if (!ExtensionSettings.AnalyzerCommand) {
            vscode.window.showErrorMessage(`${ConfigurationName}: Luau Analyzer command not found! Setting command to: \`luau-analyze\``);
            ExtensionSettings.AnalyzerCommand = "luau-analyze";
            config.update("analyzerCommand", ExtensionSettings.AnalyzerCommand, true);
        }
        
        this.updateAllFileAnalyzers();
        this.runAllFileAnalyzers();
        this.applyAllDiagnosticCollections();
    }
    
    activate() {
        this.updateConfigs()
        this.context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
            this.updateConfigs();
        }));
        
        if (vscode.window.activeTextEditor) {
            this.runOrCreateFileAnalyzer(vscode.window.activeTextEditor.document);
        }
        
        this.registerCommands();
        
        this.context.subscriptions.push(
            vscode.workspace.onDidOpenTextDocument((document) => {
                this.runOrCreateFileAnalyzer(document);
            }),
            vscode.workspace.onDidChangeTextDocument((event) => {
                if (ExtensionSettings.ReadFilesystemOnly === false) {
                    this.runOrCreateFileAnalyzer(event.document);
                }
            }),
            vscode.workspace.onDidSaveTextDocument((document) => {
                if (ExtensionSettings.ReadFilesystemOnly === true) {
                    this.runOrCreateFileAnalyzer(document);
                }
            }),
            vscode.workspace.onDidCloseTextDocument((document) => {
                this.deleteFileAnalyzer(document);
            }),
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (editor) {
                    this.runOrCreateFileAnalyzer(editor.document);
                }
            }),
        );
    }
    
    deactivate() {
        this.collection.dispose();
        this.fileAnalyzers.clear();
    }
}

export function activate(context: vscode.ExtensionContext) {    
    Extension = new ExtensionClass(context);
    Extension.activate();
    console.log("Luau Analyzer extension activated.");
}

export function deactivate() {
    Extension.deactivate()
}
