// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import * as cgen from 'yatt-codegen0'
import {TokenError} from 'lrxml-js'

const LANG_ID = 'yatt-js'
const COMMAND_ID = `${LANG_ID}.lint`

export function activate(context: vscode.ExtensionContext) {

  console.log('Congratulations, extension "yatt-js" is now active!');

  const diagSet = vscode.languages.createDiagnosticCollection(COMMAND_ID)

  const handler = (event: vscode.TextDocumentWillSaveEvent) => {

    if (event.reason !== vscode.TextDocumentSaveReason.Manual)
      return;

    try {
      const source = event.document.getText()
      let _ = cgen.generate_module(source, {filename: event.document.fileName})
      diagSet.set(event.document.uri, [])

    } catch (err) {
      if (err instanceof Error) {
        console.log(`error: `, err.message)
      }
      if (err instanceof TokenError && vscode.window.activeTextEditor != null) {
        console.log(`line ${err.token.line} col ${err.token.column}`)
        const {startLine, startCharacter, endLine, endCharacter} = err.token
        const range = new vscode.Range(startLine, startCharacter, endLine, endCharacter)
        vscode.window.activeTextEditor.selection = new vscode.Selection(range.start, range.start)
        const diag = new vscode.Diagnostic(range, err.message, vscode.DiagnosticSeverity.Error)
        diagSet.set(event.document.uri, [diag])
      }
    }
  }

  context.subscriptions.push(
    vscode.workspace.onWillSaveTextDocument(handler)
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_ID, handler)
  )
}

// this method is called when your extension is deactivated
export function deactivate() {}
