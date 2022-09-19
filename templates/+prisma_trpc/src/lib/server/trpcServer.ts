import type { inferAsyncReturnType } from '@trpc/server'
import * as trpc from '@trpc/server'
import trpcTransformer from 'trpc-transformer'
import prismaClient from './prismaClient'
import { z } from 'zod'

// optional
export const createContext = () => {
	// ...
	return {
		/** context data */
	}
}

// optional
export const responseMeta = () => {
	// ...
	return {
		// { headers: ... }
	}
}

export const router = trpc
	.router<inferAsyncReturnType<typeof createContext>>()
	.transformer(trpcTransformer)
	// queries and mutations...
	.query('getUser', {
		input: z.number(),
		resolve: ({ input }) =>
			prismaClient.user.findFirst({
				select: {
					email: true,
				},
				where: {
					id: input,
				},
			}),
	})

export type Router = typeof router
