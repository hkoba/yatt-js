import {
  Term, hasQuotedStringValue, isIdentOnly
} from '../../deps.ts'
import {CodeGenContext, Part} from '../context.ts'
import {VarScope} from '../varscope.ts'

import {CodeFragment, joinAsArray} from '../codefragment.ts'

import {escapeAsStringLiteral} from '../escape.ts'

import {generate_entity} from '../widget/entity/generate.ts'

export function generate_as_cast_to_text<T extends Part>(
  ctx: CodeGenContext<T>, scope: VarScope, term: Term
): CodeFragment {

  if (hasQuotedStringValue(term) || term.kind === "bare") {
    const fragments = term.children.map((node) => {
      switch (node.kind) {
        case "text":
          return escapeAsStringLiteral(ctx.range_text(node));
        case "entity":
          return generate_entity(ctx, scope, node).items
      }
    })
    return joinAsArray('+', fragments)
  } else {
    console.log(term)
    ctx.NIMPL(term)
  }
}

