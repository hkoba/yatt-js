#!/usr/bin/env ts-node

// yatt.ts should be copied to the same directory
import {yatt} from './yatt'

import type {Request, Response} from 'express'

export type Connection = yatt.runtime.Connection & {
  buffer: string
  req: Request
  res: Response
}

export function makeConnection(req: Request, res: Response): Connection {
  console.log('params:', req.params)
  console.log('query:', req.query)
  return {
    req, res,
    buffer: "",
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
