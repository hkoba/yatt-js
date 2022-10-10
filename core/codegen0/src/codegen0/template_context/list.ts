import {
  Term, hasQuotedStringValue, isIdentOnly
} from 'lrxml'

import {CodeGenContext} from '../context'
import {VarScope} from '../varscope'

import {CodeFragment} from '../codefragment'

import {generate_entity} from '../widget/entity/generate'

export function generate_as_cast_to_list(
  ctx: CodeGenContext, scope: VarScope, term: Term
): CodeFragment {
  const program: CodeFragment = []

  if (hasQuotedStringValue(term)) {
    let hasCommas = false;
    const fragments = term.children.map((node) => {
      switch (node.kind) {
        case "text":
          if (/,/.test(ctx.range_text(node)))
            hasCommas = true
          return ctx.range_text(node);
        case "entity":
          return generate_entity(ctx, scope, node).items
      }
    })
    if (hasCommas) {
      return ["[", ...fragments, "]"]
    } else {
      return ["(", ...fragments, ")"]
    }
  } else if (isIdentOnly(term)) {
    ctx.NIMPL(term)
  } else {
    ctx.NIMPL(term)
  }

  return program
}
