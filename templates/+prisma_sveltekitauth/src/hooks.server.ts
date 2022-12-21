import SvelteKitAuth from '@auth/sveltekit'
import Discord from '@auth/core/providers/discord'
import prismaClient from '$lib/server/prismaClient'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import type { Adapter } from '@auth/core/adapters'
// Run `npm run check` to generate types after setting the environment variables
import { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET } from '$env/static/private'

export const handle = SvelteKitAuth({
  adapter: PrismaAdapter(prismaClient) as Adapter<boolean>,
  providers: [
    Discord({ clientId: DISCORD_CLIENT_ID, clientSecret: DISCORD_CLIENT_SECRET }),
  ]
});