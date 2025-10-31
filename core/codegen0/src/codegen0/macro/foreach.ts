import {
  type ElementNode
  , type AttItem, type AttElement, type AttValue, attValue, isBareLabeledAtt,
  Term,
  maybePassThruVarName
} from '../../deps.ts'

import type {WidgetGenContext} from '../context.ts'

import {VarScope} from '../varscope.ts'

import {isError} from '../../utils/isError.ts'

import {build_simple_variable, Variable, type SimpleVar} from '../../declaration/index.ts'

import {generate_body} from '../widget/body.ts'

import {generate_as_cast_to_list} from '../template_context/list.ts'

import type {CodeFragment} from '../codefragment.ts'

export async function macro_foreach(
  ctx: WidgetGenContext, scope: VarScope,
  node: ElementNode,
  option?: {fragment?: boolean}
)
: Promise<{output: CodeFragment
  , fragment?: {loopVar: SimpleVar, listExpr: CodeFragment, body: CodeFragment}}>
{
  // console.dir(node, {depth: null, colors: true})
  const primary = collect_arg_spec(node.attlist, ['my', 'list'])
  if (isError(primary))
    ctx.token_error(primary.value, primary.err)
  const {my, list} = primary.ok;
  const varName = my && my.kind === "identplus" ?
    my.value : "_";
  // XXX: my:type=varName, my=[varName="type"]?
  const loopVar = build_simple_variable(ctx, varName, {typeName: "text"}, {})
  const localScope = new VarScope(new Map, scope)
  localScope.set(varName, loopVar)
  // console.log(`my: `, my)
  // console.log(`list: `, list)
  if (list == null)
    ctx.token_error(node, `no list= is given`)

  const listExpr = generateListExpr(ctx, scope, list, node)

  if (node.children == null)
    ctx.token_error(node, `BUG?: foreach body is empty!`)

  const body = await generate_body(ctx, localScope, node.children)

  const output: CodeFragment[] = []
  output.push(
    "for (const ",
    {kind: 'name', code: varName, source: my},
    " of ", listExpr, ") {",
    body,
    "}")
  let fragment
  if (option && option.fragment)
    fragment = {loopVar, listExpr, body}
  return {output, fragment}
}

export function collect_arg_spec<T extends {[k: string]: AttValue}>(
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

function generateListExpr(
  ctx: WidgetGenContext, scope: VarScope,
  list: Term,
  node: ElementNode
): CodeFragment[] | CodeFragment {
  const passThru = maybePassThruVarName(list)
  let actualVar: Variable | undefined
  if (!passThru || !(actualVar = scope.lookup(passThru))) {
    console.log('curscope:', scope)
    console.log('passThru: ', passThru, 'actualVar: ', actualVar)
    return generate_as_cast_to_list(ctx, scope, list);
  }
  if (actualVar.typeName !== "list") {
    ctx.token_error(list, `${node.path.join(":")} - ${passThru} should be list type.`)
  }
  return {kind: 'name', code: passThru, source: list}
}
