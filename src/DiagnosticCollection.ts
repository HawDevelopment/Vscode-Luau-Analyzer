import * as vscode from "vscode";


export class DiagnosticCollection {
    collection: vscode.DiagnosticCollection;
    uri: vscode.Uri;
    diagnostics: vscode.Diagnostic[] = [];
    diagnosticsMap: Map<string, vscode.Diagnostic> = new Map();
    oldDiagnosticsMap: Map<string, vscode.Diagnostic> = new Map();
    changes: boolean = false;
    
    constructor(collection: vscode.DiagnosticCollection, uri: vscode.Uri) {
        this.uri = uri
        this.collection = collection;
    }
    
    addDiagnostic(diagnostic: vscode.Diagnostic, line?: string) {
        this.changes = true
        
        if (line) {
            if (this.diagnosticsMap.has(line)) {
                return;
            }
            this.diagnosticsMap.set(line, diagnostic);
        }
        this.diagnostics.push(diagnostic);
    }
    
    getDiagnostic(line: string): vscode.Diagnostic | undefined {
        return this.diagnosticsMap.get(line) || this.oldDiagnosticsMap.get(line);
    }
    
    apply() {
        this.collection.set(this.uri, this.diagnostics);
    }
    
    dispose() {
        this.diagnostics = [];
            
        // Clear swap diagnostics map
        let temp = this.oldDiagnosticsMap;
        temp.clear()
        
        this.oldDiagnosticsMap = this.diagnosticsMap;
        this.diagnosticsMap = temp;
        
        this.changes = false;
    }
}