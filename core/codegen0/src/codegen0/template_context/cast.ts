import {Term} from '../../deps.ts'

import {CodeGenContext, Part} from '../context.ts'
import {VarScope} from '../varscope.ts'

import {CodeFragment} from '../codefragment.ts'

import {Variable} from '../../declaration/vartype.ts'

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
    case 'html':
    case 'scalar':
    case 'widget':
      ctx.NIMPL(term)
    default:
      ctx.NIMPL(term)
  }
}
