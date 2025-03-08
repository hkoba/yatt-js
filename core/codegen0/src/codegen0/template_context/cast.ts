import type {Term} from '../../deps.ts'

import type {CodeGenContext, Part} from '../context.ts'
import type {VarScope} from '../varscope.ts'

import type {CodeFragment} from '../codefragment.ts'

import type {Variable} from '../../declaration/vartype.ts'

import {generate_as_cast_to_text} from './text.ts'
import {generate_as_cast_to_list} from './list.ts'

export function generate_as_cast_to<T extends Part>(
  ctx: CodeGenContext<T>, scope: VarScope, variable: Variable, term: Term
): CodeFragment {

  switch (variable.typeName) {
    case 'text': {
      return generate_as_cast_to_text(ctx, scope, term)
    }
    case 'list': {
      return generate_as_cast_to_list(ctx, scope, term)
    }
    case 'scalar': {
      // XXX: is this safe? put ()?
      if (term.kind !== 'entity' && term.kind !== 'nest') {
        return {kind: "other", code: term.value, source: term};
      } else {
        ctx.NIMPL(term)
        break; /* not reached */
      }
    }
    case 'html':
    case 'widget': {
      ctx.NIMPL(term);
      break; /* not reached */
    }
    default:
      ctx.NIMPL(term)
  }
}
