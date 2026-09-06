import {
  attValue, isBareLabeledAtt,
  type TermShape, termShape,
  type AttElement,
  type AttItem,
  type ElementNode
} from '../../deps.ts';


import type { WidgetGenContext } from '../context.ts';

import { VarScope } from '../varscope.ts';

import { isError } from '../../utils/isError.ts';

import { build_simple_variable, type Variable, type SimpleVar } from '../../declaration/index.ts';

import { generate_body } from '../widget/body.ts';

import { generate_as_cast_to_list } from '../template_context/list.ts';

import type { CodeFragment } from '../codefragment.ts';

export async function macro_foreach(
  ctx: WidgetGenContext, scope: VarScope,
  node: ElementNode,
  option?: {fragment?: boolean}
)
: Promise<{output: CodeFragment
  , fragment?: {loopVar: SimpleVar, listExpr: CodeFragment, body: CodeFragment}}>
{
  // console.dir(node, {depth: null, colors: true})
  // XXX: TODO: Allow varName=type (yatt_lite#249)
  const primary = collect_arg_spec(node.attlist, ['my', 'list'])
  if (isError(primary))
    ctx.token_error(primary.value, primary.err)
  const {my, list} = primary.ok;
  const varName = my && my.shape === "ident" ?
    my.text : "_";
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
    {kind: 'name', code: varName, source: my ? my.node : undefined},
    " of ", listExpr, ") {",
    body,
    "}")
  let fragment
  if (option && option.fragment)
    fragment = {loopVar, listExpr, body}
  return {output, fragment}
}

export function collect_arg_spec<K extends string>(
  attlist: (AttItem | AttElement)[], specList: K[]
)
: {ok: Partial<Record<K, TermShape>>} | {err: string, value: (AttItem | AttElement)} {
  const spec: Set<string> = new Set(specList)
  const seen: Set<string> = new Set
  const actual: Partial<Record<K, TermShape>> = {}
  for (const att of attlist) {
    if (att.kind === "attelem")
      break;
    let argName: K;
    if (! isBareLabeledAtt(att)) {
      if (seen.size >= specList.length)
        return {err: `Too many args`, value: att}
      argName = specList[seen.size]
    } else {
      const name = att.label.value;
      if (! spec.has(name)) {
        return {err: `Unknown arg ${name}`, value: att.label}
      }
      if (seen.has(name)) {
        return {err: `Duplicate arg ${name}`, value: att.label}
      }
      argName = name as K;
    }
    seen.add(argName)
    actual[argName] = termShape(attValue(att))
  }
  return {ok: actual}
}

function generateListExpr(
  ctx: WidgetGenContext, scope: VarScope,
  list: TermShape,
  node: ElementNode
): CodeFragment[] | CodeFragment {
  // maybePassThruVarName(list)
  const passThru = list.shape === "ident" && !list.has_three_colon ? list.text : null;
  let actualVar: Variable | undefined
  if (!passThru || !(actualVar = scope.lookup(passThru))) {
    // console.log('curscope:', scope)
    // console.log('passThru: ', passThru, 'actualVar: ', actualVar)
    return generate_as_cast_to_list(ctx, scope, list.node);
  }
  if (actualVar.typeName !== "list") {
    ctx.token_error(list.node, `${node.path.join(":")} - ${passThru} should be list type.`)
  }
  return {kind: 'name', code: passThru, source: list.node}
}
