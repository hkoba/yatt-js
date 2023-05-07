#!/usr/bin/env ts-node

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

  // XXX: extend this to complex runtime types
  export function escape(str: string): string {
    return str.replace(/[<>&\"\']/g, (chr: string) =>
                       escapeMap[chr as keyof typeof escapeMap]);
  }

  export type SubItemType = {kind: 'page'|'action', name: string}

  export function extract_sigil_from(
    query: {[k: string]: any}
  ): SubItemType | undefined {
    const res = validate_request_sigils(collect_request_sigils_from(query))
    if (typeof res === 'string')
      throw new Error(res)
    return res
  }

  export function collect_request_sigils_from(
    query: {[k: string]: any}
  ): {[k: string]: string[]} {
    const result: {[k: string]: string[]} = {}
    for (const [k, value] of Object.entries(query)) {
      const match = /^([~!])(\1|\w+)$/.exec(k)
      if (! match) continue
      delete query[k]
      const [_, sigil, word] = match
      if (result[sigil] == null)
        result[sigil] = []
      result[sigil].push(sigil === word ? value : word)
    }
    return result
  }

  export function validate_request_sigils(
    sigils: {[k: string]: string[]}
  ): SubItemType | string | undefined {
    const subpages = sigils['~']
    if (subpages && subpages.length >= 2) {
      return `Multiple subpage sigils in request!: ${subpages}`
    }
    const actions  = sigils['!']
    if (actions && actions.length >= 2) {
      return `Multiple action sigils in request!: ${actions}`
    }
    const subpage = subpages ? subpages[0] : undefined
    const action = actions ? actions[0] : undefined
    if (subpage != null && action != null) {
      return `Can\'t use subpage and action at one time: ${subpage} vs ${action}`
    } else if (subpage != null) {
      return {kind: 'page', name: subpage}
    } else if (action != null) {
      return {kind: 'action', name: action}
    } else {
      return undefined
    }
  }
}
