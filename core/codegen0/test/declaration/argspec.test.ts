#!/usr/bin/env -S deno test -RE

import {test as cross_test} from "@cross/test"
import {assertEquals} from '@std/assert'

import {parse_arg_spec} from "../../src/declaration/addArgs.ts"
import {ParserContext} from '@yatt/lrxml'


import type { BuilderContext } from '../../src/declaration/context.ts'
import type { RangeLine } from "../../../lrxml/src/context.ts";
import type { YattParams } from "../../src/config.ts";

{
  const dummyCtx = (source: string) => {
    const params = {
      namespace: ['yatt'],
      debug: {}
    } as YattParams
    return {
      session: {
        params,
      },
      parserContext() {
        return new ParserContext({
          patterns: {},
          source,
          filename: "dummy",
          params
        })
      }
    } as BuilderContext
  };

  cross_test("empty string", () => {
    assertEquals(parse_arg_spec(dummyCtx(""), "", 'text', dummyRange("")), {
      typeName: 'text'
    })
  })

  test('text?my default value'
    , (s) => parse_arg_spec(dummyCtx(s), s, 'text', dummyRange(s))
    , {
      typeName: 'text',
      defaultSpec: {dflag: '?', text: "my default value", children: [{start: 5, end: 21, kind: "text", value: "my default value"}]}
    });

  test('value!'
    , (s) => parse_arg_spec(dummyCtx(s), s, 'text', dummyRange(s))
    , {
      typeName: 'value',
      defaultSpec: {dflag: '!', text: "", children: []}
    }
  )
}

function test(input: string, callback: (s: string) => any, expected: any) {
  cross_test(input, () => {
    assertEquals(callback(input), expected)
  })
}

function dummyRange(s: string): RangeLine {
  return {line: 1, start: 0, end: s.length}
}
