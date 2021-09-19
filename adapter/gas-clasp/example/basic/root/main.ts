function doGet(request: GoogleAppsScript.Events.DoGet): GoogleAppsScript.HTML.HtmlOutput {
  let output = HtmlService.createHtmlOutput()
  let CON = {
    append: output.append.bind(output),
    appendUntrusted: output.appendUntrusted.bind(output)
  }

  $tmpl.index.render_(CON, {})

  return output
}
