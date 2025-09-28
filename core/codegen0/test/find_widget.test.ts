#!/usr/bin/env -S deno test -RE

import {test} from "@cross/test"
import {assertEquals} from '@std/assert'

import * as path from "node:path"
import * as process from "node:process"

import {rootname} from '../src/path.ts'


import {cgenSettings, freshCGenSession} from '../src/codegen0/context.ts'
import { get_template_declaration
  , type DeclState, type Widget } from '../src/declaration/index.ts'

import {find_widget} from '../src/part-finder/find.ts'

const testDir = rootname(rootname(new URL(import.meta.url).pathname)) + '.d'

const entry_part = (entry: DeclState, name: string): Widget | undefined => {
  return entry.template.partMap.widget.get(name)
}

const widget_text = (widget: Widget | undefined): string | undefined => {
  return widget?.payloads[0].data
}

const debug = parseInt(process.env.DEBUG ?? '', 10) || 0

{
  const rootDir = path.join(testDir, '1')
  const session = freshCGenSession(cgenSettings('populator', {
    rootDir,
    ext_public: ".yatt",
    debug: {
      declaration: debug, cache: debug
    }
  }))

  test("index => foo", async () => {
    const entry = await get_template_declaration(session, path.resolve(rootDir, 'index.yatt'))
    if (! entry) {
      throw new Error(`Can't find index.yatt`)
    }

    assertEquals(widget_text(entry_part(entry, '')), `Index\n`)

    assertEquals(widget_text((await find_widget(session, entry.template, ['foo']))?.widget)
      , `AAA\nBBB\n`)

    assertEquals(widget_text((await find_widget(session, entry.template, ['foo', 'bar']))?.widget)
      , `CCC\n`)
  })

  test("coexisting foo.yatt and foo/", async () => {
    const entry = await get_template_declaration(session, path.resolve(rootDir, 'foo.yatt'))

    if (! entry) {
      throw new Error(`Can't load foo.yatt`)
    }

    assertEquals(widget_text(entry_part(entry, '')), `AAA\nBBB\n`)

    assertEquals(widget_text((await find_widget(session, entry.template, ['bar']))?.widget)
      , `CCC\n`)

    assertEquals(widget_text((await find_widget(session, entry.template, ['foo', 'baz']))?.widget)
      , `EEE\n`)

    assertEquals(widget_text((await find_widget(session, entry.template, ['qux']))?.widget)
      , `FFF\n`)
  })
}

{
  const rootDir = path.join(testDir, '2')
  const session = freshCGenSession(cgenSettings('populator', {
    rootDir,
    ext_public: [".ytjs", ".yatt", ".html"],
    debug: {
      declaration: debug, cache: debug
    }
  }))

  test("ext_public as array", async () => {
    const entry = await get_template_declaration(session, path.resolve(rootDir, 'index.ytjs'))
    if (! entry) {
      throw new Error(`Can't find index.yatt`)
    }

    assertEquals(widget_text(entry_part(entry, '')), `Index\n`)

    assertEquals(widget_text((await find_widget(session, entry.template, ['foo']))?.widget)
      , `FOO\n`)

    assertEquals(widget_text((await find_widget(session, entry.template, ['bar']))?.widget)
      , `BAR\n`)

    assertEquals(widget_text((await find_widget(session, entry.template, ['baz']))?.widget)
      , `BAZ\n`)
  })
}
