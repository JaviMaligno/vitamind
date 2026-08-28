import {
  suntimeBandMetadata,
  suntimeBandParams,
  suntimeBandRoute,
  type BandParams,
} from "../../_suntime/suntime-route";

/**
 * The three band pages for `en`: `/how-long-in-sun-vitamin-d/{band}`.
 *
 * Thin for the same reason as its parent, and it carries the same hazard: this
 * literal duplicates a value of SUNTIME_PREFIX with nothing in the type system
 * connecting them. app/__tests__/suntime-pages.test.ts pins it to the directory.
 */
const PREFIX = "how-long-in-sun-vitamin-d";

export const revalidate = false;

export function generateStaticParams() {
  return suntimeBandParams(PREFIX);
}

export async function generateMetadata({ params }: { params: Promise<BandParams> }) {
  return suntimeBandMetadata(PREFIX, params);
}

export default async function SuntimeBandRoute({ params }: { params: Promise<BandParams> }) {
  return suntimeBandRoute(PREFIX, params);
}
