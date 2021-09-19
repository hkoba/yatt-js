function doGet(request: {pathInfo?: string} & GoogleAppsScript.Events.DoGet): GoogleAppsScript.HTML.HtmlOutput {
  let output = HtmlService.createHtmlOutput()
  let CON = {
    append: output.append.bind(output),
    appendUntrusted: output.appendUntrusted.bind(output)
  }

  const pathInfo = request.pathInfo ?? "index";
  const [fileName, ...rest] = pathInfo.split('/')

  // XXX
  const page = ($tmpl as any)[fileName]
  if (page == null) {
    $tmpl.error.render_(CON, {msg: `Page not found: ${fileName}`})
  } else {
    page.render_(CON, {})
  }

  return output
}
