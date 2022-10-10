import {CodeGenContext} from '../context'

import {CodeFragment, Argument, Statement} from './index'

export function as_print(ctx: CodeGenContext, frag: Argument | Statement): CodeFragment {
  switch (frag.kind) {
    case 'argument': {
      if (frag.need_runtime_escaping) {
        // XXX: CON.escape
        return [`CON.appendUntrusted(`, frag.items, `);`]
      } else {
        return [`CON.append(`, frag.items, `);`]
      }
    }
    case 'statement': {
      return frag.items;
    }
    default:
      ctx.NIMPL()
  }
}
