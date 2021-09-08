function doGet(request: GoogleAppsScript.Events.DoGet): GoogleAppsScript.HTML.HtmlOutput {
  let output = HtmlService.createHtmlOutput()
  let CON = {
    append(str: string) {
      output.append(str)
    },
    appendUntrusted(str: string) {
      output.appendUntrusted(yatt.runtime.escape(str))
    }
  }

  $tmpl.index.render_(CON, {})

  return output
}
