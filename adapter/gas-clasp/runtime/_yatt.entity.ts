namespace $yatt {
  export function param(this: $yatt.runtime.Connection, name: string): string | undefined {
    return this.request.parameter[name]
  }

  export function getUrl(): string {
    return ScriptApp.getService().getUrl()
  }

  export function sheetNames(): string[] {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    return book.getSheets().map((s) => s.getSheetName())
  }

  export function getSSName(): string {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    return book.getName()
  }
}
