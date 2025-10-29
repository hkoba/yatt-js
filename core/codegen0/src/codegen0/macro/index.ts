import {macro_foreach} from './foreach.ts'

import type {MacroDict} from '../macro.ts'

import {macro_my} from './my.ts'

import {macro_if} from './if.ts'

export const builtinMacros: MacroDict = {
  "macro_if": macro_if,
  "macro_my": macro_my,
  "macro_foreach": macro_foreach
}
