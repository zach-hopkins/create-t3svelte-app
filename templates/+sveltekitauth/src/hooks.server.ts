import SvelteKitAuth from '@auth/sveltekit'
import Discord from '@auth/core/providers/discord'
// Run `npm run check` to generate types after setting the environment variables
import { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET } from '$env/static/private'

export const handle = SvelteKitAuth({
  providers: [
    Discord({ clientId: DISCORD_CLIENT_ID, clientSecret: DISCORD_CLIENT_SECRET }),
  ]
});