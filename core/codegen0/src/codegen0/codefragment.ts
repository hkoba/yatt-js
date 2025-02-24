import type {Node, AnonNode} from '../deps.ts'

import {SourceMapGenerator} from 'npm:source-map'

import {count_newlines} from '../deps.ts'

export type CodeFragmentPayload = {
  code: string,
  source?: Node | AnonNode,
  offset?: number
}

export type CodeFragmentRec =
  {kind: 'type', annotation: CodeFragment[]} |
  {kind: 'name'} & CodeFragmentPayload |
  {kind: 'other'} & CodeFragmentPayload

export type CodeFragment = string | CodeFragmentRec | CodeFragment[]

export function isCodeFragment<T>(arg: CodeFragment | T): arg is CodeFragment {
  if (typeof(arg) === "string")
    return true
  if (arg instanceof Array)
    return true
  const kind = (arg as CodeFragmentRec).kind;
  return kind === 'name' || kind === 'type' || kind === 'other'
}

export function joinAsArray<T>(sep: T, list: T[]): T[] {
  return list.reduce((prev: T[], cur: T) => {
    if (prev.length) {
      prev.push(sep)
    }
    prev.push(cur);
    return prev;
  }, [])
}

export function typeAnnotation(...arg: CodeFragment[]): CodeFragment {
  return {kind: 'type', annotation: arg}
}

export type CodeFragmentFinalizerOptions = {
  debug?: number,
  ts?: boolean,
  sourceMapOptions?: {
    file?: string
    sourceRoot?: string
  }
}

export function finalize_codefragment(
  source: string,
  file: string,
  fragments: CodeFragment[],
  options: CodeFragmentFinalizerOptions
): {outputText: string, sourceMapText: string} {

  if (options.debug && options.debug >= 2) {
    console.dir(fragments, {colors: true, depth: null})
  }

  const generator = new SourceMapGenerator(options.sourceMapOptions)
  const line = 1
  const outputCtx = {
    debug: options.debug ?? 0,
    ts: options.ts ?? true,
    line, lineStart: 0, generator, outputText: ""
  }

  finalize_codefragment_1(
    source, file, fragments, outputCtx
  )

  const sourceMapText = generator.toString()

  return {outputText: outputCtx.outputText, sourceMapText}
}

type OutputContext = {
  ts: boolean
  debug: number
  line: number
  lineStart: number
  outputText: string
  generator: SourceMapGenerator
}

function appendText(outputCtx: OutputContext, text: string): Position {
  const line = outputCtx.line
  const column = outputCtx.outputText.length - outputCtx.lineStart
  const numNewLines = count_newlines(text)
  outputCtx.outputText += text
  outputCtx.line += numNewLines
  if (numNewLines > 0) {
    outputCtx.lineStart = outputCtx.outputText.lastIndexOf('\n') + 1
  }
  return {line, column}
}

function finalize_codefragment_1(
  source: string,
  file: string,
  fragments: CodeFragment[],
  outputCtx: OutputContext
): void {

  for (const item of fragments) {
    if (typeof(item) === "string") {
      appendText(outputCtx, item)
    }
    else if (item instanceof Array) {
      finalize_codefragment_1(source, file, item, outputCtx)
    }
    else {
      switch (item.kind) {
        case "type": {
          if (outputCtx.ts) {
            finalize_codefragment_1(source, file, item.annotation, outputCtx)
          }
          break
        }
        case "other": case "name": {
          if (item.source == null) {
            appendText(outputCtx, item.code)
          } else {
            const original = tokenPosition(source, item.source, item.offset)
            const generated = appendText(outputCtx, item.code)

            if (outputCtx.debug) {
              console.log(`appending ${item.kind} ${item.code}`, original, generated)
            }

            if (item.kind === "name") {
              outputCtx.generator.addMapping({
                original, generated, source: file, name: item.code
              })
            } else {
              outputCtx.generator.addMapping({
                original, generated, source: file
              })
            }
          }
          break;
        }
        default:
          throw new Error(`never ${item}`)
      }
    }
  }
}

type Position = {line: number, column: number}

function tokenPosition(source: string, token: Node | AnonNode, offset?: number): Position {
  if (offset == null) {
    offset = 0
  }
  const lastNl = source.lastIndexOf('\n', token.start)
  const lineStart = lastNl + 1
  return {line: token.line, column: token.start - lineStart + offset}
}
