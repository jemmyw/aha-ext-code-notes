// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { AhaApi, CodeNote } from "./aha";

const SECRETS = {
  SUBDOMAIN: "aha-subdomain",
  TOKEN: "aha-token",
};

let decorationDisposables: vscode.Disposable[] = [];
let extensionDisposables: vscode.Disposable[] = [];
let decorationType: vscode.TextEditorDecorationType;

function getDomain(): string {
  return (
    vscode.workspace.getConfiguration("codeNotes").get("domain") || ".aha.io"
  );
}

function getPollTimeout(): number {
  return 10000;
}

function disposeDecorations() {
  decorationDisposables.forEach((d) => d.dispose());
  decorationDisposables = [];
}

function disposeExtension() {
  extensionDisposables.forEach((d) => d.dispose());
  extensionDisposables = [];
}

function ahaLink(domain: string, subdomain: string, note: CodeNote) {
  const path = [note.recordType.toLowerCase() + "s", note.referenceNum].join(
    "/"
  );
  return `https://${subdomain}${domain}/${path}`;
}

function decorate(domain: string, subdomain: string, notes: CodeNote[]) {
  return (editor: vscode.TextEditor) => {
    const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (!folder) return;
    const options: vscode.DecorationOptions[] = [];

    notes.forEach((note) => {
      const fullPath = vscode.Uri.joinPath(folder.uri, ...note.path);
      if (fullPath.fsPath !== editor.document.uri.fsPath) return;

      const range = note.line
        ? new vscode.Range(note.line[0] - 1, 0, note.line[0] - 1, 0)
        : new vscode.Range(0, 0, 0, 0);

      options.push({
        range,
        hoverMessage: new vscode.MarkdownString(
          `[${note.referenceNum}](${ahaLink(domain, subdomain, note)})`
        ),
        renderOptions: {},
      });
    });

    editor.setDecorations(decorationType, []);
    editor.setDecorations(decorationType, options);
  };
}

let pollTimer: NodeJS.Timeout;
async function startDecorating(context: vscode.ExtensionContext, api: AhaApi) {
  // Remove existing listeners
  disposeDecorations();
  const subdomain = await context.secrets.get(SECRETS.SUBDOMAIN);
  if (!subdomain) return;

  const notes = await api.fetchNotes();
  const decorator = decorate(getDomain(), subdomain, notes);

  decorationDisposables.push(
    vscode.window.onDidChangeActiveTextEditor((event) => {
      if (event) {
        decorator(event);
      }
    })
  );

  if (vscode.window.activeTextEditor) {
    decorator(vscode.window.activeTextEditor);
  }

  pollTimer = setTimeout(() => startDecorating(context, api), getPollTimeout());
  decorationDisposables.push(
    new vscode.Disposable(() => clearTimeout(pollTimer))
  );
}

function requestSubdomain() {
  return vscode.window.showInputBox({ title: "Aha! domain", prompt: "domain" });
}

function requestToken() {
  return vscode.window.showInputBox({
    password: true,
    title: "Aha! access token",
    prompt: "Token",
  });
}

function secretOr(
  context: vscode.ExtensionContext,
  name: string,
  fn: () => Thenable<string | undefined>,
  errorMessage: string
) {
  return new Promise<string>((resolve, reject) => {
    context.secrets.get(name).then((value) => {
      if (!value) {
        fn().then((value) => {
          if (value) {
            context.secrets.store(name, value).then(() => resolve(value));
          } else {
            vscode.window.showInformationMessage(errorMessage);
            reject(errorMessage);
          }
        });
      } else {
        resolve(value);
      }
    });
  });
}

async function canStart(context: vscode.ExtensionContext) {
  const subdomain = await context.secrets.get(SECRETS.SUBDOMAIN);
  const token = await context.secrets.get(SECRETS.TOKEN);
  return subdomain && token;
}

async function getApi(context: vscode.ExtensionContext) {
  const subdomain = await secretOr(
    context,
    SECRETS.SUBDOMAIN,
    requestSubdomain,
    "No Aha! domain provided"
  );
  const token = await secretOr(
    context,
    SECRETS.TOKEN,
    requestToken,
    "No Aha! token provided"
  );
  return new AhaApi(subdomain, token, getDomain());
}

async function start(context: vscode.ExtensionContext) {
  try {
    const api = await getApi(context);
    try {
      startDecorating(context, api);
    } catch (err) {
      vscode.window.showErrorMessage("Unable to start code notes", err as any);
    }
  } catch (err) {
    // Ignore if API could not be created
  }
}

async function startIfCan(context: vscode.ExtensionContext) {
  if (await canStart(context)) return start(context);
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  decorationType = vscode.window.createTextEditorDecorationType({
    gutterIconPath: vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      "comment.svg"
    ),
    gutterIconSize: "contain",
    rangeBehavior: vscode.DecorationRangeBehavior.OpenOpen,
    isWholeLine: true,
  });

  vscode.commands.registerCommand("code-notes.set-token", async () => {
    const token = await requestToken();
    if (!token) return;
    await context.secrets.store(SECRETS.TOKEN, token);
    startIfCan(context);
  });

  vscode.commands.registerCommand("code-notes.set-subdomain", async () => {
    const subdomain = await requestSubdomain();
    if (!subdomain) return;
    await context.secrets.store(SECRETS.SUBDOMAIN, subdomain);
    startIfCan(context);
  });

  startIfCan(context);
}

// this method is called when your extension is deactivated
export function deactivate() {
  disposeDecorations();
  disposeExtension();
}
