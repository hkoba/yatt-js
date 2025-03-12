#!/usr/bin/env -S deno run -RE

import {extract_line, extract_prefix_spec} from '@yatt/lrxml'

import {generate_mounter} from './generate.ts'

import type {YattConfig} from '../../config.ts'

import {readFile} from 'node:fs/promises'

import process from 'node:process'

// import {resolve} from 'node:path'

import * as yatt from '../../yatt.ts'

import {makeProgram} from '../../utils/compileTs.ts'

export async function runFile(filename: string, params: {[k:string]: any}, config: YattConfig)
: Promise<string> {

  const source = await readFile(filename, {encoding: 'utf-8'})

  return await runSource(source, params, {filename, ...config})
}

export async function runSource(
  source: string,
  params: {[k:string]: any},
  config: YattConfig & {filename: string}
): Promise<string> {

  const output = generate_mounter(config.filename, source, config)
  const script = output.outputText

  const {outputText, outputMap, diagnostics} = makeProgram(script, [], {
    // fileName: resolve(config.filename), // XXX ファイル名を入れると outputMap がゼロになる！何で…？
    moduleName: '$yatt$public$index'
  })

  if (diagnostics && diagnostics.length > 0) {
    // console.dir(outputMap, {colors: true, depth: 4});
    const dummyModName = 'module'
    for (const [kind, diag] of diagnostics) {
      if (diag.file && diag.file.fileName === `${dummyModName}.ts`
          &&
          diag.start != null && diag.messageText != null) {
        const messageText = typeof diag.messageText === 'string' ?
          diag.messageText : diag.messageText.messageText;
        console.log(`${kind} error: ${messageText}`)
        const [lastNl, _lineNo, colNo] = extract_prefix_spec(script, diag.start)
        const tokenLine = extract_line(script, lastNl, colNo)
        console.log(tokenLine)
      }
      else {
        console.dir([kind, diag], {colors: true, depth: 3})
      }
    }
    process.exit(1);
  } else {
    console.log(outputMap)
  }

  console.log(`outputText=${outputText}`)

  const {mount} = await import(`data:text/javascript,${outputText}`)

  const $yatt = {
    $public: {}
  }

  const $this = mount($yatt)

  const CON = {
    buffer: "",
    append(str: string) {
      this.buffer += str;
    },
    appendUntrusted(str?: string) {
      if (str == null) return;
      this.buffer += yatt.runtime.escape(str)
    },
    appendRuntimeValue(val: any) {
      this.buffer += yatt.runtime.escape(val)
    }
  }

  $this.render_(CON, params);

  return CON.buffer;
}

if (import.meta.main) {
  const { parse_long_options } = await import('../../deps.ts');

  const args = process.argv.slice(2)
  const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
  const config = {
    debug: { declaration: debugLevel },
    // ext: 'ytjs',
  }
  parse_long_options(args, {target: config});

  const [filename, paramsJson] = args

  if (filename == null) {
    console.error(`Usage: ${process.argv[1]} sourceFile`)
    process.exit(1)
  }

  const params = paramsJson ? JSON.parse(paramsJson) : {}

  try {
    const output = await runFile(filename, params, config)
    process.stdout.write(`\n=== output ====\n`);
    process.stdout.write(output);
  } catch (e) {
    console.log(e)
  }
}
