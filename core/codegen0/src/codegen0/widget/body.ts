import {Node} from 'lrxml-js'
import {CodeGenContext} from '../context'
import {Widget} from '../../declaration'
import {VarScope} from '../varscope'
import {escapeAsStringLiteral} from '../escape'

import {generate_element} from './element/generate'
import {generate_entity} from './entity/generate'

export function generate_body(ctx: CodeGenContext, scope: VarScope, nodeList: Node[]): string {
  let program = ""
  for (const node of nodeList) {
    switch (node.kind) {
      case "comment":
      case "attelem":
      case "pi":
      case "lcmsg": break;
      case "text": {
        let s = escapeAsStringLiteral(ctx.range_text(node))
        program += ` CON.append(${s});`;
        if (node.lineEndLength)
          program += "\n";
        break;
      }
      case "element":
        program += generate_element(ctx, scope, node);
        break;
      case "entity":
        program += generate_entity(ctx, scope, node) + '; ';
        break;
      default:
        ctx.NEVER();
    }
  }

  return program;
}
