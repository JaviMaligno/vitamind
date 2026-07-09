import type { Metadata } from "next";
import { buildAlternates } from "@/i18n/metadata";

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: buildAlternates(locale, "/profile") };
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
