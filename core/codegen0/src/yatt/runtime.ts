export interface Connection {
  append(str: string): void;
  appendUntrusted(str?: string | number): void;
  appendRuntimeValue(val: any): void;
}

export interface Escapable {
  as_escaped(): string;
}

export function isEscapable(val: any): val is Escapable {
  return val != null
    && typeof val === "object"
    && typeof val['as_escaped'] === "function"
}

export type EscapedString = {
  escaped: string
}

export function asEscapedString(escaped: string): EscapedString {
  return {escaped}
}

export function isEscapedString(val: any): val is EscapedString {
  if (val == null || typeof(val) !== "object") {
    return false
  }
  const escaped = (val as EscapedString).escaped
  return typeof(escaped) === "string"
}

export const escapeMap = {
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "\'": "&#39;",
  "&": "&amp;",
  "-->": "--&gt;", // XXX: For <script>.
}

export function inspect_escape_kind(
  arg: number | EscapedString | Escapable | string | object
): string {
  if (arg == null) {
    return 'null'
  }

  if (typeof arg === "number") {
    return 'number'
  }

  if (isEscapedString(arg)) {
    return 'pre_escaped'
  }

  if (isEscapable(arg)) {
    return 'runtime_escapable'
  }

  if (typeof arg !== "string") {
    return 'json_stringify'
  }

  return 'general_string'
}

export function escape(
  arg: number | EscapedString | Escapable | string | object
): string {
  if (arg == null) {
    return ''
  }

  if (typeof arg === "number") {
    return arg.toString()
  }

  if (isEscapedString(arg)) {
    return arg.escaped
  }

  if (isEscapable(arg)) {
    return arg.as_escaped()
  }

  if (typeof arg !== "string") {
    const str = JSON.stringify(arg);
    return str.replace(/[<\"]|-->/g, (chr: string) =>
      escapeMap[chr as keyof typeof escapeMap]
    );
  }

  return arg.replace(/[<>&\"\']/g, (chr: string) =>
    escapeMap[chr as keyof typeof escapeMap]);
}
