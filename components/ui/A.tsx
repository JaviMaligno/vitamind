import { Link } from "@/i18n/navigation";
import type { ComponentProps } from "react";

/** Enlace canónico: color de acento sol + foco visible. Envuelve el Link i18n. */
export default function A({ className = "", ...rest }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={`text-sun-strong underline decoration-2 underline-offset-2 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sun ${className}`}
      {...rest}
    />
  );
}
