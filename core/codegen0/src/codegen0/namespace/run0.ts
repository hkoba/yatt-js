#!/usr/bin/env ts-node

import {generate_namespace} from './generate'

import {YattConfig} from '../../config'

// XXX: Remove node path dependencies
import {readFileSync} from 'fs'

import {compile, makeProgram, reportDiagnostics} from '../../utils/compileTs'

import {yatt} from '../../yatt'

import { parse_long_options } from 'lrxml';

export function runFile(filename: string, config: YattConfig): string {
  const source = readFileSync(filename, {encoding: "utf-8"})

  return runSource(source, {filename, ...config})
}

export function runSource(source: string, config: YattConfig & {filename?: string}) {

  config.exportNamespace = true;

  const filename = config.filename ?? ''

  const output = generate_namespace(filename, source, config)

  if (config.debug?.codegen) {
    console.log(output.outputText)
  }

  let {program: _program, outputMap, diagnostics} = makeProgram(output.outputText)

  if (diagnostics && diagnostics.length > 0) {
    reportDiagnostics(output.outputText, diagnostics);
    process.exit(1)
  } else {
    // console.log(outputMap)
  }

  const mod = compile([...outputMap.values()].join('\n'), filename)

  if (output.templateName.length != 2) {
    throw new Error(`Invalid output template name: ${output.templateName.join('.')}`)
  }
  const [rootNS, fileNS] = output.templateName;

  const ns: {[k: string]: any} = mod.exports[rootNS][fileNS];
  if (ns == null) {
    throw new Error(`Can\'t find namespace ${rootNS}.${fileNS}`);
  }
  const fn = ns['render_']
  if (fn == null) {
    throw new Error(`Can\'t find render_ in ${rootNS}.${fileNS}`);
  }

  let CON = {
    buffer: "",
    append(str: string) {
      this.buffer += str;
    },
    appendUntrusted(str?: string | number) {
      if (str == null) return;
      if (typeof str === "number") {
        this.buffer += str
      } else {
        this.buffer += yatt.runtime.escape(str)
      }
    }
  }
  fn.apply(ns, [CON, {}]);

  return CON.buffer;
}

if (module.id === '.') {
  (async () => {
    let args = process.argv.slice(2)
    const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
    let config = {
      debug: { declaration: debugLevel },
      // ext: 'ytjs',
    }
    parse_long_options(args, {target: config})

    const filename = args[0]

    if (filename == null) {
      console.error(`Usage: ${process.argv[0]} sourceFile`)
      process.exit(1)
    }

    let output = runFile(filename, config)
    process.stdout.write(`\n=== output ====\n`);
    process.stdout.write(output);
  })()
}
