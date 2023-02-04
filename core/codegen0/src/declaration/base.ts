import { AttItem, hasQuotedStringValue, isBareLabeledAtt } from '@yatt/lrxml'

import { DeclarationProcessor, BuilderContext } from './context'

export class BaseProcessor implements DeclarationProcessor {
  readonly kind = 'base'
  createPart(ctx: BuilderContext, attlist: AttItem[]): undefined {
    for (const att of attlist) {
      if (! isBareLabeledAtt(att)) {
        // XXX: better diag
        ctx.throw_error(`base att label must be bare element`)
      }
      if (att.label.value === "dir" || att.label.value === "file") {
        if (! hasQuotedStringValue(att)) {
          // XXX:
          ctx.throw_error(`wrong base att value: ${att}`)
        }
        ctx.append_stash([this.kind, ''], [att.label.value, '']); //XXX
      } else {
        ctx.throw_error(`Unknown base att: ${att.label.kind}`)
      }
    }
    return;
  }
}
