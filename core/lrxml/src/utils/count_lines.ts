// https://stackoverflow.com/questions/8488729/how-to-count-the-number-of-lines-of-a-string-in-javascript
// https://stackoverflow.com/a/66143344/1822437

export function lineNumber(str: string): number {
  return count_newlines(str) + 1
}

export function count_newlines(str: string): number {
  return str.length - str.replace(/\n/g, "").length;
}
