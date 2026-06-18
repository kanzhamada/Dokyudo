---
name: deno-best-practices
description: Style guide and best practices for Deno development. Covers naming conventions, export rules, JSDoc formatting, and error message guidelines. Use this skill when writing or refactoring Deno TypeScript code.
---

# Deno Style Guide

This document outlines the style guide and best practices for writing clean and consistent code in Deno.

### Use underscores, not dashes in filenames

Example: Use `file_server.ts` instead of `file-server.ts`.

### Add tests for new features

Each module should contain or be accompanied by tests for its public functionality.

### TODO Comments

TODO comments should usually include an issue or the author's github username in parentheses. Example:

```ts
// TODO(ry): Add tests.
// TODO(#123): Support Windows.
// FIXME(#349): Sometimes panics.
```

### Meta-programming is discouraged. Including the use of Proxy

Be explicit, even when it means more code. There are some situations where it may make sense to use such techniques, but in the vast majority of cases it does not.

### TypeScript

#### Use TypeScript instead of JavaScript

#### Do not use the filename `index.ts`/`index.js`

Deno does not treat "index.js" or "index.ts" in a special way. By using these filenames, it suggests that they can be left out of the module specifier when they cannot. This is confusing.

If a directory of code needs a default entry point, use the filename `mod.ts`. The filename `mod.ts` follows Rust's convention, is shorter than `index.ts`, and doesn't come with any preconceived notions about how it might work.

#### Exported functions: max 2 args, put the rest into an options object

When designing function interfaces, stick to the following rules:

1. A function that is part of the public API takes 0-2 required arguments, plus (if necessary) an options object (so max 3 total).
2. Optional parameters should generally go into the options object.
3. The 'options' argument is the only argument that is a regular 'Object'. Other arguments can be objects, but they must be distinguishable from a 'plain' Object at runtime (e.g., arrays, Maps).

```ts
// GOOD.
export interface ResolveOptions {
  family?: "ipv4" | "ipv6";
  timeout?: number;
}
export function resolve(
  hostname: string,
  options: ResolveOptions = {},
): IPAddress[] {}
```

#### Export all interfaces that are used as parameters to an exported member

Whenever you are using interfaces that are included in the parameters or return type of an exported member, you should export the interface that is used. 

#### Minimize dependencies; do not make circular imports

Be careful not to introduce circular imports. Keep internal dependencies simple and manageable.

#### If a filename starts with an underscore: `_foo.ts`, do not link to it

If an internal module is necessary but its API is not meant to be stable or linked to, prefix it with an underscore. By convention, only files in its own directory should import it.

#### Use JSDoc for exported symbols

Every exported symbol ideally should have a documentation line.
If possible, use a single line for the JSDoc. Example:

```ts
/** foo does bar. */
export function foo() {
  // ...
}
```

Every exported function should have a `@param` tag for each parameter with a description. The `@param` tag should not include the `type` as TypeScript is already strongly-typed.

```ts
/**
 * Resolves a path to a file.
 * @param path The path to resolve.
 * @param base The base directory to resolve from.
 */
```

#### Resolve linting problems using directives

If the task requires code that is non-conformant to linter use `deno-lint-ignore <code>` directive to suppress the warning.

```typescript
// deno-lint-ignore no-explicit-any
let x: any;
```

#### Each module should come with a test module

Every module with public functionality `foo.ts` should come with a test module `foo_test.ts`.

#### Unit Tests should be explicit

For a better understanding of the tests, function should be correctly named. Example of test:

```ts
import { assertEquals } from "@std/assert";
import { foo } from "./mod.ts";

Deno.test("foo() returns bar object", function () {
  assertEquals(foo(), { bar: "bar" });
});
```

#### Top-level functions should not use arrow syntax

Top-level functions should use the `function` keyword. Arrow syntax should be limited to closures.

Bad:
```ts
export const foo = (): string => {
  return "bar";
};
```

Good:
```ts
export function foo(): string {
  return "bar";
}
```

#### Error Messages

User-facing error messages raised from JavaScript / TypeScript should be clear, concise, and consistent. Error messages should be in sentence case but should not end with a period. 

Error message styles that should be followed:
1. Messages should start with an upper case.
2. Messages should not end with a period.
3. Message should use quotes for values for strings (`"hello, world"`).
4. Message should state the action that led to the error (`Cannot parse input x`).
5. Active voice should be used (`Cannot parse input x`).
6. Messages should not use contractions (`Cannot parse input x`).
7. Messages should use a colon when providing additional information. Periods should never be used.
8. Additional information should describe the current state, and ideally the desired state in affirmative voice.

### Prefer # over private keyword

We prefer the private fields (`#`) syntax over `private` keyword of TypeScript in the codebase. The private fields make the properties and methods private even at runtime.

Good:
```ts
class MyClass {
  #foo = 1;
  #bar() {}
}
```

### Naming convention

Use `camelCase` for functions, methods, fields, and local variables. Use `PascalCase` for classes, types, interfaces, and enums. Use `UPPER_SNAKE_CASE` for static top-level items, such as strings, numbers, etc.

When the names are in `camelCase` or `PascalCase`, always follow the rules of them even when the parts of them are acronyms.

Good:
```ts
class HttpObject {}
function convertUrl(url: URL) {
  return url.href;
}
```

Bad:
```ts
class HTTPObject {}
function convertURL(url: URL) {
  return url.href;
}
```
