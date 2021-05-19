import { YattParams, yattParams, YattConfig } from './yatt-config'

import { lineNumber } from './utils/count_lines'

export type Range = {start: number, end: number}

export type ParserSession = {
    filename?: string
    params: YattParams
    source: string
    patterns: {[k: string]: RegExp}
}

export type GlobalMatch = {
    match: RegExpExecArray
    lastIndex: number
}

export class ParserContext {
    public debug: number = 0
    constructor(public session: ParserSession,
                public index: number,
                public start: number,
                public end: number,
                public parent?: ParserContext) {
        if (typeof session.source !== "string") {
            throw new Error("session.source is not a string type!")
        }
        if (session.params.debug.parser !== undefined) {
            this.debug = session.params.debug.parser
        }
    }

    range_text(range: Range) {
        return this.session.source.substring(range.start, range.end)
    }

    re(key: string, fn: () => RegExp): RegExp {
        let re = this.session.patterns[key]
        if (! re) {
            re = this.session.patterns[key] = fn()
        }
        return new RegExp(re, re.flags)
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

    narrowed(range: Range): ParserContext {
        let subCtx = new ParserContext(this.session, range.start, range.start, range.end, this)
        subCtx.debug = this.debug
        return subCtx
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

    matched_range(from: GlobalMatch, to: RegExpExecArray): Range {
        const start = from.match.index
        const end = to.index + to[0].length
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

    tab(from: GlobalMatch, to?: RegExpExecArray): Range {
        const matched = to ? this.matched_range(from, to) :
            {start: from.match.index, end: from.lastIndex}
        this.index = matched.end
        return matched
    }
    
    tab_string(str: string, diff?: number) : Range {
        const start = this.index;
        this.index += str.length
        if (diff != null) {
            this.index += diff
        }
        return {start, end: this.index}
    }
    
    tab_match_prefix(globalMatch: GlobalMatch): Range | null {
        if (this.index >= globalMatch.match.index) {
            return null;
        }
        const start = this.index;
        this.index = globalMatch.lastIndex;
        return { start, end: globalMatch.match.index }
    }

    line_number(index: number): number {
        return lineNumber(this.session.source.substring(0, this.index))
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

    NIMPL(): never {
        this.throw_error("Not yet implemented")
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

export function parserContext(v: {source: string, filename?: string, config: YattConfig}): ParserContext {
    
    const session = {source: v.source, filename: v.filename, params: yattParams(v.config), patterns: {}}
    
    return new ParserContext(session, 0, 0, session.source.length)
}

