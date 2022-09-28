<p align="center">
  <img src="https://user-images.githubusercontent.com/43737355/189502485-be99e3ce-272b-49a9-abe8-5496238dfbb3.png" alt="T3-SvelteKit" />
</p>

<h1 align="center">create-t3svelte-app</h1>

<p align="center">
  <img src="https://img.shields.io/badge/PRs-welcome-blue.svg"/>
  <a href="https://npmjs.org/package/create-t3svelte-app">
    <img src="https://img.shields.io/npm/v/create-t3svelte-app.svg?style=flat-square" alt="NPM version" style="max-width: 100%;" />
  </a>
  <a href="/zach-hopkins/create-t3svelte-app/blob/main/LICENSE">
    <img src="http://img.shields.io/npm/l/create-t3svelte-app.svg?style=flat-square" alt="License" style="max-width: 100%;" />
  </a>
  <a href="https://github.com/zach-hopkins/create-t3svelte-app">
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
</p>

## Outline

* [Get Building](#get-building)
  * [npm](#npm)
  * [yarn](#yarn)
  * [Prisma Requirements](#prisma-requirements)
* [Available Templates](#available-templates)
  * [Standard](#standard-recommended)
  * [Custom (Modular)](#custom-modular-build)
* [Contributing](#contributing)
* [Caveats & Addendums](#caveats--addendums)
  * [Server-Side Rendering](#server-side-rendering)
  * [Vercel's Edge Cache for Serverless Functions](#vercels-edge-cache-for-serverless-functions)
* [Shoutouts](#shoutouts)
* [License](#license)

## Get Building
<h4><i> create-t3svelte-app is completely modular. Choose the components you need! </i></h4>

✅ Elegant full-stack framework powered by [SvelteKit](https://kit.svelte.dev/)  
✅ Static typing support with [TypeScript](https://typescriptlang.org)  
✅ End-to-end typesafe APIs with [tRPC](https://trpc.io)  
✅ Enjoyable database interaction with [Prisma](https://www.prisma.io/)  
✅ Efficient styling with [Tailwind CSS](https://tailwindcss.com/)  

### npm

```bash
npx create-t3svelte-app@latest
```

### yarn

```bash
yarn create t3svelte-app
```

### Prisma Requirements

If you choose not to init DB on first build, you can initialize prisma db at any time by editing the `DATABASE_URL` in `.env` and then running `npx prisma db pull` and `npx prisma generate`. You can read more about Prisma on their [docs](https://www.prisma.io/docs/reference/api-reference/command-reference).

## Available Templates

A simple CLI with highly opinionated, out-of-the-box ready SvelteKit/tRPC/Prisma/Tailwind application. CLI options include 'Standard' and 'Custom' (modular build). Just run and start building.

### Standard (Recommended)

- [**SvelteKit**](https://kit.svelte.dev/)
- [**TypeScript**](https://www.typescriptlang.org/)
- [**tRPC**](https://trpc.io/) - preconfigured with example API call in `+page.svelte`
- [**Tailwind CSS**](https://tailwindcss.com/) - preconfigured with eslint/prettier & 'tailwind prettier plugin' integration
- [**Prisma ORM**](https://www.prisma.io/) - CLI option to initialize DB on run - no need to run `prisma db pull` or `prisma db generate`

### Custom (Modular Build)

#### Tech Stack Options:

- SvelteKit
- TypeScript || JavaScript
- tRPC
- Tailwind CSS
- Prisma ORM

#### Tool Options:

- [ESLint](https://eslint.org/)
- [Prettier](https://prettier.io/)
- [Tailwind Prettier Plugin](https://github.com/tailwindlabs/prettier-plugin-tailwindcss)
- [Prisma ORM](https://www.prisma.io/)
- [Svelte Headless UI](https://github.com/rgossiaux/svelte-headlessui)
- [Svelte HeroIcons](https://github.com/JustinVoitel/svelte-hero-icons)

#### Config Options:

- Git Init
- DB Auto Configure w/ Prisma (Postgresql, MySQL, MongoDB, SQLite)
- Auto Dependency Install

## Contributing

See a bug? Want to help? Easiest way is to clone the main repo and run `npm link` in the cloned directory. You can code and then run `create-t3svelte-app` in any directory.

```bash
git clone https://github.com/zach-hopkins/create-t3svelte-app
cd create-t3svelte-app
npm i
npm link
mkdir test-project
cd test-project
create-t3svelte-app
```

Run `npm unlink create-t3svelte-app` to undo.

## Caveats & Addendums

### Server-Side Rendering

If you need to use the tRPC client in SvelteKit's [`load()`](https://kit.svelte.dev/docs/load) function for SSR, make sure to initialize it like so:

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
// src/routes/+authors.svelte

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

Your server responses must [satisfy some criteria](https://vercel.com/docs/concepts/functions/edge-caching) in order for them to be cached on Vercel's Edge Network. tRPC's `responseMeta()` comes in handy here since you can initialize your handle in [`src/hooks.server.ts`](https://kit.svelte.dev/docs/hooks#server-hooks) like so: 

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

## Shoutouts

- [Theo @ T3](https://t3.gg/) for T3 Stack inspiration!
- [Nexxel](https://github.com/nexxeln) for the OG create-t3-app!
- [Ionut-Cristian Florescu](https://github.com/icflorescu/trpc-sveltekit) for his wonderful work on SvelteKit + tRPC & SSR Info!
- [Ryan Gossiaux](https://github.com/rgossiaux) for enabling TailwindUI & HeadlessUI on Svelte!

## License

[MIT](/LICENSE)

