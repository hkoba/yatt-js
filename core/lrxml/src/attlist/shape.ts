import type { AttStringItem } from "../attstring/parse.ts";
import type { AttElement } from "../template/parse.ts";
import type { AttIdentOnly, AttItem, AttLabeled, AttLabeledByIdent, AttLabeledNested, AttPositional, EntTermWComment, IdentplusTerm, NestedTerm, StringTerm, Term } from "./parse.ts";

export type TermShape =
| {shape: "string", text: string, quoted: boolean,
  children: AttStringItem[], node: StringTerm}
| {shape: "ident", text: string, has_three_colon: boolean, node: IdentplusTerm}
| {shape: "nest", items: AttItem[], node: NestedTerm}
| {shape: "entity", node: EntTermWComment}

type TermShapeOf<T extends Term> =
  T extends StringTerm ? Extract<TermShape, {shape: "string"}> :
  T extends IdentplusTerm ? Extract<TermShape, {shape: "ident"}> :
  T extends NestedTerm ? Extract<TermShape, {shape: "nest"}> :
  T extends EntTermWComment ? Extract<TermShape, {shape: "entity"}> :
  TermShape

// has_three_colon の時、term.value は ":::" を含む（term_identplus が range 全体から作るため）。
// view の text/name は識別子そのものに正規化する。生の値が要る消費者は node.value を見る。
function identText(term: IdentplusTerm): string {
  return term.has_three_colon ? term.value.substring(3) : term.value
}

export function termShape<T extends Term>(term: T): TermShapeOf<T>
export function termShape(term: Term): TermShape {
  switch (term.kind) {
    case "identplus": {
      return {shape: "ident", text: identText(term), node: term, has_three_colon: term.has_three_colon}
    }
    case "sq":
    case "dq":
    case "bare": {
      return {shape: "string", text: term.value, node: term, quoted: term.kind !== "bare", children: term.children};
    }
    case "nest": {
      return {shape: "nest", items: term.value, node: term};
    }
    case "entity": {
      return {shape: "entity", node: term}
    }
  }
}

export type AttShape =
| {shape: "identOnly", name: string
  , has_three_colon: boolean, node: AttIdentOnly}
| {shape: "labeled", name: string, nameNode: IdentplusTerm,
  value: TermShape, node: AttLabeledByIdent}
| {shape: "nestLabeled", label: NestedTerm
  , value: TermShape, node: AttLabeledNested}
| {shape: "positional"
  , value: Exclude<TermShape, {shape: "ident"}>, node: AttPositional}
| {shape: "attelem", path: string[], node: AttElement}

function labelIsIdent(att: AttLabeled): att is AttLabeledByIdent {
  return att.label.kind === 'identplus'
}

export function attShape(att: AttItem | AttElement): AttShape {
  if (att.kind === "attelem") {
    // AttElement
    // <:yatt:foo>..</:yatt:foo>, <:yatt:foo/>...
    return {shape: "attelem", path: att.path, node: att}
  } // AttItem
  else if (att.label == null) {
    // AttPositional
    if (att.kind === "identplus") {
      // foo
      return {shape: "identOnly", has_three_colon: att.has_three_colon
        , name: identText(att), node: att}
    }
    else {
      // "foo" 'foo' other*non*ident
      return {shape: "positional", node: att, value: termShape(att)}
    }
  } else {
    // AttLabeled
    if (labelIsIdent(att)) { // XXX: ここは att.label.kind === 'identplus' じゃだめ
      // foo=".." foo='..' foo=.. foo=&yatt:bar; foo=[..]
      const name: string = att.label.value;
      const nameNode: IdentplusTerm = att.label;
      const value: TermShape = termShape(att);
      const node: AttLabeledByIdent = att;
      return {shape: "labeled", name, nameNode, value, node}
    }
    else {
      // [..]=...
      const label = att.label;
      const value: TermShape = termShape(att);
      const node: AttLabeledNested = att;
      return {shape: "nestLabeled", label, value, node}
    }
  }
}
