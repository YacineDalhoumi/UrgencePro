import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tailwind CSS v4 via Turbopack (configuration générée par create-next-app)
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Anciennes adresses de l'espace agent → nouvelles pages (aucun lien existant ne casse)
  async redirects() {
    return [
      { source: "/agent", destination: "/tableau-de-bord", permanent: false },
      { source: "/agent/nouvelle", destination: "/demandes/nouvelle", permanent: false },
      { source: "/agent/historique", destination: "/demandes", permanent: false },
      { source: "/agent/historique/:id", destination: "/demandes/:id", permanent: false },
      { source: "/agent/diagnostic", destination: "/parametres", permanent: false },
    ];
  },
  // En-têtes de sécurité de base
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
