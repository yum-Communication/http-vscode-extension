import * as vscode from 'vscode';

/**
 * CodelensProvider
 */
export class CodelensProvider implements vscode.CodeLensProvider {

    private codeLenses: vscode.CodeLens[] = [];
    private regex1: RegExp;
    private regex2: RegExp;
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor() {
        this.regex1 = /^(GET|HEAD|POST|PUT|DELETE|CONNECT|OPTIONS|TRACE|PATCH)/;
        this.regex2 = /^----+/;

        vscode.workspace.onDidChangeConfiguration((_) => {
            this._onDidChangeCodeLenses.fire();
        });
    }

    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {

        this.codeLenses = [];

        let requestInit = false;
        const x = this.regex1;
        const y = this.regex2;
        const z = document.lineCount;
        for(let i=0; i<z; ++i) {
            const line = document.lineAt(i);
            const t = line.text;
            if(requestInit) {
                const m = y.exec(t);
                if(m !== null) {
                    requestInit = false;
                }
            } else {
                const m = x.exec(t);
                if(m !== null) {
                    const st = new vscode.Position(line.lineNumber, 0);
                    const ed = new vscode.Position(line.lineNumber, m[0].length);
                    const rng = new vscode.Range(st, ed);
                    this.codeLenses.push(new vscode.CodeLens(rng));
                }
                requestInit = true;
            }
        }
        return this.codeLenses;
    }

    public resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) {
        codeLens.command = {
            title: "Send request",
            tooltip: "Send request",
            command: "HttpClient.sendRequestOne",
            arguments: [codeLens.range.start.line]
        };
        return codeLens;
    }
}

