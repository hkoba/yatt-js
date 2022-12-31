import { LrxmlParams, lrxmlParams, LrxmlConfig } from './config'

import {
  lineNumber, extract_line, extract_prefix_spec, extract_suffix_spec
  , count_newlines
} from './utils/count_lines'

export type Range = {start: number, end: number}
export type RangeLine = {line: number} & Range
export type AnyToken = {kind: string} & RangeLine
export type TokenT<S> = {kind: S} & RangeLine

export function range_text(
  source: string, range: Range,
  startOffset: number = 0, endOffset: number = 0
): string {
  return source.substring(range.start + startOffset, range.end + endOffset)
}

export type ParserSession = {
  filename?: string
  params: LrxmlParams
  source: string
  patterns: {[k: string]: RegExp}
  // parent?: ParserSession
}

export function session_range_text<S extends {source: string}>(session: S, range: Range): string {
  return range_text(session.source, range)
}

type VSCodeRange = {
  startLine: number
  startCharacter: number
  endLine: number
  endCharacter: number
}

export class TokenError extends Error {
  constructor(public token: AnyToken
              & {line: number, column: number}
              & VSCodeRange, message: string) {
    super(message)
  }
}

export type GlobalMatch = {
  match: RegExpExecArray
  lastIndex: number
}

export class ScanningContext<S extends ParserSession> {
  public line: number = 1
  constructor(public session: S,
              public index: number,
              public start: number,
              public end: number,
              public parent?: ScanningContext<S>) {
    if (typeof session.source !== "string") {
      throw new Error("session.source is not a string type!")
    }
  }

  range_of<T extends Range>(data: T, startOffset: number = 0, endOffset: number = 0): Range {
    return {start: data.start + startOffset, end: data.end + endOffset}
  }

  set_range<T extends Range>(range: T): void {
    this.set_start_end(range.start, range.end)
  }
  set_start_end(start: number, end?: number): void {
    this.start = start
    if (end != null) {
      this.end = end;
    }
  }

  range_text(range: Range, startOffset: number = 0, endOffset: number = 0) {
    return range_text(this.session.source, range, startOffset, endOffset)
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
    const [_lastNl, lineNo, colNo] = extract_prefix_spec(this.session.source, index)
    const fileInfo = this.session.filename ? ` at ${this.session.filename}` : ""
    const longMessage = `${message}${fileInfo} line ${lineNo} column ${colNo}`
    throw new Error(longMessage)
  }

  maybe_token_error(
    token: AnyToken | undefined, message: string, options?: {index?: number}
  ): never {
    if (token === undefined)
      this.throw_error(message, options)
    this.token_error(token, message, options)
  }

  token_range(token: RangeLine, endItem?: number | Range): RangeLine {
    let end
    if (endItem == null) {
      end = token.end
    } else if (typeof endItem === 'number') {
      end = endItem
    } else {
      end = endItem.end
    }
    return {line: token.line, start: token.start, end}
  }

  token_error(token: AnyToken, message: string, options?: {index?: number}): never {
    const index = token.start + (options?.index ?? 0);
    const [lastNl, lineNo, colNo] = extract_prefix_spec(this.session.source, index)
    const tokenLine = extract_line(this.session.source, lastNl, colNo)
    const fileInfo = this.session.filename ? ` at ${this.session.filename}` : ""
    const longMessage = `${message} for token ${token.kind}${fileInfo} line ${lineNo} column ${colNo}`

    const [numLines, endCharacter] = extract_suffix_spec(this.session.source, token.start, token.end)
    const startLine = lineNo-1
    const startCharacter = colNo-1;
    const endLine = startLine + numLines
    throw new TokenError({...token, line: lineNo,
                          column: colNo, // XXX: really?
                          startLine, startCharacter,
                          endLine, endCharacter}
                         , longMessage + '\n' + tokenLine)
  }

  NEVER(item?: any): never {
    if (item !== undefined) {
      const json = JSON.stringify(item)
      this.throw_error(`BUG! why reached here: ${json}`)
    } else {
      this.throw_error("BUG! why reached here!")
    }
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
    const debugLevel = this.session.params.debug.lexer ?? 0
    if (debugLevel >= 2) {
      console.log("# match_index regexp: ", re.source)
    }
    const match = re.exec(this.session.source.substring(0, this.end))
    if (debugLevel) {
      console.log("# match: ", trim_input(match))
    }
    return match
  }

  count_newlines(start: number, end: number) {
    return count_newlines(this.session.source.substring(start, end))
  }

  advance(matchOrNum: RegExpExecArray | number) {
    const num = typeof matchOrNum === "number" ?
      matchOrNum :
      matchOrNum[0].length
    this.line += this.count_newlines(this.index, this.index + num)
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

  tab(from: GlobalMatch, to?: RegExpExecArray, morestr?: string): RangeLine {
    const matched = to ? this.matched_range(from, to, morestr) :
      {start: from.match.index, end: from.lastIndex + (morestr ? morestr.length : 0)}
    const end = matched.end
    const line = this.line
    this.line += this.count_newlines(this.index, end)
    this.index = matched.end
    return {line, ...matched}
  }

  tab_match(match: RegExpExecArray, matchIndex: number = 0): RangeLine {
    const start = this.index
    const end = match.index + match[matchIndex].length
    const line = this.line
    this.line += this.count_newlines(start, end)
    this.index = end
    return {line, start, end}
  }

  tab_range(range: Range): RangeLine {
    const end = range.end
    const line = this.line;
    this.line += this.count_newlines(this.index, end)
    this.index = end
    return {line, ...range}
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

  return {source: v.source, filename: v.filename, params: lrxmlParams(v.config), patterns: {}}
}

export function parserContext(v: {source: string, filename?: string, config: LrxmlConfig}): ParserContext {

  return new ParserContext(parserSession(v))
}
