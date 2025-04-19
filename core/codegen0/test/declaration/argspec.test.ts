#!/usr/bin/env -S deno test -RE

import {test as cross_test} from "@cross/test"
import {assertEquals} from '@std/assert'

import {parse_arg_spec} from "../../src/declaration/addArgs.ts"

import type { BuilderContext } from '../../src/declaration/context.ts'

{
  const dummyCtx = null as unknown as BuilderContext;

  cross_test("empty string", () => {
    assertEquals(parse_arg_spec(dummyCtx, "", 'text'), {
      typeName: 'text'
    })
  })

  function test(input: string, callback: (s: string) => any, expected: any) {
    cross_test(input, () => {
      assertEquals(callback(input), expected)
    })
  }

  test('text?my default value'
    , (s) => parse_arg_spec(dummyCtx, s, 'text')
    , {
      typeName: 'text',
      defaultSpec: ['?', "my default value"]
    });

  test('value!'
    , (s) => parse_arg_spec(dummyCtx, s, 'text')
    , {
      typeName: 'value',
      defaultSpec: ['!', ""]
    }
  )
}
