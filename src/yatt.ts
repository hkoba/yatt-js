#!/usr/bin/env ts-node

export namespace yatt {}

export namespace yatt.runtime {
  export interface Connection {
    append(str: string): void;
  }
}
