// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

const LANG_ID = 'yatt-js'
const COMMAND_ID = `${LANG_ID}.lint`
const ACTION_ID = 'editor.codeActionsOnSave'

let handler

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  handler = new RunOnSave;

  console.log('Congratulations, extension "yatt-js" is now active!');

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(LANG_ID, handler, {
      providedCodeActionKinds: RunOnSave.providedCodeActionKinds
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_ID, handler.handle.bind(handler))
  )

  const config = vscode.workspace.getConfiguration(ACTION_ID)
  if (config) {
    console.log(`Found ${ACTION_ID}: `, config)
    config.update(COMMAND_ID, true)
  } else {
    console.log(`Not found: ${ACTION_ID}`)
  }
}

// this method is called when your extension is deactivated
export function deactivate() {}

export class RunOnSave implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.Source
  ]

  public handle() {
    const editor = vscode.window.activeTextEditor
    if (editor != null) {
      console.log(`curdoc: `, editor.document.getText())
    }
  }

  public provideCodeActions(document: vscode.TextDocument, range: vscode.Range)
  : vscode.CodeAction[] | undefined {
    console.log(`Provider is called`)
    return;
  }
}
