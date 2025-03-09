#!/usr/bin/env -S deno run -RE

import {extract_line, extract_prefix_spec} from '@yatt/lrxml'

import {generate_mounter} from './generate.ts'

import type {YattConfig} from '../../config.ts'

import {readFile} from 'node:fs/promises'

import process from 'node:process'

import * as yatt from '../../yatt.ts'

import {makeProgram} from '../../utils/compileTs.ts'

export async function runFile(filename: string, config: YattConfig)
: Promise<string> {

  const source = await readFile(filename, {encoding: 'utf-8'})

  return await runSource(source, {filename, ...config})
}

export async function runSource(
  source: string,
  config: YattConfig & {filename: string}
): Promise<string> {

  const output = generate_mounter(config.filename, source, config)
  const script = output.outputText

  const {program, outputMap, diagnostics} = makeProgram(script, {
    fileName: config.filename,
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

  const {mount} = await import(`data:text/javascript,${program}`)

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

  $this.render_(CON, {});

  return CON.buffer;
}

if (import.meta.main) {
  (async () => {
    const { parse_long_options } = await import('../../deps.ts');

    const args = process.argv.slice(2)
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    const config = {
      debug: { declaration: debugLevel },
      // ext: 'ytjs',
    }
    parse_long_options(args, {target: config})

    const filename = args[0]

    if (filename == null) {
      console.error(`Usage: ${process.argv[1]} sourceFile`)
      process.exit(1)
    }

    try {
      const output = await runFile(filename, config)
      process.stdout.write(`\n=== output ====\n`);
      process.stdout.write(output);
    } catch (e) {
      console.log(e)
    }
  })()
}
