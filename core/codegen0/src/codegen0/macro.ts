import {ElementNode} from '@yatt/lrxml'

import {WidgetGenContext} from './context'

import {VarScope} from './varscope'

import {CodeFragment} from './codefragment'

export type CGenMacro = (
  ctx: WidgetGenContext, scope: VarScope, node: ElementNode
) => {output: CodeFragment, fragment?: any}; // XXX: may need emitter abstraction

export type MacroDict = {[k: `macro_${string}`]: CGenMacro}
