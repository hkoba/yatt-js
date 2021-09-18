// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import * as cgen from 'yatt-codegen0'
import {TokenError} from 'lrxml-js'

const LANG_ID = 'yatt-js'
const COMMAND_ID = `${LANG_ID}.lint`

export function activate(context: vscode.ExtensionContext) {

  console.log('Congratulations, extension "yatt-js" is now active!');

  const handler = (event: vscode.TextDocumentWillSaveEvent) => {
    try {
      const source = event.document.getText()
      const output = cgen.generate_module(source, {filename: event.document.fileName})
      console.log(`transpiled: `, output.outputText)
    } catch (err) {
      // XXX: rejected promise not handled within 1 second: Error: Unexpected type
      // Why?
      event.waitUntil((async () => {
        console.log(`error: `, err)
        if (err instanceof TokenError) {
          console.log(`line ${err.token.line} col ${err.token.column}`)
          const pos = new vscode.Position(err.token.line - 1, err.token.column - 1)
          vscode.window.activeTextEditor!.selection = new vscode.Selection(pos, pos)
        }
        if (err instanceof Error) {
          vscode.window.showErrorMessage(err.message)
        }
      })())
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
