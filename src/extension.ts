import * as vscode from "vscode";
import { DiagnosticCollection } from "./DiagnosticCollection";
import { DiagnosticCollectionGroup } from "./DiagnosticCollectionGroup";
import FileAnalyzer from "./FileAnalyzer";
import { FileAnalyzerGroup } from "./FileAnalyzerGroup";
import { installTypes } from "./Utils";



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
    AdditionalArgs: string[],
};

let SourceMap: string = "";
let AnnotatedSource: string = "";

class ExtensionClass {
    collection: vscode.DiagnosticCollection;
    analyzerGroup: FileAnalyzerGroup = new FileAnalyzerGroup();
    diagnosticGroup: DiagnosticCollectionGroup;
    context: vscode.ExtensionContext;
    
    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.collection = vscode.languages.createDiagnosticCollection("luau");
        context.subscriptions.push(this.collection);
        this.diagnosticGroup = new DiagnosticCollectionGroup(this.collection);
    }
    
    runTextDocument(document: vscode.TextDocument) {
        let analyzer = this.analyzerGroup.getOrCreateFileAnalyzer(document);
        if (!analyzer) { return }
        this.analyzerGroup.runFileAnalyzer(analyzer);
        this.diagnosticGroup.applyAllDiagnosticCollections()
    }
    
    rojoGetActiveFile(): FileAnalyzer | undefined {
        let config = vscode.workspace.getConfiguration(ConfigurationName);
        
        if (config.get("usesLuauAnalyzeRojo") !== true) {
            vscode.window.showErrorMessage(`${ConfigurationName}: Cannot show file! Uses Luau Analyze Rojo is not enabled in configurations!`);
            return undefined;
        }
        
        let textEditor = vscode.window.activeTextEditor 
        if (!textEditor) { return; }
        let fileAnalyzer = this.analyzerGroup.fileAnalyzers.get(textEditor.document.uri.fsPath)!;
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
            AdditionalArgs: config.get("additionalArgs", []) as string[],
        }
        
        ExtensionSettings = newSettings;
        
        if (!ExtensionSettings.AnalyzerCommand) {
            vscode.window.showErrorMessage(`${ConfigurationName}: Luau Analyzer command not found! Setting command to: \`luau-analyze\``);
            ExtensionSettings.AnalyzerCommand = "luau-analyze";
            config.update("analyzerCommand", ExtensionSettings.AnalyzerCommand, true);
        }
        
        this.analyzerGroup.updateAllFileAnalyzers();
        this.analyzerGroup.runAllFileAnalyzers();
        this.diagnosticGroup.applyAllDiagnosticCollections();
    }
    
    activate() {
        this.updateConfigs()
        this.context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
            this.updateConfigs();
        }));
        
        if (vscode.window.activeTextEditor) {
            this.runTextDocument(vscode.window.activeTextEditor.document);
        }
        
        this.registerCommands();
        
        this.context.subscriptions.push(
            vscode.workspace.onDidOpenTextDocument((document) => {
                this.runTextDocument(document);
            }),
            vscode.workspace.onDidChangeTextDocument((event) => {
                if (ExtensionSettings.ReadFilesystemOnly === false) {
                    this.runTextDocument(event.document);
                }
            }),
            vscode.workspace.onDidSaveTextDocument((document) => {
                if (ExtensionSettings.ReadFilesystemOnly === true) {
                    this.runTextDocument(document);
                }
            }),
            vscode.workspace.onDidCloseTextDocument((document) => {
                this.analyzerGroup.deleteFileAnalyzer(document);
            }),
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (editor) {
                    this.runTextDocument(editor.document);
                }
            }),
        );
    }
    
    deactivate() {
        this.collection.dispose();
        this.analyzerGroup.fileAnalyzers.clear();
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
