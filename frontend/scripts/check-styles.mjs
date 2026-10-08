import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import postcss from 'postcss'
const root = path.resolve(import.meta.dirname, '../src')
const allowedSelectors = new Set([':root', '.dark', "[data-market='cn']", 'body', 'button', 'a', '*', '*::before', '*::after'])
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) await check(file)
    else if (entry.name.endsWith('.css')) {
      const relative = path.relative(root, file)
      if (relative !== 'index.css' && !/^styles\/(tokens\.[\w-]+|fonts)\.css$/.test(relative)) throw new Error(`Business CSS is forbidden: ${relative}`)
      const tree = postcss.parse(await readFile(file, 'utf8'))
      tree.walkRules((rule) => {
        for (const selector of rule.selector.split(',').map((value) => value.trim())) {
          if (!allowedSelectors.has(selector)) throw new Error(`Business CSS selector is forbidden: ${relative}: ${selector}`)
        }
      })
    }
  }
}
await check(root)
console.log('Global CSS boundary passed; business styling uses Tailwind.')
