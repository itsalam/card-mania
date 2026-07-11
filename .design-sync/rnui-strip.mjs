// Ported verbatim (TS types removed) from .storybook-web/main.ts —
// strips type-only import/export bindings from react-native-ui-lib/src/*.js so
// esbuild's ESM binding analysis doesn't hard-error on names that only ever
// existed as TypeScript types in the compiled-to-JS source.
import fs from 'node:fs'
import path from 'node:path'

function resolveRelative(dir, specifier) {
  const p = path.resolve(dir, specifier)
  if (!path.extname(p)) {
    if (fs.existsSync(p + '.js')) return p + '.js'
    const idx = path.join(p, 'index.js')
    if (fs.existsSync(idx)) return idx
    return null
  }
  return p
}

const deepExportCache = new Map()

function getDeepExportedNames(filePath, visiting = new Set()) {
  if (deepExportCache.has(filePath)) return deepExportCache.get(filePath)
  if (visiting.has(filePath)) return new Set()
  const vis = new Set(visiting)
  vis.add(filePath)

  let code
  try {
    code = fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }

  const names = new Set()

  if (code.includes('Object.defineProperty(exports')) {
    names.add('default')
    for (const m of code.matchAll(/\bexports\.([\w$]+)\s*=/g)) {
      if (m[1] !== '__esModule') names.add(m[1])
    }
    for (const m of code.matchAll(/Object\.defineProperty\(exports,\s*['"](\w+)['"]/g)) {
      if (m[1] !== '__esModule') names.add(m[1])
    }
    deepExportCache.set(filePath, names)
    return names
  }

  const dir = path.dirname(filePath)
  const live = new Set()

  if (/\bexport\s+default\b/.test(code)) {
    live.add('default')
    names.add('default')
  }
  for (const m of code.matchAll(/\bexport\s+(?:const|let|var|function|class|async\s+function)\s+([\w$]+)/g)) {
    live.add(m[1])
    names.add(m[1])
  }
  for (const m of code.matchAll(/^\s*(?:const|let|var|function|class|async\s+function)\s+([\w$]+)/gm)) {
    live.add(m[1])
  }
  for (const m of code.matchAll(/\bimport\s+([^'"]+?)\s*from\s*(['"])(\.\.?\/[^'"]+)\2/g)) {
    const importSpec = m[1]
    const target = resolveRelative(dir, m[3])
    if (!target) continue
    const src = getDeepExportedNames(target, vis)
    if (!src) continue
    const defaultMatch = importSpec.match(/^([\w$]+)\s*(?:,|$)/)
    if (defaultMatch && src.has('default')) live.add(defaultMatch[1])
    const namedMatch = importSpec.match(/\{([^}]+)\}/)
    if (namedMatch) {
      for (const n of namedMatch[1].split(',').map((s) => s.trim()).filter(Boolean)) {
        const orig = n.split(/\s+as\s+/)[0].trim()
        const alias = n.split(/\s+as\s+/).pop().trim()
        if (src.has(orig)) live.add(alias)
      }
    }
  }
  for (const m of code.matchAll(/\bexport\s*\{([^}]+)\}\s*from\s*(['"])(\.\.?\/[^'"]+)\2/g)) {
    const target = resolveRelative(dir, m[3])
    if (!target) continue
    const src = getDeepExportedNames(target, vis)
    if (!src) continue
    for (const n of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
      const orig = n.split(/\s+as\s+/)[0].trim()
      const alias = n.split(/\s+as\s+/).pop().trim()
      if (src.has(orig)) names.add(alias)
    }
  }
  for (const n of live) names.add(n)
  deepExportCache.set(filePath, names)
  return names
}

export function stripRnuiTypeReexports(code, id) {
  if (!id.includes('/react-native-ui-lib/src/')) return null
  if (!code.includes('export') && !code.includes('import')) return null
  const dir = path.dirname(id)
  const strippedImportNames = new Set()
  let result = code

  result = result.replace(
    /export\s*\{([^}]+)\}\s*from\s*(['"])(\.\.?\/[^'"]+)\2/g,
    (match, names, quote, specifier) => {
      const targetPath = resolveRelative(dir, specifier)
      if (!targetPath) return match
      const available = getDeepExportedNames(targetPath)
      if (!available) return match
      const kept = names.split(',').map((n) => n.trim()).filter((n) => {
        if (!n) return false
        const orig = n.split(/\s+as\s+/)[0].trim()
        return available.has(orig)
      })
      if (kept.length === 0) return ''
      return `export { ${kept.join(', ')} } from ${quote}${specifier}${quote}`
    }
  )

  result = result.replace(
    /\bimport\s+([^'"]+?)\s*from\s*(['"])(\.\.?\/[^'"]+)\2/g,
    (match, importSpec, quote, specifier) => {
      const namedMatch = importSpec.match(/\{([^}]+)\}/)
      if (!namedMatch) return match
      const targetPath = resolveRelative(dir, specifier)
      if (!targetPath) return match
      const available = getDeepExportedNames(targetPath)
      if (!available) return match
      const keptNamed = []
      for (const n of namedMatch[1].split(',').map((s) => s.trim()).filter(Boolean)) {
        const orig = n.split(/\s+as\s+/)[0].trim()
        if (available.has(orig)) {
          keptNamed.push(n)
        } else {
          strippedImportNames.add(n.split(/\s+as\s+/).pop().trim())
        }
      }
      const defaultMatch = importSpec.match(/^([\w$]+)\s*,/)
      const defaultPart = defaultMatch ? defaultMatch[1] : null
      if (keptNamed.length === 0 && !defaultPart) return ''
      if (keptNamed.length === 0 && defaultPart)
        return `import ${defaultPart} from ${quote}${specifier}${quote}`
      const namedPart = `{ ${keptNamed.join(', ')} }`
      const spec = defaultPart ? `${defaultPart}, ${namedPart}` : namedPart
      return `import ${spec} from ${quote}${specifier}${quote}`
    }
  )

  if (strippedImportNames.size > 0) {
    result = result.replace(/export\s*\{([^}]+)\}(?!\s*from)/g, (match, names) => {
      const kept = names.split(',').map((n) => n.trim()).filter((n) => {
        if (!n) return false
        const orig = n.split(/\s+as\s+/)[0].trim()
        return !strippedImportNames.has(orig)
      })
      if (kept.length === 0) return ''
      return `export { ${kept.join(', ')} }`
    })
  }

  return result === code ? null : result
}
