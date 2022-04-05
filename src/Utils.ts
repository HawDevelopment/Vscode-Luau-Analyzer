import * as vscode from 'vscode';
import * as https from 'https';
import { TextEncoder } from "util";
import { ConfigurationName, ExtensionSettings } from './extension';

const TYPES_INSTALL_URL = "https://raw.githubusercontent.com/JohnnyMorganz/luau-analyze-rojo/master/globalTypes.d.lua"

export async function installTypes() {
    let activeFolders = vscode.workspace.workspaceFolders;
    if (!activeFolders) {
        vscode.window.showErrorMessage(`${ConfigurationName}: No workspace folder found!`);
        return;
    }
    
    // I know this looks painful, but it prevents a 3rd party module install.
    new Promise(() => {
        https.get(TYPES_INSTALL_URL, (resp) => {
            let data = '';
            resp.on('data', (chunk) => {
                data += chunk;
            });
            resp.on('end', () => {
                vscode.workspace.fs.writeFile(
                    vscode.Uri.joinPath(
                        activeFolders![0].uri,
                        ExtensionSettings.TypeDefsPath
                    ),
                    new TextEncoder().encode(data)
                );
            });
        }).on("error", (err) => {
            throw new Error(err.message)
        });
    })
        .then(() => vscode.window.showInformationMessage(`${ConfigurationName}: Successfully downloaded types!`))
        .catch((err) => vscode.window.showErrorMessage(`${ConfigurationName}: Failed to download types: ${err.message}`));
    
    
}