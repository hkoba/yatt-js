namespace yatt {
  export type Request = {pathInfo?: string} & GoogleAppsScript.Events.DoGet

  export interface Connection {
    request: Request
    append(content: string): GoogleAppsScript.HTML.HtmlOutput
    appendUntrusted(content: string): GoogleAppsScript.HTML.HtmlOutput
  }
}

namespace $yatt {
  export function param(this: yatt.Connection, name: string): string | undefined {
    return this.request.parameter[name]
  }
}
