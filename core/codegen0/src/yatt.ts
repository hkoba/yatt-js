#!/usr/bin/env ts-node

export namespace yatt {}

export namespace yatt.runtime {
  export interface Connection {
    append(str: string): void;
    appendUntrusted(str?: string): void;
  }

  const escapeMap = {
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "\'": "&#39;",
    "&": "&amp;",
    // "-->": "--&gt;", // XXX: For <script>. Not used now.
  }

  // XXX: extend this to complex runtime types
  export function escape(str: string): string {
    return str.replace(/[<>&\"\']/g, (chr: string) =>
                       escapeMap[chr as keyof typeof escapeMap]);
  }
}
