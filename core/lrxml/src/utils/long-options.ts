#!/usr/bin/env ts-node

export type Result = {[k: string]: string | boolean | Object | Array<any>}

export type Config = {
  alias?: {[k: string]: string}
  target?: Result
}

type Match = {char?: string, key?: string, value?: string}

export function parse_long_options(argv: string[], config: Config): Result {
  let alias = config.alias ?? {}
  let target = config.target ?? {}

  let match;
  while (argv.length
         && (match = /(?:-(?<char>\w)|--(?:(?<key>[\w\-]+)(?:=(?<value>.*))?)?)/sy
             .exec(argv[0]))) {
    const arg = argv.shift()
    if (arg === "--")
      break
    const mg = match.groups as Match
    let key
    if (mg.char != null) {
      key = alias[mg.char] ?? mg.char
    }
    else if (mg.key != null) {
      key = mg.key
    }
    else {
      throw new Error("Really?"); // Unreachable
    }
    let value
    if (mg.value != null) {
      if (/\{.*\}|\[.*\]|\d(?:\.\d+)?/sy.test(mg.value)) {
        value = JSON.parse(mg.value)
      } else {
        value = mg.value
      }
    }
    else {
      value = true
    }
    target[key] = value
  }
  return target
}

if (module.id === ".") {
  let args = process.argv.slice(2)
  console.log('OPTS: ', parse_long_options(args, {}))
  console.log('REST: ', args)
}
