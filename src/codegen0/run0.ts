#!/usr/bin/env ts-node

import {generate} from './generate'

import {YattConfig} from '../config'

import {build_template_declaration} from '../declaration'

import {readFileSync} from 'fs'

import {compile, makeProgram, reportDiagnostics} from '../utils/compileTs'

import {yatt} from '../yatt'

import { parse_long_options } from 'lrxml-js';

export function run(filename: string, config: YattConfig): void {
  const source = readFileSync(filename, {encoding: "utf-8"})
  const [template, session] = build_template_declaration(
    source,
    {filename, ...config}
  )

  const script = generate(template, {
    ...session
  })

  let {program: _program, outputMap, diagnostics} = makeProgram(script)

  if (diagnostics && diagnostics.length > 0) {
    reportDiagnostics(script, diagnostics);
    process.exit(1)
  } else {
    console.log(outputMap)
  }

  const mod = compile([...outputMap.values()].join('\n'), filename)

  const ns = mod.exports['tmpl']
  const fn = ns ? ns['render_'] : undefined;

  if (fn != null) {
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
    fn.apply(ns, [CON, {}]);

    process.stdout.write(`\n=== output ====\n`);
    process.stdout.write(CON.buffer);
  }
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

  run(filename, config);

}
