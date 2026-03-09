import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value || "es";
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
