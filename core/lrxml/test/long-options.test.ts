#!/usr/bin/env -S deno run -A

import {assertEquals} from 'https://deno.land/std/assert/mod.ts'

import { parse_long_options, Config } from '../src/utils/long-options.ts'

//========================================

const it = (argv: string[], config: Config) => {
  const opts = parse_long_options(argv, config)
  return [opts, argv]
}

Deno.test("option terminator --", () => {
  assertEquals(
  it(['--'],{}),
  [{}, []]
)})

Deno.test("basic", () => {
  assertEquals(
  it(['--foo', '--bar=BAR', '--', 'rest'],{}),
  [{foo: true, bar: "BAR"}, ['rest']]
)})

Deno.test("json values", () => {
  assertEquals(
  it(['--foo=3', '--bar={"foo":"bar","baz":"qux"}', '--baz=[3,"foo",4]'],{}),
  [{foo: 3, bar: {"foo":"bar","baz":"qux"}, baz: [3,"foo",4]}, []]
)})

Deno.test("alias", () => {
  assertEquals(
  it(['-d', '-v'], {alias: {d: "debug", v: "verbose"}}),
  [{debug: true, verbose: true}, []]
)});

(() => {
  let target = {foo: false, bar: "BAR"}
  parse_long_options(['--foo'], {target: target})
  Deno.test("default values", () => {
    assertEquals(target, {foo: true, bar: "BAR"})})
})()
