#!/usr/bin/env ts-node

import {generate_module} from './generate'

import {YattConfig} from '../../config'

import {build_template_declaration} from '../../declaration'

import {readFileSync} from 'fs'

import {compile, makeProgram, reportDiagnostics} from '../../utils/compileTs'

import {yatt} from '../../yatt'

import { parse_long_options } from 'lrxml-js';

export async function runFile(filename: string, config: YattConfig): Promise<string> {
  const source = readFileSync(filename, {encoding: "utf-8"})

  return await runSource(source, {filename, ...config})
}

export async function runSource(source: string, config: YattConfig & {filename: string}) {

  config.exportNamespace = true;

  const output = await generate_module(source, config)

  let {program: _program, outputMap, diagnostics} = makeProgram(output.outputText)

  if (diagnostics && diagnostics.length > 0) {
    reportDiagnostics(output.outputText, diagnostics);
    process.exit(1)
  } else {
    console.log(outputMap)
  }

  const mod = compile([...outputMap.values()].join('\n'), config.filename)

  const fn = mod.exports['render_'];
  if (fn == null) {
    throw new Error(`Can't find render_ in ${config.filename}`);
  }

  let CON = {
    buffer: "",
    append(str: string) {
      this.buffer += str;
    },
    appendUntrusted(str?: string) {
      if (str == null) return;
      this.buffer += yatt.runtime.escape(str)
    }
  }
  fn(CON, {});

  return CON.buffer;
}

if (module.id === '.') {

  let args = process.argv.slice(2)
  const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
  let config = {
    body_argument_name: "body",
    debug: { declaration: debugLevel },
    // ext: 'ytjs',
  }
  parse_long_options(args, {target: config})

  const filename = args[0]

  if (filename == null) {
    console.error(`Usage: ${process.argv[0]} sourceFile`)
    process.exit(1)
  }

  runFile(filename, config).then(output => {
    process.stdout.write(`\n=== output ====\n`);
    process.stdout.write(output);
  }).catch(err => {
    throw err
  })
}