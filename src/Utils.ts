import * as vscode from 'vscode';
import * as fs from 'fs';
import { ExtensionContext, ConfigurationName } from './extension';

export async function pickFilePath(name: string, extension: string): Promise<string | undefined> {
    let files: { label: string, description: string, path: string }[] = [];
    
    vscode.workspace.workspaceFolders?.forEach((folder) => {
        let filesPaths = fs.readdirSync(folder.uri.fsPath).filter((file) => file.endsWith(extension));
        
        filesPaths.forEach((file) => {
            files.push({
                label: file,
                description: folder.uri.fsPath,
                path: folder.uri.fsPath + "/" + file
            });
        });
    })
    
    if (files.length === 0) {
        vscode.window.showErrorMessage(`No ${name} files found!`);
        return undefined;
    }
    
    return vscode.window.showQuickPick(files).then((file) => {
        if (file) {
            return file.path;
        }
        return undefined;
    });
}

async function getFilePath(name: string, extension: string, stateName: string) {
    let folders = vscode.workspace.workspaceFolders;
    if (!folders) {
        return;
    }
    
    let lastFilePath: string | undefined = ExtensionContext.workspaceState.get(stateName);
    if (lastFilePath) {
        if (fs.existsSync(lastFilePath)) {
            return vscode.workspace.asRelativePath(lastFilePath);
        } else {
            vscode.window.showInformationMessage(`Last ${name} file does *not* exist!`);
            ExtensionContext.workspaceState.update(stateName, undefined);
        }
    }
    
    let path = await pickFilePath(name, extension);
    if (path) {
        ExtensionContext.workspaceState.update(stateName, path);
        return path;
    }
}

export async function getRojoProjectPath(): Promise<string | undefined> {
    return getFilePath("rojo project", ".project.json", "rojoLastPath");
}

export async function getTypeDefsPath(): Promise<string | undefined> {
    return getFilePath("type definitions", ".d.lua", "typeDefsLastPath");
}
