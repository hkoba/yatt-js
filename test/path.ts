#!/usr/bin/env ts-node

import tap from 'tap';

import {longestPrefixDir, templatePath} from '../src/path'

{
  tap.same(templatePath('foo/bar/baz.js'), ['baz']);
  tap.same(templatePath('foo/bar/baz.js', 'foo/'), ['bar', 'baz']);

  tap.same(templatePath('/tmp/zsh3HWHBX'), ['zsh3HWHBX']);
  tap.same(templatePath('/usr/src/foo/bar.js', '/usr/src/'), ['foo', 'bar']);
}

{
  tap.same(longestPrefixDir(['foo.js', 'foo.js']), '');
  tap.same(longestPrefixDir(['foo.js', 'bar.js']), '');

  tap.same(longestPrefixDir(['foo/bar/baz.js', 'foo/bar/qux.js']), 'foo/bar/');
  tap.same(longestPrefixDir(['foo/bar/baz.js', 'foo/qux.js']), 'foo/');
}
