import {
  ElementNode
  , AttItem, AttElement, AttValue, attValue, isBareLabeledAtt
  , hasQuotedStringValue, isIdentOnly
} from 'lrxml-js'

import {CodeGenContext} from '../context'

import {VarScope} from '../varscope'

import {isError} from '../../utils/isError'

import {build_simple_variable} from '../../declaration'

import {generate_body} from '../widget/body'

import * as Util from 'util'

export function macro_foreach(
  ctx: CodeGenContext, scope: VarScope,
  node: ElementNode,
  option?: {fragment?: boolean}
)
: {output: string, fragment?: any}
{
  // console.dir(node, {depth: null, color: true})
  const primary = collect_arg_spec(node.attlist, ['my', 'list'])
  if (isError(primary))
    ctx.token_error(primary.value, primary.err)
  const {my, list} = primary.ok;
  const varName = my && my.kind === "identplus" ?
    my.value : "_";
  const loopVar = build_simple_variable(ctx, varName, {typeName: "text"}, {})
  const localScope = new VarScope(new Map, scope)
  localScope.set(varName, loopVar)
  // console.log(`my: `, my)
  // console.log(`list: `, list)
  if (list == null)
    ctx.token_error(node, `no list= is given`)

  let listExpr
  if (hasQuotedStringValue(list)) {
    listExpr = `[${list.value}]`
  } else if (isIdentOnly(list)) {
    ctx.NIMPL(list)
  } else {
    ctx.NIMPL(list)
  }

  if (node.children == null)
    ctx.token_error(node, `BUG?: foreach body is empty!`)

  const body = generate_body(ctx, localScope, node.children)

  const format = `for (const %s of %s) {%s}`
  let fragment
  if (option && option.fragment)
    fragment = {format, loopVar, listExpr, body}
  return {output: Util.format(format, varName, listExpr, body), fragment}
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
