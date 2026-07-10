/**
 * Catch-all stub for react-native/Libraries/... deep internal paths on web.
 *
 * Many packages (react-native-gesture-handler, react-native-reanimated,
 * react-native-screens, react-native-svg, etc.) import from RN's internal
 * Libraries/ tree. react-native-web exposes RN's public surface through its
 * own entry point and does not ship the Libraries/ directory at all, so after
 * the react-native → react-native-web alias rewrites the base, every such
 * import becomes an unresolvable path.
 *
 * The regex alias `react-native/Libraries/.*` in .storybook-web/main.ts
 * intercepts all of them before the base alias fires and routes them here.
 *
 * The stub must be BOTH indexable and callable: some consumers read named
 * exports off it, others invoke the default as a factory — e.g. react-native-svg
 * does `codegenNativeComponent('RNSVGCircle', ...)` at module-init time. So the
 * Proxy wraps a no-op function target: `get` yields the stub for any key and
 * `apply`/`construct` return the stub again, so arbitrarily chained access and
 * calls all resolve without throwing.
 *
 * `__esModule` MUST report falsy: Rolldown's `__toESM` interop only synthesises a
 * `.default` on the namespace when the source is NOT flagged `__esModule`, and it
 * builds that namespace by copying *own enumerable* props — a Proxy `get` trap is
 * neither, so a truthy `__esModule` would leave `.default` undefined and break
 * `import Foo from '...'; Foo(...)` factory calls. Runtime behaviour is irrelevant
 * since these internal APIs are never reached in a web Storybook render.
 */
const noop = function () {}
const stub = new Proxy(noop, {
  get(_, key) {
    if (key === '__esModule') return undefined
    // Primitive coercion: some consumers stringify stubbed values (e.g.
    // `String(parentName)` or `${x}`). Returning the callable `stub` for
    // Symbol.toPrimitive makes coercion throw "toPrimitive returned an object",
    // so hand back a real primitive here. Any other symbol key returns undefined
    // so the value isn't treated as iterable/thenable/etc.
    if (key === Symbol.toPrimitive) return () => ''
    if (typeof key === 'symbol') return undefined
    return stub
  },
  apply() {
    return stub
  },
  construct() {
    return stub
  },
})

module.exports = stub
