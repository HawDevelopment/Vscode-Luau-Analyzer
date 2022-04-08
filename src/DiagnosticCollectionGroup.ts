import * as vscode from "vscode";
import { DiagnosticCollection } from "./DiagnosticCollection";
import { ExtensionSettings, Extension } from "./extension";
import FileAnalyzer from "./FileAnalyzer";

function getWorkspacePath(): string | null {
    let folders = vscode.workspace.workspaceFolders;
    if (!folders) {
        return null;
    }
    return folders[0].uri.fsPath;
}

export class DiagnosticCollectionGroup {
    diagnosticCollections: Map<string, DiagnosticCollection> = new Map();
    collection: vscode.DiagnosticCollection;
    
    constructor(collection: vscode.DiagnosticCollection) {
        this.collection = collection;
    };
    
    isIgnored(path: string) {
        return ExtensionSettings.IgnoredPaths.some((ignoredPath) => {
            return ignoredPath.match(path);
        })
    }
    
    applyDiagnosticCollection(collection: DiagnosticCollection) {
        if (!this.isIgnored(collection.uri.fsPath)) {
            collection.apply()
        }
        
        if (!(collection.changes) && !(Extension.analyzerGroup.fileAnalyzers.has(collection.uri.fsPath))) {
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
}