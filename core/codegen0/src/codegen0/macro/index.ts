import {macro_foreach} from './foreach.ts'

import type {MacroDict} from '../macro.ts'

import {macro_my} from './my.ts'

export const builtinMacros: MacroDict = {
  "macro_my": macro_my,
  "macro_foreach": macro_foreach
}
