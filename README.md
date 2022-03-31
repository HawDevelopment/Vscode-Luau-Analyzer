# Vscode-Luau-Analyzer

Vscode port of [zuex](https://github.com/zeux)'s [SublimeLinter-Luau](https://github.com/zeux/SublimeLinter-luau).

NOTE: You need to have v512 luau-analyzer or greater in your environment path! (Found [here](https://github.com/Roblox/luau/releases/))

[Vscode Marketplace Link](https://marketplace.visualstudio.com/items?itemName=HawDevelopment.vscode-luau-analyzer)

## Use for Roblox

### Method 1

If you're using this extension for roblox development, you should consider creating a [`.luarc`](https://github.com/Roblox/luau/blob/master/rfcs/config-luaurc.md) file in your project root.

Heres a small template:

```json5
{
	"languageMode": "strict", // nocheck, nonstrict, strict
	"lint": {"*": true, "LocalUnused": false},
	"lintErrors": true,
	"globals": [
		"delay",
		"DebuggerManager",
		"elapsedTime",
		"PluginManager",
		"printidentity",
		"settings",
		"spawn",
		"stats",
		"tick",
		"time",
		"UserSettings",
		"version",
		"wait",
		"warn",
		"Enum",
		"game",
		"plugin",
		"shared",
		"script",
		"workspace"
	]
}
```
### Method 2

Download install [JohnnyMorganz](https://github.com/JohnnyMorganz)'s [luau-analyze-rojo](https://github.com/JohnnyMorganz/luau-analyze-rojo).

Go to the extensions settings and change `Use Luau Analyze Rojo` to true. (You might also need to change `Analyzer Command`)

Download the latest global types from [here](https://github.com/JohnnyMorganz/luau-analyze-rojo/blob/master/globalTypes.d.lua). And set the path to it using the `Vscode-Analyzer-Luau: Set Type Definitions Path` command.

If youre going with rojo, then you can use the `Vscode-Analyzer-Luau: Set Rojo Project Path` command.