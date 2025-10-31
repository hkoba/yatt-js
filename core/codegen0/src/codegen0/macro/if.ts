import {
  type ElementNode
  , type AttItem, type AttElement, type AttValue
  , isBareLabeledAtt
  , hasQuotedStringValue,
  AttStringItem,
  BodyNode
} from '../../deps.ts'

import {WidgetGenContext} from '../context.ts'
import type {CodeFragment} from "../codefragment.ts"
import type {VarScope} from '../varscope.ts'

import {generate_as_list} from '../template_context/list.ts'
import {generate_body} from '../widget/body.ts'

import {isError} from '../../utils/isError.ts'

import {collect_arg_spec} from './foreach.ts'

type IfUnless = {ok: Partial<{"if": AttValue, "unless": AttValue}>} | {err: string, value: (AttItem | AttElement)}


export async function macro_if(
  ctx: WidgetGenContext,
  scope: VarScope,
  node: ElementNode,
  option?: {fragment?: boolean}
) {
  const output: CodeFragment[] = []

  // console.log(`if: `, node)

  const primary: IfUnless = collect_arg_spec(node.attlist, ['if', 'unless'])
  if (isError(primary))
    ctx.token_error(primary.value, primary.err)

  const armList: [string, AttStringItem[] | undefined, string, BodyNode[]][] = []

  // console.log(`ok:`, primary.ok)

  if (primary.ok.if) {
    if (! hasQuotedStringValue(primary.ok.if)) {
      ctx.NIMPL(primary.ok.if)
    }
    if (! node.children) {
      ctx.token_error(node, `yatt:if must have body`)
    }
    armList.push(["if (", primary.ok.if.children, ")", node.children]);
  }
  else if (primary.ok.unless) {
    ctx.NIMPL(primary.ok.unless)
  }
  else {
    ctx.NIMPL(node)
  }

  if (node.footer) {
    // console.log(`footer:`, node.footer)
    for (const elem of node.footer) {
      const [_, kw] = elem.path
      if (kw !== "else") {
        ctx.token_error(elem, `Unknown option for <${elem.path.join(":")}>: ${kw}`)
      }
      if (! elem.children) {
        ctx.token_error(node, `:yatt:else must have body`)
      }

      const arm: IfUnless = collect_arg_spec(elem.attlist, ['if', 'unless'])

      if (isError(arm)) {
        ctx.NIMPL(elem)
      }
      else if (arm.ok.if) {
        if (! hasQuotedStringValue(arm.ok.if)) {
          ctx.NIMPL(arm.ok.if)
        }
        armList.push(["else if (", arm.ok.if.children, ")", elem.children])
      }
      else if (arm.ok.unless) {
        ctx.NIMPL(arm.ok.unless)
      }
      else {
        armList.push(["else", undefined, "", elem.children])
      }
    }
  }

  for (const arm of armList) {
    // console.log(`arm: `, arm)
    const [pre, guard, post, body] = arm;
    output.push(pre, guard ? generate_as_list(ctx, scope, guard) : "", post)
    output.push(' {', await generate_body(ctx, scope, body), '}')
  }

  return {output}
}
