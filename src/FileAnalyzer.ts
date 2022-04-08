import * as vscode from "vscode";
import { ConfigurationName, Extension, ExtensionSettings } from "./extension";
import { spawnSync } from "child_process";
import { DiagnosticCollection } from "./DiagnosticCollection";


export default class FileAnalyzer {
    document: vscode.TextDocument;
    collection: DiagnosticCollection;
    args: string[];
    cwd: string | null;
    
    constructor(document: vscode.TextDocument, collection: DiagnosticCollection, cwd: string | null) {
        this.document = document;
        this.collection = collection;
        this.cwd = cwd;
        this.args = this.rebuildArgs();
    }
    
    rebuildArgs() {
        let args = [];

        if (ExtensionSettings.ReadFilesystemOnly) {
            if (ExtensionSettings.UsesLuauAnalyzeRojo == true) {
                args.push(
                    "--project=" + ExtensionSettings.RojoProjectPath,
                    "--defs=" + ExtensionSettings.TypeDefsPath,
                    "--exclude-virtual-path"
                );
            }
             
            args.push("--formatter=plain", vscode.workspace.asRelativePath(this.document.uri.fsPath))   
        } else {
            if (ExtensionSettings.UsesLuauAnalyzeRojo == true) {
                args.push(
                    "--stdin-filepath=" + vscode.workspace.asRelativePath(this.document.uri.fsPath),
                    "--project=" + ExtensionSettings.RojoProjectPath,
                    "--defs=" + ExtensionSettings.TypeDefsPath,
                    "--exclude-virtual-path"
                );
            }

            args.push("--formatter=plain", "-")
        }

        this.args = args
        return args;
    }
    
    executeAnalyzer(args?: string[]): string {
        args = args ? this.args.concat(args) : this.args;
                
        let result = spawnSync(ExtensionSettings.AnalyzerCommand, args, {
            input: ExtensionSettings.ReadFilesystemOnly ? undefined : this.document.getText(),
            cwd: this.cwd as any,
        });
        if (!result.stdout) {
            vscode.window.showErrorMessage(`${ConfigurationName}: Failed to run analyzer! Command not found: ${ExtensionSettings.AnalyzerCommand}! Consider changing it in the settings.`);
            return ""
        }

        return result.stdout.toString();
    }
    
    createDiagnosticForLine(match?: RegExpMatchArray): vscode.Diagnostic | undefined {
        if (!match) { return; }
        
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
        let errors = this.executeAnalyzer();

        let lineRegex = /^(.*):(\d*):(\d*-\d*): \(.*\) (\w*): (.*(?:\r?\ncaused by:\r?\n(?:  .+)+)*)/mg;
        // This makes use of two features to grab each line plus, in some cases,
        // following lines:
        // * The `m` multiline flag: this is used to make `^` count as the start
        //   of a new line.
        // * The `g` global flag: this is used to make exec return a new match
        //   every time it's called. RegExp objects hold internal state
        //   referring to the last char index exec matched on, allowing us to call
        //   exec repeatedly to get every match in the string.

        let match: RegExpExecArray | null;
        while ((match = lineRegex.exec(errors))) {
            
            let diagnostic = this.createDiagnosticForLine(match);
            if (!diagnostic) { return; }

            let expectedFile = ExtensionSettings.ReadFilesystemOnly ? vscode.workspace.asRelativePath(this.document.uri.fsPath) : "stdin";

            if (match[1] == expectedFile) {
                this.collection.addDiagnostic(diagnostic, match[0]);
            } else {
                let uri = vscode.Uri.joinPath(vscode.Uri.file(this.cwd || ""), match[1]);
                let collection = Extension.getOrCreateDiagnosticCollection(uri);
                
                // If the uri is ignored, don't add the diagnostic
                if (!collection) { continue; }
                
                // Only add diagnostic if it's not already in the collection
                if (collection.getDiagnostic(match[0]) == undefined) {
                    collection.addDiagnostic(diagnostic, match[0]);
                }
            }            
        }
    }
}