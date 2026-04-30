import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      ".vercel/**",
      "scripts/.probe-out/**",
      ".worktrees/**",
      "public/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
