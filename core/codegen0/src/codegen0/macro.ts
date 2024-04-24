import {ElementNode} from '../deps.ts'

import {WidgetGenContext} from './context.ts'

import {VarScope} from './varscope.ts'

import {CodeFragment} from './codefragment.ts'

export type CGenMacro = (
  ctx: WidgetGenContext, scope: VarScope, node: ElementNode
) => {output: CodeFragment, fragment?: any}; // XXX: may need emitter abstraction

export type MacroDict = {[k: `macro_${string}`]: CGenMacro}
