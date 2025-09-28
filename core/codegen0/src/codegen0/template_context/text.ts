import {
  type Term, hasQuotedStringValue
} from '../../deps.ts'
import type {CodeGenContext, Part} from '../context.ts'
import type {VarScope} from '../varscope.ts'

import {type CodeFragment, joinAsArray} from '../codefragment.ts'

import {escapeAsStringLiteral} from '../escape.ts'

import {generate_entity} from '../widget/entity/generate.ts'
import type { AttStringItem } from "../../../../lrxml/src/attstring/parse.ts";

export function generate_as_text<T extends Part>(
  ctx: CodeGenContext<T>, scope: VarScope, children: AttStringItem[]
): CodeFragment[] {
  return children.map((node) => {
    switch (node.kind) {
      case "text":
        return escapeAsStringLiteral(ctx.range_text(node));
      case "entity":
        return generate_entity(ctx, scope, node).items
    }
  })
}

export function generate_as_cast_to_text<T extends Part>(
  ctx: CodeGenContext<T>, scope: VarScope, term: Term
): CodeFragment {

  if (hasQuotedStringValue(term) || term.kind === "bare") {
    const fragments = generate_as_text(ctx, scope, term.children)
    return joinAsArray('+', fragments)
  } else if (term.kind === 'entity') {
    return generate_entity(ctx, scope, term, {
      need_runtime_escaping: true
    }).items
  } else {
    // console.log(term)
    ctx.NIMPL(term)
  }
}

