import {
  ParserSession,
  ScanningContext,
  AttItem
} from 'lrxml-js'

import {yattParams, YattConfig} from '../config'

export type BuilderMap = Map<string, DeclarationBuilder>;

export type PartName = {
  name: string,
  route?: string,
  is_public: boolean,
  prefix: string,
  kind: string,
  rest: AttItem[]
}

export interface DeclarationBuilder {
  readonly kind: string;
  parse_part_name(ctx: BuilderContext, attlist: AttItem[]): PartName
}

export type BuilderSession = ParserSession & {
  builders: BuilderMap
}

export class BuilderContext extends ScanningContext<BuilderSession> {
  constructor(session: BuilderSession,
              index: number = 0,
              start: number = 0,
              end: number = session.source.length,
              parent?: BuilderContext) {
    super(session, index, start, end, parent)
  }

  att_is_quoted(att: AttItem): boolean {
    return att.kind === "sq" || att.kind === "dq"
  }

  att_has_label(att: AttItem): boolean {
    return att.label != null
  }

  cut_name_and_route(attlist: AttItem[]): [string, string | undefined] | null {
    if (!attlist.length)
      return null
    let head = attlist.shift()
    if (head == null)
      return null
    if (head.label) {
      if (head.label.kind !== "bare") {
        this.throw_error(`Invalid token : ${head.label}`)
      }
      if (head.kind === "sq" || head.kind === "dq" || head.kind === "bare") {
        return [head.label.value, head.value]
      } else {
        this.NIMPL()
      }
    } else {
      if (head.kind === "sq" || head.kind === "dq") {
        return ["", head.value]
      }
      if (head.kind !== "bare") {
        this.NIMPL()
      }
      return [head.value, undefined]
    }
  }
}

export function builderContext(v: {builders: BuilderMap, source: string, filename?: string, config: YattConfig}): BuilderContext {

  const session: BuilderSession = {builders: v.builders, source: v.source, filename: v.filename, params: yattParams(v.config), patterns: {}}

  return new BuilderContext(session)
}
