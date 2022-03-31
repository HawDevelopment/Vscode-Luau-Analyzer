import * as vscode from "vscode";
import FileAnalyzer from "./FileAnalyzer";

function getWorkspacePath(): string | null {
    let folders = vscode.workspace.workspaceFolders;
    if (!folders) {
        return null;
    }
    return folders[0].uri.fsPath;
}

class Extension {
    context: vscode.ExtensionContext;
    collection: vscode.DiagnosticCollection;
    fileAnalyzers: Map<string, FileAnalyzer>;
    
    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.fileAnalyzers = new Map<string, FileAnalyzer>();
        
        this.collection = vscode.languages.createDiagnosticCollection("luau");
        this.context.subscriptions.push(this.collection);
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
    
    activate() {
        
        this.context.subscriptions.push(
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
    extension = new Extension(context)
    extension.activate();
}

export function deactivate() {
    extension.deactivate()
}
