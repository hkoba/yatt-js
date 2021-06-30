import { LrxmlParams, lrxmlParams, LrxmlConfig } from './config'

import { lineNumber } from './utils/count_lines'

export type Range = {start: number, end: number}

export function range_text(source: string, range: Range): string {
  return source.substring(range.start, range.end)
}

export class ParserSession {
  public patterns: {[k: string]: RegExp} = {}
  constructor(
    public readonly source: string,
    public params: LrxmlParams,
    public filename?: string
    // public parent?: ParserSession
  ) { }

  range_text(range: Range) {
    return range_text(this.source, range);
  }
}

export type GlobalMatch = {
  match: RegExpExecArray
  lastIndex: number
}

export class ScanningContext<S extends ParserSession> {
  constructor(public session: S,
              public index: number,
              public start: number,
              public end: number,
              public parent?: ScanningContext<S>) {
    if (typeof session.source !== "string") {
      throw new Error("session.source is not a string type!")
    }
  }

  range_text(range: Range) {
    return this.session.range_text(range)
  }

  empty(): boolean {
    return this.end <= this.index
  }

  rest_range(): Range | null {
    if (this.end <= this.index) {
      return null
    }
    return {start: this.index, end: this.end}
  }

  rest_string(): string {
    return this.session.source.substring(this.index, this.end)
  }

  rest_line(num: number = 1): string {
    return this.rest_string().split(/\r?\n/).slice(0, num).join("\n")
  }

  line_number(index?: number): number {
    return lineNumber(this.session.source.substring(0, index ?? this.index))
  }

  throw_error(message: string, options?: {index?: number}): never {
    const index = this.start + (options?.index ?? this.index);
    const prefix = this.session.source.substring(0, index)
    const lastNl = prefix.lastIndexOf('\n')
    const lineNo = lineNumber(prefix)
    const colNo = index - lastNl
    const fileInfo = this.session.filename ? ` at ${this.session.filename}` : ""
    const longMessage = `${message}${fileInfo} line ${lineNo} column ${colNo}`
    throw new Error(longMessage)
  }

  NEVER(): never {
    this.throw_error("BUG! why reached here!")
  }

  NIMPL(item?: any): never {
    if (item !== undefined) {
      const json = JSON.stringify(item)
      this.throw_error(`Unhandled element: ${json}`)
    } else {
      this.throw_error("Not yet implemented")
    }
  }
}

export class ParserContext extends ScanningContext<ParserSession> {
  public debug: number = 0
  constructor(session: ParserSession,
              index: number = 0,
              start: number = 0,
              end: number = session.source.length,
              parent?: ParserContext) {
    super(session, index, start, end, parent)
    if (session.params.debug.parser !== undefined) {
      this.debug = session.params.debug.parser
    }
  }

  narrowed(range: Range): ParserContext {
    let subCtx = new ParserContext(this.session, range.start, range.start, range.end, this)
    subCtx.debug = this.debug
    return subCtx
  }

  re(key: string, fn: () => RegExp): RegExp {
    let re = this.session.patterns[key]
    if (! re) {
      re = this.session.patterns[key] = fn()
    }
    return new RegExp(re, re.flags)
  }

  global_match(re: RegExp): GlobalMatch | null {
    if (re.flags.indexOf('g') < 0) {
      throw new Error("BUG: regexp for global_match should have g flag")
    }
    const match = this._match(re)
    if (match == null) {
      return null
    }
    return {lastIndex: re.lastIndex, match}
  }

  match_index(re: RegExp): RegExpExecArray | null {
    if (re.flags.indexOf('y') < 0) {
      throw new Error("BUG: regexp for match_index should have y flag")
    }
    return this._match(re)
  }

  _match(re: RegExp): RegExpExecArray | null {
    re.lastIndex = this.index
    if (this.debug >= 2) {
      console.log("# match_index regexp: ", re.source)
    }
    const match = re.exec(this.session.source.substring(0, this.end))
    if (this.debug) {
      console.log("# match: ", trim_input(match))
    }
    return match
  }

  advance(matchOrNum: RegExpExecArray | number) {
    const num = typeof matchOrNum === "number" ?
      matchOrNum :
      matchOrNum[0].length
    this.index += num
  }

  matched_range(from: GlobalMatch, to: RegExpExecArray, morestr?: string): Range {
    const start = from.match.index
    const end = to.index + to[0].length + (morestr ? morestr.length : 0)
    return {start, end}
  }

  contained_string_range(from: GlobalMatch, str: string | undefined): Range | undefined {
    if (str == null) {
      return undefined
    }
    const start = from.lastIndex
    const end = start + str.length
    return {start, end}
  }

  tab(from: GlobalMatch, to?: RegExpExecArray, morestr?: string): Range {
    const matched = to ? this.matched_range(from, to, morestr) :
      {start: from.match.index, end: from.lastIndex + (morestr ? morestr.length : 0)}
    this.index = matched.end
    return matched
  }

  tab_match(match: RegExpExecArray): Range {
    const start = this.index
    this.index += match[0].length
    return {start, end: this.index}
  }
  
  tab_string(str: string, diff?: number) : Range {
    const start = this.index;
    this.index += str.length
    if (diff != null) {
      this.index += diff
    }
    return {start, end: this.index}
  }
  
  prefix_of(globalMatch: GlobalMatch): Range | null {
    if (this.index >= globalMatch.match.index) {
      return null;
    }
    const start = this.index;
    return { start, end: globalMatch.match.index }
  }
}

function trim_input(match: RegExpExecArray | null) {
  if (match == null) {
    return null
  }
  let obj: any = {}
  for (const [k, v] of Object.entries(match)) {
    if (k === "input") continue
    obj[k] = v;
  }
  return obj
}

export function parserSession(v: {source: string, filename?: string, config: LrxmlConfig}) : ParserSession {

  return new ParserSession(v.source, lrxmlParams(v.config), v.filename)
}

export function parserContext(v: {source: string, filename?: string, config: LrxmlConfig}): ParserContext {

  return new ParserContext(parserSession(v))
}
