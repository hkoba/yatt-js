#!/usr/bin/env ts-node

// yatt.ts should be copied to the same directory
import {yatt} from '../yatt'

import type {Request, Response} from 'express'

export type Connection = yatt.runtime.Connection & {
  buffer: string
  req: Request
  res: Response
  subitem?: yatt.runtime.SubItemType
}

export function makeConnection(req: Request, res: Response): Connection {

  if (process.env['DEBUG']) {
    console.log('params:', req.params)
    console.log('query:', req.query)
    console.log('body:', req.body)
  }

  const bodySubItem = yatt.runtime.extract_sigil_from(req.body)
  const querySubItem = yatt.runtime.extract_sigil_from(req.query)

  if (process.env['DEBUG']) {
    console.log('subitem-body: ', bodySubItem, 'query:', querySubItem)
  }

  return {
    req, res,
    buffer: "",
    subitem: bodySubItem ?? querySubItem,
    append(this: Connection, str: string) {
      this.buffer += str;
    },
    appendUntrusted(this: Connection, str?: string) {
      if (str == null) return;
      this.buffer += yatt.runtime.escape(str)
    }
  }
}

export function param(this: Connection, name: string): any {
  return this.req.params[name] ?? ''
}

export function query(this: Connection, name: string): any {
  return this.req.query[name] ?? ''
}

export function req(this: Connection): Request {
  return this.req
}
