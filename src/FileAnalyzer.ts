import * as vscode from "vscode";
import { ConfigurationName, ExtensionSettings } from "./extension";
import { spawnSync } from "child_process";

export default class FileAnalyzer {
    document: vscode.TextDocument;
    collection: vscode.DiagnosticCollection;
    cwd: string | null;
    
    constructor(document: vscode.TextDocument, collection: vscode.DiagnosticCollection, cwd: string | null) {
        this.document = document;
        this.collection = collection;
        this.cwd = cwd;
    }
    
    executeAnalyzer(args?: string[]): string {
        let stdin = this.document.getText();
        
        args = args || [];
        args.push(
            "--formatter=plain",
            "-"
        )
        
        if (ExtensionSettings.UsesLuauAnalyzeRojo == true) {
            args.push(
                "--stdin-filepath=" + vscode.workspace.asRelativePath(this.document.uri.fsPath),
                "--project=" + ExtensionSettings.RojoProjectPath,
                "--defs=" + ExtensionSettings.TypeDefsPath
            );
        }
        
        let result = spawnSync(ExtensionSettings.AnalyzerCommand, args, {input: stdin, cwd: this.cwd as any});
        if (!result.stdout) {
            vscode.window.showErrorMessage(`${ConfigurationName}: Failed to run analyzer! Command not found: ${ExtensionSettings.AnalyzerCommand}! Consider changing it in the settings.`);
            return ""
        }
        return result.stdout.toString();
    }
    
    createDiagnosticForLine(line: string): vscode.Diagnostic | undefined {
        let match = line.match(/^(.*):(\d*):(\d*-\d*): \(.*\) (\w*): (.*)/);
        if (!match) {
            return;
        }
        
        let lineNumber = parseInt(match[2]) - 1;
        let range = new vscode.Range(
            new vscode.Position(lineNumber, parseInt(match[3].split("-")[0]) - 1),
            new vscode.Position(lineNumber, parseInt(match[3].split("-")[1]))
        )
        
        // Find severity
        let errorName = match[4]
        let severity = vscode.DiagnosticSeverity.Warning;
        
        if (errorName.match(/Error/)) {
            severity = vscode.DiagnosticSeverity.Error;
        } else if (errorName.match(/Unused/)) {
            severity = vscode.DiagnosticSeverity.Information;
        }
        
        // Add error message back to the line
        let message = `${errorName}: ${match[5]}`;
        
        return new vscode.Diagnostic(
            range,
            message,
            severity
        )
    }
    
    runDiagnostics() {
        // Clear old diagnostics
        this.collection.delete(this.document.uri);
        
        let errors = this.executeAnalyzer().split("\n");
        let newDiagnostics: vscode.Diagnostic[] = [];
        
        errors.forEach((line) => {
            let match = line.match(/^(.*):(\d*):(\d*-\d*): \(.*\) (\w*): (.*)/)
            if (!match) {
                return;
            }
            
            let diagnostic = this.createDiagnosticForLine(line);
            if (!diagnostic) { return; }
            
            if (match[1] == "stdin") {
                newDiagnostics.push(diagnostic);
            } else {
                let uri = vscode.Uri.joinPath(vscode.Uri.file(this.cwd || ""), match[1]);
                let collection = this.collection.get(uri) as vscode.Diagnostic[] | undefined;
                if (!diagnostic || !collection) { return; }
                
                // Only add diagnostic if it's not already in the collection
                if (
                    !collection?.find((d) =>
                        d.message == diagnostic!.message
                        && d.range.start.line == diagnostic!.range.start.line
                        && d.range.start.character == diagnostic!.range.start.character
                        && d.range.end.line == diagnostic!.range.end.line
                )) {
                    let newCollection = collection.slice()
                    newCollection.push(diagnostic);
                    this.collection.set(uri, newCollection);
                }
            }            
        })
        
        this.collection.set(this.document.uri, newDiagnostics);
    }
}