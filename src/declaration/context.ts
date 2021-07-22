import {
  ParserSession,
  ScanningContext,
  AttItem, hasStringValue, hasQuotedStringValue, hasNestedLabel, hasLabel,
  isIdentOnly
} from 'lrxml-js'

import {yattParams, YattParams, YattConfig} from '../config'

import { Part, Widget } from './part'

export type BuilderMap = Map<string, DeclarationProcessor>;

export interface DeclarationProcessor {
  readonly kind: string;
  createPart(ctx: BuilderContext, attlist: AttItem[]): [Part, AttItem[]] | undefined
}

export type ArgAdder = {
  name: string, dep: string, fun: (widget: Widget) => ArgAdder | undefined
}

export type BuilderSession = ParserSession & {
  builders: BuilderMap
  params: YattParams
}

export class BuilderContext extends ScanningContext<BuilderSession> {
  public debug: number = 0
  stash: Map<[string, string], any>;
  constructor(session: BuilderSession,
              index: number = 0,
              start: number = 0,
              end: number = session.source.length,
              parent?: BuilderContext) {
    super(session, index, start, end, parent)
    this.stash = new Map;
    if (session.params.debug.declaration !== undefined) {
      this.debug = session.params.debug.declaration
    }
  }

  is_body_argument(name: string): boolean {
    return this.session.params.body_argument_name === name
  }

  append_stash(key: [string, string], value: any): void {
    if (! this.stash.has(key)) {
      this.stash.set(key, [value])
    } else {
      let entry = this.stash.get(key);
      entry.push(value)
      this.stash.set(key, entry)
    }
  }

  copy_array<T>(ary: T[]): T[] {
    return Object.assign([], ary)
  }

  cut_name_and_route(attlist: AttItem[]): [string, string | undefined] | null {
    if (!attlist.length)
      return null
    let head = attlist.shift()
    if (head == null)
      return null
    if (hasLabel(head)) {
      if (hasNestedLabel(head)) {
        this.NIMPL();
      }
      if (hasStringValue(head)) {
        return [head.label.value, head.value]
      }
      else {
        this.NIMPL()
      }
    }
    else if (isIdentOnly(head)) {
      return [head.value, undefined]
    }
    else {
      if (hasNestedLabel(head)) {
        this.NIMPL();
      }
      if (head.kind === "entity") {
        this.NIMPL()
      }
      if (hasQuotedStringValue(head)) {
        return ["", head.value]
      }
      return null;
    }
  }
}

export function builderContext(v: {builders: BuilderMap, source: string, filename?: string, config: YattConfig}): BuilderContext {

  const session: BuilderSession = {builders: v.builders, source: v.source, filename: v.filename, params: yattParams(v.config), patterns: {}}

  return new BuilderContext(session)
}
