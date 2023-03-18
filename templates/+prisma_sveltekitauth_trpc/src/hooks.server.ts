import SvelteKitAuth from '@auth/sveltekit'
import Discord from '@auth/core/providers/discord'
import prismaClient from '$lib/server/prismaClient'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { createContext, responseMeta, router } from '$lib/server/trpcServer'
import { createTRPCHandle } from 'trpc-sveltekit'
import { sequence } from '@sveltejs/kit/hooks';
import type { Adapter } from '@auth/core/adapters'
import type { Handle } from '@sveltejs/kit'
import { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET } from '$env/static/private'

const handleTrpc: Handle = async ({ event, resolve }) => {
	const response = await createTRPCHandle({
		url: '/trpc', // optional; defaults to '/trpc'
		router,
		createContext, // optional
		responseMeta, // optional
		event,
		resolve,
	})

	return response
}

const handleAuth: Handle = SvelteKitAuth({
  adapter: PrismaAdapter(prismaClient) as Adapter<boolean>,
  providers: [
    Discord({ clientId: DISCORD_CLIENT_ID, clientSecret: DISCORD_CLIENT_SECRET }),
  ]
});

export const handle: Handle = sequence(handleTrpc, handleAuth)