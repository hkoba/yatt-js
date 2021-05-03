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
        if (this.session.source.length <= this.index) {
            return null
        }
        return {start: this.index, end: this.session.source.length}
    }

    rest_string(): string {
        return this.session.source.substring(this.start + this.index, this.end)
    }
    
    rest_line(num: number = 1): string {
        return this.rest_string().split(/\r?\n/).slice(0, num).join("\n")
    }

    narrowed(range: Range): ParserContext {
        let subCtx = new ParserContext(this.session, 0, range.start, range.end, this)
        subCtx.debug = this.debug
        return subCtx
    }

    global_match(re: RegExp): GlobalMatch | null {
        re.lastIndex = this.index
        const match = re.exec(this.session.source)
        if (this.debug) {
            console.log("# globalMatch: ", trim_input(match))
        }
        if (! match)
            return null
        return {match: match, lastIndex: re.lastIndex}
    }
    
    match_index(re: RegExp): RegExpExecArray | null {
        if (re.flags.indexOf('y') < 0) {
            throw new Error("BUG: regexp for match_index should have y flag")
        }
        re.lastIndex = this.index
        if (this.debug >= 2) {
            console.log("# match_index regexp: ", re.source)
        }
        const match = re.exec(this.session.source)
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
        const end = this.index + to.index + to[0].length
        return {start, end}
    }

    contained_range(from: GlobalMatch, to: RegExpExecArray): Range {
        const start = from.lastIndex
        const end = this.index + to.index
        return {start, end}
    }

    tab(from: GlobalMatch, to?: RegExpExecArray): Range {
        const matched = to ? this.matched_range(from, to) :
            {start: from.match.index, end: from.lastIndex}
        this.index = matched.end
        return matched
    }
    
    tab_string(str: string) {
        this.index += str.length
    }
    
    tab_match_prefix(globalMatch: GlobalMatch): Range | null {
        if (this.index >= globalMatch.match.index) {
            return null;
        }
        const start = this.index;
        this.index = globalMatch.lastIndex;
        return {start, end: globalMatch.match.index}
    }
    
    line_number(index: number): number {
        return lineNumber(this.session.source.substr(0, this.index))
    }

    throw_error(message: string, options?: {index?: number}): never {
        const index = this.start + (options?.index ?? this.index);
        const prefix = this.session.source.substr(0, index)
        const lastNl = prefix.lastIndexOf('\n')
        const lineNo = lineNumber(prefix)
        const colNo = index - lastNl
        const fileInfo = this.session.filename ? ` at ${this.session.filename}` : ""
        const longMessage = `${message}${fileInfo} line ${lineNo} column ${colNo}`
        throw new Error(longMessage)
    }
}

function trim_input(match: RegExpExecArray | null) {
    if (match == null) {
        return null
    }
    let clone = {...match}
    delete clone.input
    return clone
}

export function parserSession(v: {source: string, filename?: string, config: YattConfig}): ParserSession {
    return {source: v.source, filename: v.filename, params: yattParams(v.config), patterns: {}}
}

export function parserContext(session: ParserSession): ParserContext {
    
    return new ParserContext(session, 0, 0, session.source.length)
}
