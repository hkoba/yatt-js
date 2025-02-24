import {
    type ElementNode
    , isBareLabeledAtt
    , hasQuotedStringValue
} from '../../deps.ts'
import type {WidgetGenContext} from '../context.ts'
import type {CodeFragment} from "../codefragment.ts"
import type {VarScope} from '../varscope.ts'
import {build_simple_variable} from '../../declaration/index.ts'
import { generate_as_cast_to_text } from "../template_context/text.ts";


export function macro_my(
    ctx: WidgetGenContext,
    scope: VarScope,
    node: ElementNode,
    option?: {fragment?: boolean}
) {
  const output: CodeFragment[] = []
  for (const att of node.attlist) {
    // console.log(att)
    if (! isBareLabeledAtt(att)) {
      ctx.NIMPL(att)
    }
    const varName = att.label.value
    // XXX: typeName
    const myvar = build_simple_variable(ctx, varName, {typeName: "text"}, {})
    if (scope.has(varName)) {
      ctx.token_error(att, `duplicate variable declaration ${varName}`)
    }
    scope.set(varName, myvar)
    output.push("const ", {kind: 'name', code: varName, source: att})
    if (hasQuotedStringValue(att)) {
      // XXX proper casting
      output.push(" = ", generate_as_cast_to_text(ctx, scope, att))
    }
    output.push(";")
  }
  // console.log("scope at end: ", scope)

  return {output}
}
