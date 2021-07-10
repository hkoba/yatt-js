import {
  ParserSession,
  ScanningContext,
  RawPart, AttItem
} from 'lrxml-js'

import { Part, ArgDict, DefaultFlag } from './part'

import {yattParams, YattConfig} from '../config'

export type BuilderMap = Map<string, DeclarationBuilder>;

export type PartName = {name?: string, route?: string, rest: AttItem[]}

export interface DeclarationBuilder {
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

  parse_part_name(rawPart: RawPart): PartName {
    const builder = this.session.builders.get(rawPart.kind)
    if (builder == null) {
      this.throw_error(`Unknown part kind: ${rawPart.kind}`)
    }
    let attlist = Object.assign([], rawPart.attlist)
    return builder.parse_part_name(this, attlist)
  }

  parse_arg_spec(str: string): { type: string, default?: [DefaultFlag, string] } {
    let match = /([\/\|\?])/.exec(str)
    if (match == null) {
      return { type: "" }
    } else {
      let type = str.substring(0, match.index)
      let dflag = match[0]
      let defaultValue = str.substring(match.index + 1);
      return { type, default: [dflag as DefaultFlag, defaultValue] }
    }
  }

  build_arg_dict(attlist: AttItem[]): ArgDict {
    let arg_dict: ArgDict = {}
    for (const att of attlist) {
      if (att.label) {
        if (att.label.kind !== "bare")
          this.throw_error(`Invalid att label: ${att.label}`)
        let name = att.label.value
        if (att.kind === "sq" || att.kind === "dq" || att.kind === "bare") {
          arg_dict[name] = {
            name,
            ...this.parse_arg_spec(att.value)
          }
        } else {
          this.throw_error(`??1 ${att.kind}`)
        }
      }
      else {
        if (att.kind === "bare") {
          let name = att.value
          arg_dict[name] = { name, type: "" }
        }
        else if (att.kind === "entity") {
          // XXX: declaration macro
          console.log(att)
        }
        else {
          this.throw_error(`??2 ${att.kind} file ${this.session.filename}`)
        }
      }
    }
    return arg_dict
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
