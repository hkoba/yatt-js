import {
  type Term, hasQuotedStringValue, isIdentOnly
} from '../../deps.ts'

import type {CodeGenContext, Part} from '../context.ts'
import type {VarScope} from '../varscope.ts'

import type {CodeFragment} from '../codefragment.ts'

import {generate_entity} from '../widget/entity/generate.ts'
import { AttStringItem } from "../../../../lrxml/src/attstring/parse.ts";

export function generate_as_list<T extends Part>(
  ctx: CodeGenContext<T>, scope: VarScope, children: AttStringItem[]
): CodeFragment[] {
  return children.map((node) => {
    switch (node.kind) {
      case "text":
        return ctx.range_text(node);
      case "entity":
        return generate_entity(ctx, scope, node).items
    }
  })
}

export function generate_as_cast_to_list<T extends Part>(
  ctx: CodeGenContext<T>, scope: VarScope, term: Term
): CodeFragment {

  if (hasQuotedStringValue(term)) {
    const fragments = generate_as_list(ctx, scope, term.children)
    if (hasComma(ctx, term.children)) {
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

function hasComma<T extends Part>(
  ctx: CodeGenContext<T>, children: AttStringItem[]
): boolean {
  for (const node of children) {
    if (node.kind === 'text' && /,/.test(ctx.range_text(node)))
      return true
  }
  return false;
}

