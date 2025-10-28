import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient | undefined;

function pickBundledServer(context: vscode.ExtensionContext): string | null {
	const override = vscode.workspace
		.getConfiguration("dslLsp")
		.get<string>("serverPath");
	if (override && override.trim().length > 0) return override;

	const platform = process.platform; // 'darwin' | 'linux' | 'win32'
	const arch = process.arch; // 'arm64' | 'x64' | ...
	const exe = platform === "win32" ? "dsl-lsp.exe" : "dsl-lsp";

	let candidates: string[] = [];

	if (platform === "darwin") {
		if (arch !== "arm64") {
			vscode.window.showWarningMessage(
				"Relog-ASM DSL: bundled macOS binary is arm64 only. " +
					"Install ARM64 VS Code or set 'dslLsp.serverPath' to your own binary."
			);
		}
		candidates = ["darwin-arm64"];
	} else if (platform === "win32") {
		candidates = ["win32-x64"];
	} else if (platform === "linux") {
		if (arch === "x64") {
			candidates = ["linux-x64-musl"];
		} else {
			vscode.window.showWarningMessage(
				`Relog-ASM DSL: no bundled binary for Linux '${arch}'. ` +
					`Set 'dslLsp.serverPath' to your binary or ensure 'dsl-lsp' is in PATH.`
			);
			return null;
		}
	} else {
		return null;
	}

	for (const folder of candidates) {
		const p = path.join(context.extensionPath, "server", "bin", folder, exe);
		if (fs.existsSync(p)) {
			try {
				if (platform !== "win32") fs.chmodSync(p, 0o755);
			} catch {
				// ignore
			}
			return p;
		}
	}

	vscode.window.showWarningMessage(
		`Relog-ASM DSL: bundled binary not found for [${candidates.join(", ")}]. ` +
			`Will try PATH. You can set 'dslLsp.serverPath' to an explicit binary.`
	);
	return null;
}

function isExecutable(p: string): boolean {
	if (process.platform === "win32") {
		return fs.existsSync(p);
	}
	try {
		fs.accessSync(p, fs.constants.X_OK);
		return true;
	} catch {
		return false;
	}
}

export function activate(context: vscode.ExtensionContext) {
	const output = vscode.window.createOutputChannel("Relog-ASM DSL");
	const trace = vscode.window.createOutputChannel("Relog-ASM DSL Trace");

	const bundled = pickBundledServer(context);
	const serverBinary = bundled ?? "dsl-lsp";

	output.appendLine(
		`[activate] platform=${process.platform}, arch=${process.arch}`
	);
	output.appendLine(
		`[activate] serverBinary=${serverBinary}${
			bundled ? " (bundled)" : " (PATH)"
		}`
	);

	if (bundled && !isExecutable(bundled)) {
		vscode.window.showErrorMessage(
			`dsl-lsp is not executable: ${bundled}. On macOS, run: xattr -d com.apple.quarantine "${bundled}" && chmod +x "${bundled}"`
		);
	}

	const serverOptions: ServerOptions = {
		run: { command: serverBinary, transport: TransportKind.stdio },
		debug: { command: serverBinary, transport: TransportKind.stdio },
	};

	const clientOptions: LanguageClientOptions = {
		documentSelector: [
			{ language: "relog-asm", scheme: "file" },
			{ language: "relog-asm", scheme: "untitled" },
		],
		synchronize: {
			fileEvents: vscode.workspace.createFileSystemWatcher("**/*.rasm"),
		},
		outputChannel: output,
		outputChannelName: "Relog-ASM DSL",
		traceOutputChannel: trace,
	};

	client = new LanguageClient(
		"relog-asm-dsl",
		"Relog-ASM DSL",
		serverOptions,
		clientOptions
	);

	client.onDidChangeState((e) => {
		output.appendLine(`[state] ${e.oldState} -> ${e.newState}`);
	});

	client.start().then(
		() => output.appendLine("[client] started"),
		(err) => {
			output.appendLine(`[client] failed to start: ${String(err)}`);
			vscode.window.showErrorMessage(`Failed to start dsl-lsp: ${String(err)}`);
		}
	);

	context.subscriptions.push(client, output, trace);
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) return undefined;
	return client.stop();
}
