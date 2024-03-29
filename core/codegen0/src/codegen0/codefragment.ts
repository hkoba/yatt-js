import type {Node, AnonNode} from 'lrxml'

export type CodeFragmentPayload = {code: string, source?: Node | AnonNode}

export type CodeFragmentRec =
  {kind: 'name'} & CodeFragmentPayload |
  {kind: 'other'} & CodeFragmentPayload

export type CodeFragment = string | CodeFragmentRec | CodeFragment[]

export function isCodeFragment<T>(arg: CodeFragment | T): arg is CodeFragment {
  if (typeof(arg) === "string")
    return true
  if (arg instanceof Array)
    return true
  const kind = (arg as CodeFragmentRec).kind;
  return kind === 'name' || kind === 'other'
}

export function joinAsArray<T>(sep: T, list: T[]): T[] {
  return list.reduce((prev: T[], cur: T) => {
    if (prev.length) {
      prev.push(sep)
    }
    prev.push(cur);
    return prev;
  }, [])
}
