---
name: svelte-core-bestpractices
description: Best practices for writing fast, robust Svelte 5 and SvelteKit applications. Covers runes ($state, $derived, $effect), snippets, context, and performance optimization techniques. Use this skill when writing Svelte components or optimizing SvelteKit applications.
---

# Svelte Best Practices

This document outlines some best practices that will help you write fast, robust Svelte apps.

## `$state`

Only use the `$state` rune for variables that should be reactive — in other words, variables that cause an `$effect`, `$derived` or template expression to update. Everything else can be a normal variable.

Objects and arrays (`$state({...})` or `$state([...])`) are made deeply reactive, meaning mutation will trigger updates. This has a trade-off: in exchange for fine-grained reactivity, the objects must be proxied, which has performance overhead. In cases where you're dealing with large objects that are only ever reassigned (rather than mutated), use `$state.raw` instead. This is often the case with API responses, for example.

## `$derived`

To compute something from state, use `$derived` rather than `$effect`:

```javascript
// do this
let square = $derived(num * num);

// don't do this
let square;

$effect(() => {
	square = num * num;
});
```

`$derived` is given an expression, not a function. If you need to use a function (because the expression is complex, for example) use `$derived.by`.

Deriveds are writable — you can assign to them, just like `$state`, except that they will re-evaluate when their expression changes.

If the derived expression is an object or array, it will be returned as-is — it is not made deeply reactive. You can, however, use `$state` inside `$derived.by` in the rare cases that you need this.

## `$effect`

Effects are an escape hatch and should mostly be avoided. In particular, avoid updating state inside effects.

- If you need to sync state to an external library such as D3, it is often neater to use `{@attach ...}`
- If you need to run some code in response to user interaction, put the code directly in an event handler or use a function binding as appropriate
- If you need to log values for debugging purposes, use `$inspect`
- If you need to observe something external to Svelte, use `createSubscriber`

Never wrap the contents of an effect in `if (browser) {...}` or similar — effects do not run on the server.

## `$props`

Treat props as though they will change. For example, values that depend on props should usually use `$derived`:

```javascript
let { type } = $props();

// do this
let color = $derived(type === 'danger' ? 'red' : 'green');

// don't do this — `color` will not update if `type` changes
let color = type === 'danger' ? 'red' : 'green';
```

## `$inspect.trace`

`$inspect.trace` is a debugging tool for reactivity. If something is not updating properly or running more than it should you can add `$inspect.trace(label)` as the first line of an `$effect` or `$derived.by` (or any function they call) to trace their dependencies and discover which one triggered an update.

## Events

Any element attribute starting with `on` is treated as an event listener:

```html
<button onclick={() => {...}}>click me</button>

<!-- attribute shorthand also works -->
<button {onclick}>...</button>

<!-- so do spread attributes -->
<button {...props}>...</button>
```

If you need to attach listeners to `window` or `document` you can use `<svelte:window>` and `<svelte:document>`:

```html
<svelte:window onkeydown={...} />
<svelte:document onvisibilitychange={...} />
```

Avoid using `onMount` or `$effect` for this.

## Snippets

Snippets are a way to define reusable chunks of markup that can be instantiated with the `{@render ...}` tag, or passed to components as props. They must be declared within the template.

```html
{#snippet greeting(name)}
  <p>hello {name}!</p>
{/snippet}

{@render greeting('world')}
```

Snippets declared at the top level of a component (i.e. not inside elements or blocks) can be referenced inside `<script>`. A snippet that doesn't reference component state is also available in a `<script module>`, in which case it can be exported for use by other components.

## Each blocks

Prefer to use keyed each blocks — this improves performance by allowing Svelte to surgically insert or remove items rather than updating the DOM belonging to existing items.

The key must uniquely identify the object. Do not use the index as a key.

Avoid destructuring if you need to mutate the item (with something like `bind:value={item.count}`, for example).

## Using JavaScript variables in CSS

If you have a JS variable that you want to use inside CSS you can set a CSS custom property with the `style:` directive.

```html
<div style:--columns={columns}>...</div>
```

You can then reference `var(--columns)` inside the component's `<style>`.

## Styling child components

The CSS in a component's `<style>` is scoped to that component. If a parent component needs to control the child's styles, the preferred way is to use CSS custom properties:

```html
<!-- Parent.svelte -->
<Child --color="red" />

<!-- Child.svelte -->
<h1>Hello</h1>

<style>
	h1 {
		color: var(--color);
	}
</style>
```

If this is impossible (for example, the child component comes from a library) you can use `:global` to override styles:

```html
<div>
	<Child />
</div>

<style>
	div :global {
		h1 {
			color: red;
		}
	}
</style>
```

## Context

Consider using context instead of declaring state in a shared module. This will scope the state to the part of the app that needs it, and eliminate the possibility of it leaking between users when server-side rendering.

Use `createContext` rather than `setContext` and `getContext`, as it provides type safety.

## Async Svelte

If using version 5.36 or higher, you can use `await` expressions and `hydratable` to use promises directly inside components. Note that these require the `experimental.async` option to be enabled in `svelte.config.js` as they are not yet considered fully stable.

## Avoid legacy features

Always use runes mode for new code, and avoid features that have more modern replacements:
- use `$state` instead of implicit reactivity (e.g. `let count = 0; count += 1`)
- use `$derived` and `$effect` instead of `$: assignments and statements` (but only use effects when there is no better solution)
- use `$props` instead of `export let`, `$$props` and `$$restProps`
- use `onclick={...}` instead of `on:click={...}`
- use `{#snippet ...}` and `{@render ...}` instead of `<slot>` and `$$slots` and `<svelte:fragment>`
- use `<DynamicComponent>` instead of `<svelte:component this={DynamicComponent}>`
- use `import Self from './ThisComponent.svelte'` and `<Self>` instead of `<svelte:self>`
- use classes with `$state` fields to share reactivity between components, instead of using stores
- use `{@attach ...}` instead of `use:action`
- use `clsx`-style arrays and objects in class attributes, instead of the `class:` directive

## Performance

Out of the box, SvelteKit does a lot of work to make your applications as performant as possible:
- Code-splitting, so that only the code you need for the current page is loaded
- Asset preloading, so that 'waterfalls' are prevented
- File hashing, so that your assets can be cached forever
- Request coalescing, so that data fetched from separate server load functions is grouped into a single HTTP request
- Parallel loading, so that separate universal load functions fetch data simultaneously
- Data inlining, so that requests made with fetch during server rendering can be replayed in the browser without issuing a new request
- Conservative invalidation, so that load functions are only re-run when necessary
- Prerendering (configurable on a per-route basis, if necessary) so that pages without dynamic data can be served instantaneously
- Link preloading, so that data and code requirements for a client-side navigation are eagerly anticipated

Nevertheless, we can't (yet) eliminate all sources of slowness. To eke out maximum performance, you should be mindful of the following tips.

### Diagnosing issues

Google's PageSpeed Insights and (for more advanced analysis) WebPageTest are excellent ways to understand the performance characteristics of a site that is already deployed to the internet.

Your browser also includes useful developer tools for analysing your site, whether deployed or running locally (Lighthouse, Network, and Performance devtools). Note that your site running locally in dev mode will exhibit different behaviour than your production app, so you should do performance testing in preview mode after building.

### Instrumenting

If you see in the network tab of your browser that an API call is taking a long time and you'd like to understand why, you may consider instrumenting your backend with a tool like OpenTelemetry or Server-Timing headers.

### Optimizing assets

**Images**: Reducing the size of image files is often one of the most impactful changes you can make to a site's performance. Svelte provides the `@sveltejs/enhanced-img` package for making this easier.

**Videos**: Compress videos with tools such as Handbrake. You can lazy-load videos located below the fold with `preload="none"`. Strip the audio track out of muted videos using a tool like FFmpeg.

**Fonts**: Call `resolve` with a preload filter in your handle hook to preload fonts. You can reduce the size of font files by subsetting your fonts.

### Reducing code size

**Svelte version**: We recommend running the latest version of Svelte. Svelte 5 is smaller and faster than Svelte 4.

**Packages**: `rollup-plugin-visualizer` can be helpful for identifying which packages are contributing the most to the size of your site.

**External scripts**: Try to minimize the number of third-party scripts running in the browser. Consider using server-side implementations instead, or run them in a web worker using Partytown's SvelteKit integration.

**Selective loading**: Use dynamic `import(...)` to selectively lazy-load components.

### Navigation

**Preloading**: You can speed up client-side navigations by eagerly preloading the necessary code and data using link options on the `<body>` element.

**Non-essential data**: For slow-loading data that isn't needed immediately, the object returned from your load function can contain promises rather than the data itself.

**Preventing waterfalls**: One of the biggest performance killers is a waterfall (requests made sequentially). Check the network tab in your devtools to see whether additional resources need to be preloaded. Enable single page app (SPA) mode with caution as it can cause waterfalls. Avoid waterfalls on backend calls by using server load functions and database joins instead of chaining multiple API requests from the browser.

### Hosting

Your frontend should be located in the same data center as your backend to minimize latency. For sites with no central backend, many SvelteKit adapters support deploying to the edge. Serve images from a CDN, and ensure your host uses HTTP/2 or newer so files can load in parallel.
