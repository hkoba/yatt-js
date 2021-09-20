import {
  Node
} from 'lrxml-js'

import {CodeGenContext} from '../context'

import {VarScope} from '../varscope'

export function macro_foreach(ctx: CodeGenContext, scope: VarScope, node: Node & {kind: 'element'})
: string
{
  console.dir(node, {depth: null, color: true})
  return ''
}
