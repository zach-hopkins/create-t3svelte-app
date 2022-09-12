<p align="center">
  <img src="https://user-images.githubusercontent.com/43737355/189502485-be99e3ce-272b-49a9-abe8-5496238dfbb3.png" alt="T3-SvelteKit" />
</p>
<h1 align="center">create-t3svelte-app</h1>
<p align="center">
  <img src="https://img.shields.io/badge/PRs-welcome-blue.svg"/>
  <a href="https://npmjs.org/package/create-t3svelte-app">
    <img src="https://img.shields.io/npm/v/create-t3svelte-app.svg?style=flat-square" alt="NPM version" style="max-width: 100%;" />
  </a>
  <a href="/icflorescu/create-t3svelte-app/blob/main/LICENSE">
    <img src="http://img.shields.io/npm/l/create-t3svelte-app.svg?style=flat-square" alt="License" style="max-width: 100%;" />
  </a>
  <a href="https://github.com/icflorescu/create-t3svelte-app">
    <img src="https://img.shields.io/github/stars/zach-hopkins/create-t3svelte-app?style=flat-square" alt="Stars" style="max-width: 100%;" />
  </a>
  <a href="https://npmjs.org/package/create-t3svelte-app">
    <img src="http://img.shields.io/npm/dm/create-t3svelte-app.svg?style=flat-square" alt="Downloads" style="max-width: 100%;" />
  </a>
	
</p>

<p align="center">
<br />
  <b>Just Build </b>
  <br />
<code>npx create-t3svelte-app</code>
<br />

## Get Building
  ✅ Elegant full-stack framework powered by <a href="https://kit.svelte.dev/">SvelteKit</a>.
  <br />✅ Static typing support with <a href="https://typescriptlang.org">TypeScript</a>
  <br />✅ End-to-end typesafe APIs with <a href="https://trpc.io">tRPC.io</a>
  <br />✅ Enjoyable database interaction with <a href="https://www.prisma.io/">Prisma</a> ORM.
  <br />✅ Efficient styling with <a href="https://tailwindcss.com/">Tailwind CSS</a>.
</p>

### NPM & Yarn

```bash
npx create-t3svelte-app@latest
```

## Early Version Note

This initial version is lacking significant polish that I hope to add in a new release shortly, including:
<ul>
<li> Less Opinions, More Customization (including prettier/eslint not as forced defaults) </li>
<li> SQLite as Prisma.schema default ✅ </li>
<li> Helper comments </li>
<li> Package Manager Support </li>
</ul>

## More Info 🛠

### Basics

A simple CLI with highly opioniated out-of-the-box ready SvelteKit/tRPC/Prisma/Tailwind application with CLI options: 'Standard' and 'Standard + UI Extras' (customization soon). Just run and start building.

<h3>Standard</h3>
<ul>
<li><b>SvelteKit</b></li>
<li><b>tRPC</b> - preconfigured with example API call in +page.svelte
<li><b>Tailwind CSS</b> - preconfigured with eslint/prettier & 'tailwind prettier plugin' integration</li>
<li><b>Prisma ORM</b> - CLI option to initialize DB on run - no need to run prisma db pull or prisma db generate </li>
</ul>

<h3>Standard + UI Extras</h3>
<ul>
<li><b>Standard</b></li>
<li><b>Headless UI</b>
<li><b>HeroIcons</b>
</ul>

<h3> Prisma Reqs </h3>

If you choose not to init DB on first build, you can initialize prisma db at any time by editing the DATABASE_URL in .env and then running `npx prisma db pull` and `npx prisma generate`. You can read more about Prisma on their docs <a href="https://www.prisma.io/docs/reference/api-reference/command-reference">Here</a>

## Contributing

See a bug? Want to help? Easiest way is to just clone the Dev repo and run `npm link` in the cloned directory. You can code and then run `create-t3svelte-app` in any directory.

`npm unlink create-t3svelte-app` to undo.

### Shoutouts

<a href="https://t3.gg/">Theo @ T3</a> for T3 Stack inspiration!
<br />
<a href="https://github.com/nexxeln">Nexxel</a> for the OG create-t3-app!
<br />
<a href="https://github.com/icflorescu/trpc-sveltekit"> Ionut-Cristian Florescu</a> for his wonderful work on SvelteKit + tRPC & SSR Info!
<br />
<a href="https://github.com/rgossiaux"> Ryan Gossiaux</a> for enabling TailwindUI & HeadlessUI on Svelte!

## Caveats & Addendums

### Server-Side Rendering

If you need to use the tRPC client in SvelteKit's `load()` function for SSR, make sure to initialize it like so:

```ts
// $lib/trpcClient.ts
import { browser } from '$app/env';
import type { Router } from '$lib/trpcServer';
import * as trpc from '@trpc/client';
import type { LoadEvent } from "@sveltejs/kit";

const url = browser ? '/trpc' : 'http://localhost:3000/trpc';
export default (loadFetch?: LoadEvent['fetch']) =>
  trpc.createTRPCClient<Router>({
    url: loadFetch ? '/trpc' : url,
    transformer: trpcTransformer,
    ...(loadFetch && { fetch: loadFetch as typeof fetch })
  });
  
```

Then use it like so:

```ts
// index.svelte
import trpcClient from '$lib/trpcClient';
import type { Load } from '@sveltejs/kit';

export const load: Load = async ({ fetch }) => { // 👈 make sure to pass in this fetch, not the global fetch
	const authors = await trpcClient(fetch).query('authors:browse', {
		genre: 'fantasy',
	});
	return { props: { authors } };
};
```

### Vercel's Edge Cache for Serverless Functions

Your server responses must [satisfy some criteria](https://vercel.com/docs/concepts/functions/edge-caching) in order for them to be cached Vercel Edge Network, and here's where tRPC's `responseMeta()` comes in handy. You could initialize your handle in `src/hooks.ts` like so: 

```ts
// src/hooks.server.ts
import { router } from '$lib/trpcServer';
import { createTRPCHandle } from 'trpc-sveltekit';

export const handle = async ({ event, resolve }) => {
  const response = await createTRPCHandle({
    url: '/trpc',
    event,
    resolve,
    responseMeta({ type, errors }) {
      if (type === 'query' && errors.length === 0) {
        const ONE_DAY_IN_SECONDS = 60 * 60 * 24;
        return {
          headers: {
            'cache-control': `s-maxage=1, stale-while-revalidate=${ONE_DAY_IN_SECONDS}`
          }
        };
      }
      return {};
    }
  });

  return response;
};
```

## License

MIT
