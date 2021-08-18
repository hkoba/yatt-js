import {Variable} from '../declaration'

export class VarScope extends Map<string, Variable> {
  constructor(vars?: Map<string, Variable>, public parent?: VarScope) {
    super();
    if (vars != null) {
      for (const [k, v] of vars) {
        this.set(k, v)
      }
    }
  }

  lookup(varName: string): Variable | undefined {
    if (this.has(varName)) {
      return this.get(varName)
    }
    else if (this.parent) {
      return this.parent.lookup(varName)
    }
  }
}
