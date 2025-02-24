namespace $yatt.runtime {

  export type Request = {pathInfo?: string} & (
    GoogleAppsScript.Events.DoGet | GoogleAppsScript.Events.DoPost
  )

  export interface Connection {
    request: Request;
    output: GoogleAppsScript.HTML.HtmlOutput;
    append(str: string): void;
    appendUntrusted(str?: string | number): void;
    appendRuntimeValue(val: any): void;
  }
}
