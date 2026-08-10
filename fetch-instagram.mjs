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

const CHILDREN_FIELDS = ["media_type", "media_url", "thumbnail_url"].join(",");

async function fetchJSON(url) {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) {
    console.error("Erreur API Instagram :", JSON.stringify(json, null, 2));
    process.exit(1);
  }
  return json;
}

async function fetchMedia() {
  const url =
    `https://graph.instagram.com/${API_VERSION}/${IG_USER_ID}/media` +
    `?fields=${FIELDS}&limit=${MAX_POSTS}&access_token=${ACCESS_TOKEN}`;
  const json = await fetchJSON(url);
  return json.data ?? [];
}

// Pour un CAROUSEL_ALBUM, on récupère chaque média enfant (image/vidéo)
// via l'endpoint /media/{id}/children. Renvoie un tableau {url, type}.
async function fetchCarouselChildren(id) {
  const url =
    `https://graph.instagram.com/${API_VERSION}/${id}/children` +
    `?fields=${CHILDREN_FIELDS}&access_token=${ACCESS_TOKEN}`;
  const json = await fetchJSON(url);
  const items = json.data ?? [];
  return items
    .map((it) => ({
      url: it.media_type === "VIDEO" ? (it.thumbnail_url ?? it.media_url) : it.media_url,
      type: it.media_type,
    }))
    .filter((it) => it.url);
}

function mediaItem(raw) {
  return {
    url: raw.media_type === "VIDEO" ? (raw.thumbnail_url ?? raw.media_url) : raw.media_url,
    type: raw.media_type,
  };
}

async function simplify(post) {
  let carousel;
  if (post.media_type === "CAROUSEL_ALBUM") {
    try {
      carousel = await fetchCarouselChildren(post.id);
    } catch (err) {
      console.error(`Carousel ${post.id} : échec récupération enfants, fallback image unique.`, err.message);
      carousel = [mediaItem(post)];
    }
  } else {
    carousel = [mediaItem(post)];
  }
  // Filtre les éventuels items sans URL
  carousel = carousel.filter((it) => it && it.url);

  return {
    id: post.id,
    caption: post.caption ?? "",
    type: post.media_type, // IMAGE | VIDEO | CAROUSEL_ALBUM
    // previewUrl conservé pour rétrocompat (1ère image du carousel)
    previewUrl: carousel[0]?.url ?? post.media_url,
    carousel,
    permalink: post.permalink,
    timestamp: post.timestamp,
  };
}

async function main() {
  const rawPosts = await fetchMedia();
  const posts = [];
  for (const raw of rawPosts) {
    posts.push(await simplify(raw));
  }

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
