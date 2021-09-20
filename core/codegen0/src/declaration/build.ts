#!/usr/bin/env ts-node

import {
  parse_multipart, RawPart, AttItem,
  isBareLabeledAtt, isIdentOnly,
  hasLabel, hasQuotedStringValue
} from 'lrxml-js'

import { YattConfig, yattParams } from '../config'

import {
  BuilderMap, BuilderContext, BuilderContextClass, BuilderSession, DeclarationProcessor,
  VarTypeMap,
  ArgAdder
} from './context'

import { TaskGraph } from './taskgraph'

import { PartBase, PartKind, Part, Widget, makeWidget, Action, Entity } from './part'

import {
  VarTypeSpec, WidgetVar, DelegateVar, DefaultFlag,
  SimpleVar, Variable
} from './vartype'

import { BaseProcessor } from './base'

export class WidgetBuilder implements DeclarationProcessor {
  readonly kind: string = 'widget'
  constructor(
    readonly is_named: boolean, readonly is_public: boolean,
  ) {}

  createPart(ctx: BuilderContext, attlist: AttItem[]): [Widget, AttItem[]] {
    let name, route
    if (! this.is_named) {
      // yatt:args
      // "/route"
      name = ""
      if (attlist.length && !hasLabel(attlist[0])
          && hasQuotedStringValue(attlist[0])) {
        route = ctx.range_text(attlist.shift()!);
      }

    } else {
      if (! attlist.length) {
        // XXX: token position
        ctx.throw_error(`Widget name is not given (1)`)
      }
      const att = ctx.cut_name_and_route(attlist)
      if (! att) {
        ctx.throw_error(`Widget name is not given (2)`)
      }
      name = att[0]
      route = att[1]
    }
    let widget = makeWidget(name, this.is_public)
    widget.route = route;
    return [widget, attlist];
  }
}

export class ActionBuilder implements DeclarationProcessor {
  readonly kind = 'action';
  constructor() {}

  createPart(ctx: BuilderContext, attlist: AttItem[]): [Action, AttItem[]] {
    if (! attlist.length || attlist[0] == null) {
      ctx.throw_error(`Action name is not given`)
    }
    const [name, route] = ctx.cut_name_and_route(attlist)!
    return [{kind: this.kind, name, route, is_public: true,
             argMap: new Map, varMap: new Map}, attlist]
  }
}

export class EntityBuilder implements DeclarationProcessor {
  readonly kind = 'entity';
  constructor() {}

  createPart(ctx: BuilderContext, attlist: AttItem[]): [Entity, AttItem[]] {
    if (! attlist.length || attlist[0] == null) {
      ctx.throw_error(`Entity name is not given`)
    }
    const att = attlist.shift()!
    if (! isIdentOnly(att))
      ctx.NIMPL();
    const name = att.value
    return [{kind: this.kind, name, is_public: false,
             argMap: new Map, varMap: new Map}, attlist]
  }
}

export type TemplateDeclaration = {
  path: string
  partOrder: [PartKind, string][]; // kind, name
  partMap: PartMapType;
  routeMap: RouteMapType;
}

export interface PartMapType {
  widget:  Map<string, Widget>;
  action:  Map<string, Action>;
  entity:  Map<string, Entity>;
  [k: string]: Map<string, PartBase>;
}

export type RouteMapType = Map<string, {part: Part}>;

export function builtin_builders(): BuilderMap {
  let builders = new Map
  builders.set('args', new WidgetBuilder(false, true))
  builders.set('widget', new WidgetBuilder(true, false))
  builders.set('page', new WidgetBuilder(true, true))
  builders.set('action', new ActionBuilder)
  builders.set('entity', new EntityBuilder)
  builders.set('base', new BaseProcessor)
  // XXX: import
  builders.set('', builders.get('args'))
  return builders
}

export function builtin_vartypemap(): VarTypeMap {
  let tm: VarTypeMap = {simple: new Map, nested: new Map};
  const simple = (typeName: SimpleVar['typeName'], is_escaped: boolean): {
    kind: "simple", typeName: SimpleVar['typeName'], is_escaped: boolean, is_callable: false
  } => ({kind: "simple", typeName, is_escaped, is_callable: false});

  tm.simple.set('text', simple("text", false));
  tm.simple.set('html', simple("html", true));

  tm.simple.set('scalar', simple("scalar", false));
  tm.simple.set('value',  tm.simple.get('scalar')!)

  tm.simple.set('list', simple("list", false));

  tm.simple.set('expr', simple("expr", false));
  tm.simple.set('code', tm.simple.get('expr')!);

  tm.simple.set('boolean', simple("boolean", false));
  tm.simple.set('bool',    tm.simple.get('boolean')!);

  tm.nested.set('widget', {
    kind: "callable", typeName: "widget", fun: build_widget_varialbe
  })
  tm.nested.set('code', tm.nested.get('widget')!)

  tm.nested.set('delegate', {
    kind: "delayed", typeName: 'delegate', fun: build_delegate_variable_adder
  })

  return tm
}

export function build_simple_variable(
  ctx: BuilderContext, varName: string, spec: VarTypeSpec,
  {attItem, argNo}: {attItem?: AttItem, argNo?: number}
): SimpleVar
{
  let givenTypeName = spec.typeName;
  let defaultSpec = spec.defaultSpec;
  const is_body_argument = ctx.is_body_argument(varName);

  const rec = ctx.session.varTypeMap.simple.get(givenTypeName)
  if (rec == null)
    ctx.maybe_token_error(attItem, `Unknown type ${givenTypeName} for argument ${varName}`)
 
  const {typeName, is_escaped, is_callable} = rec

  return {
    typeName: typeName as SimpleVar['typeName'], is_escaped, is_callable,
    varName, defaultSpec, attItem, argNo,
      from_route: false, is_body_argument,
  }
}

export function build_template_declaration(
  source: string, config: {filename?: string, builders?: BuilderMap} & YattConfig
): [TemplateDeclaration, BuilderSession] {
  // XXX: default private or public
  let {
    builders = builtin_builders(),
    varTypeMap = builtin_vartypemap(),
    ...rest_config
  }: {builders?: BuilderMap, varTypeMap?: VarTypeMap, filename?: string} & YattConfig = config

  const buildParams = yattParams(rest_config);

  const [rawPartList, parser_session] = parse_multipart(source, rest_config)

  const {filename, patterns} = parser_session;

  const builder_session: BuilderSession = {
    builders, varTypeMap, source, filename, patterns,
    params: buildParams
  };

  const ctx = new BuilderContextClass(builder_session)

  // For delegate type and ArgMacro
  let partOrder: [PartKind, string][] = []
  let partMap: PartMapType = {widget: new Map, action: new Map, entity: new Map};
  let taskGraph = new TaskGraph<Widget>(ctx.debug);
  let routeMap: RouteMapType = new Map

  for (const rawPart of rawPartList) {
    ctx.set_range(rawPart)
    if (! builders.has(rawPart.kind)) {
      ctx.token_error(rawPart, `Unsupported part kind: ${rawPart.kind}`);
    }
    const pn = createPart(ctx, rawPart)
    if (! pn)
      continue;
    const [part, attlist] = pn
    if (partMap[part.kind].has(part.name)) {
      // XXX: Better diag
      ctx.throw_error(`Duplicate declaration ${part.kind} ${part.name}`);
    }
    switch (part.kind) {
      case "widget": partMap.widget.set(part.name, part); break;
      case "action": partMap.action.set(part.name, part); break;
      case "entity": partMap.entity.set(part.name, part); break;
      default:
        // typeof part.kind is never.
        // let pm = partMap[part.kind];
        // if (pm != null) {
        //   pm.set(part.name, part as PartBase)
        // }
    }

    partOrder.push([part.kind, part.name]);
    part.raw_part = rawPart
    if (part.route != null) {
      add_route(ctx, routeMap, part.route, part);
    }

    let task: ArgAdder | undefined = add_args(ctx, part, attlist)
    if (task) {
      if (part.kind !== "widget") {
        ctx.NIMPL()
      }
      taskGraph.delay_product(part.name, part as Widget, task, task.dep);
      if (ctx.debug >= 2) {
        console.log(`delayed delegate arg ${task.name} in widget :${part.name}, depends on widget :${task.dep}`)
      }
    }
  }

  // Resolve
  taskGraph.do_all((dep: string) => {
    let inSameTemplate = partMap.widget.has(dep)
    if (inSameTemplate) {
      return [inSameTemplate, partMap.widget.get(dep)!]
    }
    // XXX: find from vfs
  })

  return [{path: config.filename ?? "", partMap, routeMap, partOrder}, builder_session]
}

function add_route(
  ctx: BuilderContext, routeMap: RouteMapType, route: string, part: Part
): void {
  // XXX: path-ro-regexp and add args to part
  routeMap.set(route, {part});
}

function add_args(
  ctx: BuilderContext, part: Part, attlist: AttItem[]
): ArgAdder | undefined {

  let gen = (function* () {
    for (const v of attlist) {
      yield v
    }
  })();

  return add_args_cont(ctx, part, gen)
}

function add_args_cont(
  ctx: BuilderContext, part: Part, gen: Generator<AttItem>
): ArgAdder | undefined {

  for (const att of gen) {
    if (ctx.debug >= 2) {
      console.log('add args from: ', att)
    }
    if (isBareLabeledAtt(att)) {
      //: name = SOMETHING
      let name = att.label.value
      if (att.kind === "bare" || att.kind === "sq" || att.kind === "dq"
          || att.kind === "identplus") {
        //: name="type?default"
        if (ctx.debug) {
          console.log(`kind ${att.kind}: ${name} = ${att.value}`)
        }
        let spec = parse_arg_spec(ctx, att.value, "text")
        let v = build_simple_variable(ctx, name, spec, {
          attItem: att, argNo: part.argMap.size
        })
        part.argMap.set(name, v)
      }
      else if (att.kind === "nest") {
        //: name=[code] name=[delegate]
        if (att.value.length === 0) {
          ctx.token_error(att, `Empty arg declaration`)
        }
        let attlist = ctx.copy_array(att.value)
        //: attlist is [code x y z], [delegate x y z], [delegate:foo x y]
        let fst = attlist.shift()!
        //: fst is code, delegate (or "code", "delegate")
        if (isIdentOnly(fst)
            || !hasLabel(fst) && hasQuotedStringValue(fst)) {
          let [givenTypeName, ...restName] = fst.value.split(/:/)

          const rec = ctx.session.varTypeMap.nested.get(givenTypeName)
          if (rec == null) {
            ctx.token_error(fst, `Unknown type ${givenTypeName} for argument ${name}`)
          }
          if (rec.kind === "callable") {
            //: name=[code]
            let v = rec.fun(ctx, att, part.argMap.size, name, attlist);
            part.argMap.set(name, v)
          }
          else if (rec.kind === "delayed") {
            //: name=[delegate]
            return rec.fun(
              ctx, part, gen, att, part.argMap.size,
              name, restName, attlist
            )
          }
          else {
            ctx.NEVER();
          }
        }
        else {
          ctx.token_error(fst, `Unknown arg declaration`)
        }
      }
      else {
        ctx.token_error(att, `Unknown arg declaration`)
      }
    }
    else if (isIdentOnly(att)) {
      //: nameOnly
      let name = att.value
      let v = build_simple_variable(ctx, name, {typeName: "text"}, {
        attItem: att, argNo: part.argMap.size
      })
      part.argMap.set(name, v)
    }
    else if (att.kind === "entity") {
      // XXX: entity (ArgMacro)
      console.warn(`Ignoring argmacro`)
    }
    else {
      ctx.token_error(att, `Unknown arg declaration`)
    }
  }

  const BODY_NAME = ctx.body_argument_name()
  if (!part.argMap.has(BODY_NAME)) {
    const bodyVar: Variable = {
      typeName: 'widget', is_escaped: true, is_callable: true,
      varName: BODY_NAME, widget: makeWidget(`(${BODY_NAME})`, false),
      from_route: false, is_body_argument: true
    }
    part.argMap.set(BODY_NAME, bodyVar)
  }
}

function build_widget_varialbe(ctx: BuilderContext, att: AttItem, argNo: number, varName: string, attlist: AttItem[]): WidgetVar {
  let widget: Widget = makeWidget(varName, false)
  add_args(ctx, widget, attlist) // XXX: ここで delegate は禁止よね
  return {
    typeName: "widget", widget,
    varName, attItem: att, argNo,
    is_callable: true, from_route: false,
    is_body_argument: ctx.is_body_argument(varName),
    is_escaped: false
  }
}

function build_delegate_variable_adder(
  ctx: BuilderContext, part: Part, gen: Generator<AttItem>,
  att: AttItem, argNo: number,
  name: string, restName: string[], attlist: AttItem[]
): ArgAdder {
  return {
    name: part.name, dep: restName.length ? restName.join(":") : name,
    fun: (widget: Widget): ArgAdder | undefined => {
      let v: DelegateVar = {
        typeName: "delegate", varName: name,
        widget,
        delegateVars: new Map,
        attItem: att, argNo,
        is_callable: true, from_route: false,
        is_body_argument: false,
        is_escaped: false
      }

      part.varMap.set(name, v)

      if (attlist.length) {
        for (const att of attlist) {
          if (! isIdentOnly(att)) {
            ctx.NIMPL()
          }
          let name = att.value
          if (! widget.argMap.has(name)) {
            ctx.throw_error(`No such argument ${name} in delegated widget ${widget.name}`)
          }
          // XXX: deep copy, with original link?
          part.argMap.set(name, widget.argMap.get(name)!)
        }
      } else {
        for (const [name, value] of widget.argMap.entries()) {
          if (part.argMap.has(name)) {
            if (ctx.debug) {
              // XXX: better diag
              console.log(`skipping ${name} because it already exists`)
            }
            continue
          }
          part.argMap.set(name, value)
        }
      }
      return add_args_cont(ctx, part, gen)
    }
  }
}

function createPart(ctx: BuilderContext, rawPart: RawPart): [Part, AttItem[]] | undefined {
  const builder = ctx.session.builders.get(rawPart.kind)
  if (builder == null) {
    ctx.throw_error(`Unknown part kind: ${rawPart.kind}`)
  }
  let attlist = ctx.copy_array(rawPart.attlist)
  return builder.createPart(ctx, attlist)
}

function parse_arg_spec(ctx: BuilderContext, str: string, defaultType: string): VarTypeSpec {
  // XXX: typescript type extension
  let match = /([\/\|\?!])/.exec(str)
  if (match == null) {
    return { typeName: defaultType }
  } else {
    let typeName = match.index ? str.substring(0, match.index) : defaultType;
    let dflag = match[0]
    let defaultValue = str.substring(match.index + 1);
    return { typeName, defaultSpec: [dflag as DefaultFlag, defaultValue] }
  }
}

if (module.id === ".") {
  let [...args] = process.argv.slice(2);
  console.time('load lrxml-js');
  const { parse_long_options } = require("lrxml-js")
  console.timeLog('load lrxml-js');
  const debugLevel = parseInt(process.env.DEBUG ?? '', 10) || 0
  let config = {
    body_argument_name: "body",
    debug: { declaration: debugLevel }
  }
  parse_long_options(args, {target: config})

  const { readFileSync } = require('fs')

  console.time('run');
  for (const fn of args) {
    const [template, _session] = build_template_declaration(
      readFileSync(fn, { encoding: "utf-8" }),
      {filename: fn, ...config}
    )

    const {partMap} = template;
    for (const [name, widget] of partMap.widget) {
      const args = [...widget.argMap.keys()].join(", ");
      const proto = `function render_${name}(${args})`
      console.log(proto);
    }
  }
  console.timeLog('run');
}
