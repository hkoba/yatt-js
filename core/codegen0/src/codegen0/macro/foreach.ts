import {
  ElementNode
  , AttItem, AttElement, AttValue, attValue, isBareLabeledAtt
} from 'lrxml-js'

import {CodeGenContext} from '../context'

import {VarScope} from '../varscope'

import {isError} from '../../utils/isError'

export function macro_foreach(
  ctx: CodeGenContext, scope: VarScope,
  node: ElementNode,
)
: string
{
  console.dir(node, {depth: null, color: true})
  const primary = collect_arg_spec(node.attlist, ['my', 'list'])
  if (isError(primary))
    ctx.token_error(primary.value, primary.err)
  const actualArgs = primary.ok;
  console.log(`my: `, actualArgs.my)
  console.log(`list: `, actualArgs.list)
  return ''
}

function collect_arg_spec<T extends {[k: string]: AttValue}>(
  attlist: (AttItem | AttElement)[], specList: (keyof T)[]
)
: {ok: Partial<T>} | {err: string, value: (AttItem | AttElement)} {
  const spec: Set<string> = new Set(specList as string[])
  const seen: Set<string> = new Set
  const actual: {[k: string]: AttValue} = {}
  for (const att of attlist) {
    if (att.kind === "attelem")
      break;
    let argName: string | undefined
    if (! isBareLabeledAtt(att)) {
      if (seen.size >= specList.length)
        return {err: `Too many args`, value: att}
      argName = specList[seen.size] as string
    } else {
      argName = att.label.value;
      if (! spec.has(argName)) {
        return {err: `Unknown arg ${argName}`, value: att.label}
      }
      if (seen.has(argName)) {
        return {err: `Duplicate arg ${argName}`, value: att.label}
      }
    }
    seen.add(argName)
    actual[argName] = attValue(att)
  }
  return {ok: actual as Partial<T>}
}
