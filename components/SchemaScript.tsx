import { siteGraph } from "@/lib/schema";

/**
 * The site's JSON-LD identity graph as a rendered tag.
 *
 * It lives in a component rather than inline in the layout so the emission is
 * testable: the layout is an async server component, so anything asserted about
 * it there can only be a source-level grep, which passes just as happily if the
 * script tag is deleted or the graph is computed and never rendered.
 */
export default function SchemaScript({
  locale,
  description,
}: {
  locale: string;
  description: string;
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(siteGraph({ locale, description })) }}
    />
  );
}
