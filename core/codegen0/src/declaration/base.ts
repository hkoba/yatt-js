import { type AttItem, hasQuotedStringValue, isBareLabeledAtt } from '../deps.ts'
import type {TemplateDeclaration} from './types.ts'
import type { DeclarationProcessor, BuilderContext } from './context.ts'

import {get_template_declaration} from './template-declaration.ts'

import {resolveTemplate} from './partFolder.ts'

export class BaseProcessor implements DeclarationProcessor  {
  readonly kind: 'base' = 'base'
  async process(ctx: BuilderContext, template: TemplateDeclaration, attlist: AttItem[]): Promise<undefined> {
    for (const att of attlist) {
      if (! isBareLabeledAtt(att)) {
        // XXX: better diag
        ctx.throw_error(`base att label must be bare element`)
      }
      if (! hasQuotedStringValue(att)) {
        ctx.throw_error(`wrong base att value: ${att}`)
      }
      if (att.label.value === "file") {
        // XXX: @ processing
        const baseFn = resolveTemplate(att.value, template)
        const entry = await get_template_declaration(ctx.session, baseFn)
        if (! entry) {
          ctx.token_error(att, `No such template: ${att.value}: baseFn=${baseFn}`)
        }
        template.base.push({
          kind: 'template', modTimeMs: entry.modTimeMs, template: entry.template
        })
      }
      else if (att.label.value === "dir") {
        // XXX: @processing!!
        const dirFn = resolveTemplate(att.value, template)
        template.base.push({kind: 'folder', path: dirFn})
      }
      else {
        ctx.throw_error(`Unknown base att: ${att.label.kind}`)
      }
    }
  }
}
