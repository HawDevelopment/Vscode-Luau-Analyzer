import * as vscode from "vscode";
import { ExtensionSettings, Extension } from "./extension";
import FileAnalyzer from "./FileAnalyzer";

function getWorkspacePath(): string | null {
    let folders = vscode.workspace.workspaceFolders;
    if (!folders) {
        return null;
    }
    return folders[0].uri.fsPath;
}

export class FileAnalyzerGroup {
    fileAnalyzers: Map<string, FileAnalyzer> = new Map();
    
    constructor() { };
    
    isIgnored(path: string) {
        return ExtensionSettings.IgnoredPaths.some((ignoredPath) => {
            return ignoredPath.match(path);
        })
    }
    
    deleteFileAnalyzer(document: vscode.TextDocument) {
        let path = document.uri.fsPath;
        this.fileAnalyzers.delete(path);
    }
    
    addFileAnalyzer(path: string, analyzer: FileAnalyzer) {
        this.fileAnalyzers.set(path, analyzer);
    }
    
    createFileAnalyzer(document: vscode.TextDocument) {
        let analyzer = new FileAnalyzer(
            document,
            Extension.diagnosticGroup.getOrCreateDiagnosticCollection(document.uri),
            getWorkspacePath()
        );
        this.fileAnalyzers.set(document.uri.fsPath, analyzer);
        return analyzer;
    }
    
    getOrCreateFileAnalyzer(document: vscode.TextDocument) {
        let path = document.uri.fsPath;
        if (document && (path.endsWith(".lua") || path.endsWith(".luau"))) {
            let analyzer = this.fileAnalyzers.get(path);
            if (!analyzer) {
                analyzer = this.createFileAnalyzer(document);
            }
            return analyzer;
        }
    }
    
    runFileAnalyzer(analyzer: FileAnalyzer) {
        analyzer.runDiagnostics()
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
}