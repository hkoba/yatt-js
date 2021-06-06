#!/usr/bin/env ts-node

import tap from 'tap'

import { parse_long_options, Config } from '../src/utils/long-options'

//========================================

const it = (argv: string[], config: Config) => {
    const opts = parse_long_options(argv, config)
    return [opts, argv]
}

tap.same(
    it(['--'],{}),
    [{}, []]
)

tap.same(
    it(['--foo', '--bar=BAR', '--', 'rest'],{}),
    [{foo: true, bar: "BAR"}, ['rest']]
)

tap.same(
    it(['--foo=3', '--bar={"foo":"bar","baz":"qux"}', '--baz=[3,"foo",4]'],{}),
    [{foo: 3, bar: {"foo":"bar","baz":"qux"}, baz: [3,"foo",4]}, []]
)

tap.same(
    it(['-d', '-v'], {alias: {d: "debug", v: "verbose"}}),
    [{debug: true, verbose: true}, []]
)
