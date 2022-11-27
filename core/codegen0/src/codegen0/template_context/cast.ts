import {Term} from 'lrxml'

import {CodeGenContext, Part} from '../context'
import {VarScope} from '../varscope'

import {CodeFragment} from '../codefragment'

import {Variable} from '../../declaration/vartype'

import {generate_as_cast_to_text} from './text'
import {generate_as_cast_to_list} from './list'

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
