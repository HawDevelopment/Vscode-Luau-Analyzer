import * as vscode from "vscode";

let collection: vscode.DiagnosticCollection;

function getWorkspacePath(): string | null {
	let folders = vscode.workspace.workspaceFolders;
	if (folders) {
		return folders[0].uri.fsPath;
	}
	return null;
}

export function activate(context: vscode.ExtensionContext) {
	collection = vscode.languages.createDiagnosticCollection("luau");
	context.subscriptions.push(collection);

	if (vscode.window.activeTextEditor) {
		updateDiagnostics(vscode.window.activeTextEditor.document, collection, getWorkspacePath());
	}

	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument((document) => {
			updateDiagnostics(document, collection, getWorkspacePath());
		})
	);
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((event) => {
			updateDiagnostics(event.document, collection, getWorkspacePath());
		})
	);
}

// Define an execute function
import {spawnSync} from "child_process";
function executeIn(stdin: string, cwd: string | null): string {
	let result = spawnSync("luau-analyze", ["--formatter=plain", "-"], {input: stdin, cwd: cwd as any});

	return result.stdout.toString();
}

function updateDiagnostics(document: vscode.TextDocument, collection: vscode.DiagnosticCollection, cwd: string | null): void {
	let path = document.uri.fsPath;

	if (document && (path.endsWith(".lua") || path.endsWith(".luau"))) {
		let errors = executeIn(document.getText(), cwd);
		console.log(errors);
		let split = errors.split("\n");

		collection.delete(document.uri);
		let diagnostics: vscode.Diagnostic[] = [];

		split.forEach((line) => {
			let match = line.match(/^(.*):(\d*):(\d*-\d*): \(.*\) (\w*): (.*)/);
			if (!match || match[1] !== "stdin") {
				return;
			}

			let lineNumber = parseInt(match[2]) - 1;
			let range1 = parseInt(match[3].split("-")[0]);
			let range2 = parseInt(match[3].split("-")[1]);

			let severity = vscode.DiagnosticSeverity.Warning;

			if (match[4].match(/Error/)) {
				severity = vscode.DiagnosticSeverity.Error;
			} else if (match[4].match(/Unused/)) {
				severity = vscode.DiagnosticSeverity.Information;
			}

			let lineDiagnostic = new vscode.Diagnostic(
				new vscode.Range(new vscode.Position(lineNumber, range1 - 1), new vscode.Position(lineNumber, range2)),
				match[5] + (match[5].endsWith(".") ? "." : ""),
				severity
			);

			diagnostics.push(lineDiagnostic);
		});

		collection.set(document.uri, diagnostics);
	} else {
		collection.clear();
	}
}

export function deactivate() {}
