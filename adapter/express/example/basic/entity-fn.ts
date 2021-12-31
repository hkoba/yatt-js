#!/usr/bin/env ts-node

import {yatt} from 'yatt-codegen0/lib/yatt'

import type {Request, Response} from 'express'

export type Connection = yatt.runtime.Connection & {
  buffer: string
  req: Request
  res: Response
}

export function makeConnection(req: Request, res: Response): Connection {
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
  return this.req.params[name]
}

