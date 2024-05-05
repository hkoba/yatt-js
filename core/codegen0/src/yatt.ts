export namespace yatt {}

export namespace yatt.runtime {
  export interface Connection {
    append(str: string): void;
    appendUntrusted(str?: string | number): void;
  }

  const escapeMap = {
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "\'": "&#39;",
    "&": "&amp;",
    // "-->": "--&gt;", // XXX: For <script>. Not used now.
  }

  export function escape(arg: string | number | Object): string {
    if (typeof arg === "number") {
      return arg.toString()
    }
    const str = typeof arg === "string" ? arg : JSON.stringify(arg);

    if (str.replace == null) {
      throw new Error(`Unknown argument to escape: ${arg}`)
    }

    return str.replace(/[<>&\"\']/g, (chr: string) =>
      escapeMap[chr as keyof typeof escapeMap]);
  }
}
