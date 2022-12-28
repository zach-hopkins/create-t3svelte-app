// Example of getting the current user's session
import type { LayoutServerLoad } from "./$types"

export const load: LayoutServerLoad = async (event) => {
  return {
    session: await event.locals.getSession(),
  }
}