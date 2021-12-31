#!/usr/bin/env ts-node

import {yatt} from 'yatt-codegen0/lib/yatt'

import type {Request, Response} from 'express'

export type Connection = yatt.runtime.Connection & {
  req: Request
  res: Response
}

export function param(this: Connection, name: string): any {
  return this.req.params[name]
}

