## Install

Grab latest version from [release](https://github.com/relogrun/relog-asm-vscode/releases/latest):

Unzip.

Install:
  
```bash
code --install-extension relog-asm-dsl-x.x.x.vsix
```

## Build from repo

Update `dsl-lsp` bins.

Install deps:

```bash
rm -rf node_modules package-lock.json
npm i
npm i -g @vscode/vsce
```

Build:

```bash
npm run compile  
vsce package     
```

Install:

```bash
code --install-extension relog-asm-dsl-x.x.x.vsix
```
