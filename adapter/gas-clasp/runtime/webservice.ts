function doGet(request: yatt.Request): GoogleAppsScript.HTML.HtmlOutput {
  const pathInfo = request.pathInfo ?? "index";
  const staticFn = _lookup_static(pathInfo)

  if (staticFn) {
    return HtmlService.createHtmlFromFile(staticFn)
  }

  const [fileName, ...rest] = pathInfo.split('/')

  let output = HtmlService.createHtmlOutput()
  let CON = {
    request,
    append: output.append.bind(output),
    appendUntrusted: output.appendUntrusted.bind(output)
  }

  const page = ($tmpl as any)[fileName]
  // XXX: error.ytjs が無い時の fallback がほしい
  if (page == null) {
    $tmpl.error.render_(CON, {msg: `Page not found: ${fileName}`})
  } else {
    // XXX safe parameter mapping
    page.render_(CON, {})
  }

  return output
}

function _lookup_static(fileName): string | undefined {
  if ($staticMap[fileName]) {
    return fileName
  } else {
    const fn = fileName + '.html'
    if ($staticMap[fn]) {
      return fn
    }
  }
}
