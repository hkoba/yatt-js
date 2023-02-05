'use strict';
// https://github.com/rollup/rollup-starter-lib/blob/typescript/rollup.config.js

import esbuild from 'rollup-plugin-esbuild'
import { preserveShebangs } from 'rollup-plugin-preserve-shebangs';
import MagicString from 'magic-string'

import pkg from './package.json';

const StripToplevelGuard = {
  name: 'strip-toplevel-guard',
  transform(code, id) {
    const PAT = /(?<=^|\n)if\s*\(module\.id\s*===\s*"[.]"\s*\)\s*\{\s+?[\s\S]*?\n\}/g
    let str = new MagicString(code)
    let match, matchCount = 0
    while ((match = PAT.exec(code)) != null) {
      str.overwrite(match.index, match.index + match[0].length, '')
      matchCount++
    }
    if (matchCount) {
      // console.log(`Changed by strip-toplevel-guard: ${id}`)
      return {
        code: str.toString(), map: str.generateMap({ hires: true})
      }
    } else {
      // console.log(`Nothing matched by strip-toplevel-guard: ${id}`)
      return {code, map: null}
    }
  }
}

const tsconfig = 'tsconfig.build.json'

export default [
  // CommonJS (for Node) and ES module (for bundlers) build.
  // (We could have three entries in the configuration array
  // instead of two, but it's quicker to generate multiple
  // builds from a single configuration where possible, using
  // an array for the `output` option, where we can specify 
  // `file` and `format` for each target)
  {
    input: 'src/index.ts',
    external: [],
    plugins: [
      preserveShebangs(),
      StripToplevelGuard,
      esbuild({tsconfig})
    ],
    output: [
      { file: pkg.main, format: 'cjs', sourcemap: true },
      { file: pkg.module, format: 'es', sourcemap: true }
    ]
  },
];
