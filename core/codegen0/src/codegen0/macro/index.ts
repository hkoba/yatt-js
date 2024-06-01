import {macro_foreach} from './foreach.ts'

import type {MacroDict} from '../macro.ts'

export const builtinMacros: MacroDict = {
  "macro_foreach": macro_foreach
}
