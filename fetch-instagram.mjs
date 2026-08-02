// fetch-instagram.mjs
// Récupère les derniers posts du compte Instagram (Business/Creator) via
// l'API "Instagram avec connexion Instagram" (Instagram Login flow, sans Page Facebook)
// et écrit le résultat dans data/instagram.json à la racine du repo.
//
// Secrets requis (à définir dans GitHub → Settings → Secrets and variables → Actions) :
//   IG_ACCESS_TOKEN   -> jeton d'accès longue durée
//   IG_USER_ID        -> l'ID du compte Instagram (pas le @nomdutilisateur)
//
// Utilise le fetch natif de Node (Node 18+).

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const IG_USER_ID = process.env.IG_USER_ID;
const API_VERSION = "v21.0";
const OUTPUT_PATH = path.join(process.cwd(), "data", "instagram.json");
const MAX_POSTS = 12; // nombre d'aperçus à conserver

if (!ACCESS_TOKEN || !IG_USER_ID) {
  console.error("IG_ACCESS_TOKEN et/ou IG_USER_ID manquants dans l'environnement.");
  process.exit(1);
}

const FIELDS = [
  "id",
  "caption",
  "media_type",
  "media_url",
  "thumbnail_url", // utile pour les vidéos (media_url pointe vers le fichier vidéo)
  "permalink",
  "timestamp",
].join(",");

async function fetchMedia() {
  const url =
    `https://graph.instagram.com/${API_VERSION}/${IG_USER_ID}/media` +
    `?fields=${FIELDS}&limit=${MAX_POSTS}&access_token=${ACCESS_TOKEN}`;

  const res = await fetch(url);
  const json = await res.json();

  if (!res.ok) {
    console.error("Erreur API Instagram :", JSON.stringify(json, null, 2));
    process.exit(1);
  }

  return json.data ?? [];
}

function simplify(post) {
  return {
    id: post.id,
    caption: post.caption ?? "",
    type: post.media_type, // IMAGE | VIDEO | CAROUSEL_ALBUM
    // Pour une vidéo, media_url est le fichier vidéo brut : on préfère
    // la miniature pour un aperçu visuel, avec fallback sur media_url.
    previewUrl: post.media_type === "VIDEO" ? (post.thumbnail_url ?? post.media_url) : post.media_url,
    permalink: post.permalink,
    timestamp: post.timestamp,
  };
}

async function main() {
  const rawPosts = await fetchMedia();
  const posts = rawPosts.map(simplify);

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(
    OUTPUT_PATH,
    JSON.stringify({ updatedAt: new Date().toISOString(), posts }, null, 2),
    "utf-8"
  );

  console.log(`${posts.length} posts écrits dans ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
