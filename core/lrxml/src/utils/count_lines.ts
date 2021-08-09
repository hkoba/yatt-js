// https://stackoverflow.com/questions/8488729/how-to-count-the-number-of-lines-of-a-string-in-javascript
// https://stackoverflow.com/a/66143344/1822437

export function lineNumber(str: string): number {
  return count_newlines(str) + 1
}

export function count_newlines(str: string): number {
  return str.length - str.replace(/\n/g, "").length;
}

export function extract_line(str: string, lastNl: number, colNo: number): string {
  const startOfLine = lastNl+1;
  const bottomHalf = str.substring(startOfLine)
  const nextNl = bottomHalf.indexOf('\n')
  const line = str.substring(lastNl, nextNl >= 0 ? startOfLine + nextNl : undefined)
  // console.log(`lastNl: ${lastNl} nextNl: ${nextNl} colNo: ${colNo} line: ${line}`);
  const notab = line.replace(/[^\t]/g, ' ');
  return line + '\n' + notab.substr(0, colNo-1) + '^';
}

export function extract_prefix_spec(src: string, index: number): [number, number, number] {
  const prefix = src.substring(0, index)
  const lineNo = lineNumber(prefix)
  const lastNl = prefix.lastIndexOf('\n')
  const colNo = index - lastNl
  return [lastNl, lineNo, colNo]
}
