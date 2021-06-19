// https://github.com/rollup/rollup-starter-lib/blob/typescript/rollup.config.js

import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { preserveShebangs } from 'rollup-plugin-preserve-shebangs';

import pkg from './package.json';

export default [
    // browser-friendly UMD build
    {
	input: 'src/index.ts',
	output: {
	    name: 'lrxml',
	    file: pkg.browser,
	    format: 'umd',
            sourcemap: true
	},
	plugins: [
            preserveShebangs(),
	    resolve(),   // so Rollup can find external modules
	    commonjs(),  // so Rollup can convert external modules to an ES module
	    typescript() // so Rollup can convert TypeScript to JavaScript
	]
    },

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
	    typescript() // so Rollup can convert TypeScript to JavaScript
	],
	output: [
	    { file: pkg.main, format: 'cjs', sourcemap: true },
	    { file: pkg.module, format: 'es', sourcemap: true }
	]
    }
];
