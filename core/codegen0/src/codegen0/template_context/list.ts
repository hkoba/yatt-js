import {
  type Term, hasQuotedStringValue, isIdentOnly
} from '../../deps.ts'

import type {CodeGenContext, Part} from '../context.ts'
import type {VarScope} from '../varscope.ts'

import type {CodeFragment} from '../codefragment.ts'

import {generate_entity} from '../widget/entity/generate.ts'

export function generate_as_cast_to_list<T extends Part>(
  ctx: CodeGenContext<T>, scope: VarScope, term: Term
): CodeFragment {

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

}
