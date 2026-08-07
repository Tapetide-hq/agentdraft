import { redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";

export const actions: Actions = {
  default: async ({ cookies }) => {
    cookies.delete("ad_key", { path: "/" });
    cookies.delete("ad_session", { path: "/" });
    throw redirect(303, "/");
  },
};
