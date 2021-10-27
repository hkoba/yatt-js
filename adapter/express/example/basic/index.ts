#!/usr/bin/env ts-node

import express from 'express';

import * as pages from './pages'

{
  const app = express()
  const PORT = process.env.PORT || 8080;

  app.use('/', pages.express(express.Router()))

  // app.get('/*', (req: Request, res: Response, next: NextFunction) => {
  //   console.log(`Got: `, req.path)
  //   res.end(`path: ${req.path}\n`)
  // })

  app.listen(PORT, () => {
    console.log(`Listening http://localhost:${PORT}/`)
  })
}
