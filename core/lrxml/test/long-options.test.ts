#!/usr/bin/env -S deno test -A

import {test} from "@cross/test"
import {assertEquals} from '@std/assert'

import { parse_long_options, Config } from '../src/utils/long-options.ts'

//========================================

const it = (argv: string[], config: Config) => {
  const opts = parse_long_options(argv, config)
  return [opts, argv]
}

test("option terminator --", () => {
  assertEquals(
  it(['--'],{}),
  [{}, []]
)})

test("basic", () => {
  assertEquals(
  it(['--foo', '--bar=BAR', '--', 'rest'],{}),
  [{foo: true, bar: "BAR"}, ['rest']]
)})

test("json values", () => {
  assertEquals(
  it(['--foo=3', '--bar={"foo":"bar","baz":"qux"}', '--baz=[3,"foo",4]'],{}),
  [{foo: 3, bar: {"foo":"bar","baz":"qux"}, baz: [3,"foo",4]}, []]
)})

test("alias", () => {
  assertEquals(
  it(['-d', '-v'], {alias: {d: "debug", v: "verbose"}}),
  [{debug: true, verbose: true}, []]
)});

(() => {
  let target = {foo: false, bar: "BAR"}
  parse_long_options(['--foo'], {target: target})
  test("default values", () => {
    assertEquals(target, {foo: true, bar: "BAR"})})
})()
