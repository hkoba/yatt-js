function doGet(request: $yatt.runtime.Request): GoogleAppsScript.HTML.HtmlOutput {
  const pathInfo = request.pathInfo ?? "index";
  const staticFn = _lookup_static(pathInfo)

  if (staticFn) {
    return HtmlService.createHtmlOutputFromFile(staticFn)
  }

  const [fileName, ...rest] = pathInfo.split('/')

  let output = HtmlService.createHtmlOutput()
  let CON = {
    request,
    output,
    append: output.append.bind(output),
    appendUntrusted: output.appendUntrusted.bind(output),
    appendRuntimeValue: (val: any) => {
      if (typeof val === "string") {
        output.appendUntrusted(val)
      } else {
        output.append($yatt.runtime.escape(val))
      }
    }
  }

  const page = ($yatt.$tmpl as any)[fileName]
  // XXX: error.ytjs が無い時の fallback がほしい
  if (page == null) {
    $yatt.$tmpl.error.render_(CON, {msg: `Page not found: ${fileName}`})
  } else {
    // XXX safe parameter mapping
    page.render_(CON, {})
  }

  return output
}

function _lookup_static(fileName): string | undefined {
  if ($yatt.$staticMap[fileName]) {
    return fileName
  } else {
    const fn = fileName + '.html'
    if ($yatt.$staticMap[fn]) {
      return fn
    }
  }
}
