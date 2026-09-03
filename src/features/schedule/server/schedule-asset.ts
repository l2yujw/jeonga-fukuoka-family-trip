import { readFile, realpath } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";

export const SCHEDULE_ASSET_CACHE_CONTROL = "private, no-store";
export const SCHEDULE_ASSET_ROOT = join(
  process.cwd(),
  "private-assets",
  "schedule",
);

const contentTypes = {
  ".png": "image/png",
  ".webp": "image/webp",
} as const;

const errorResponse = (message: string, status: number) =>
  new Response(message, {
    status,
    headers: {
      "Cache-Control": SCHEDULE_ASSET_CACHE_CONTROL,
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });

const isPathWithinRoot = (root: string, candidate: string) => {
  const relativePath = relative(root, candidate);
  return Boolean(relativePath) &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath);
};

export function resolveScheduleAssetPath(
  pathSegments: readonly string[],
  root = SCHEDULE_ASSET_ROOT,
) {
  if (!pathSegments.length) return null;

  let decodedSegments: string[];
  try {
    decodedSegments = pathSegments.map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }
  if (
    decodedSegments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes("/") ||
        segment.includes("\\") ||
        segment.includes("\0"),
    )
  ) {
    return null;
  }

  const rootPath = resolve(root);
  const assetPath = resolve(rootPath, ...decodedSegments);
  if (
    !isPathWithinRoot(rootPath, assetPath) ||
    !(extname(assetPath).toLowerCase() in contentTypes)
  ) {
    return null;
  }
  return assetPath;
}

export async function readScheduleAssetFile(
  assetPath: string,
  root = SCHEDULE_ASSET_ROOT,
) {
  const [realRoot, realAsset] = await Promise.all([realpath(root), realpath(assetPath)]);
  if (!isPathWithinRoot(realRoot, realAsset)) throw new Error("Invalid Schedule asset path.");
  return new Uint8Array(await readFile(realAsset)).buffer;
}

export async function serveScheduleAsset(
  inviteToken: string | undefined,
  pathSegments: readonly string[],
  validateInvite: () => Promise<boolean>,
  readAsset: (assetPath: string) => Promise<ArrayBuffer>,
  root = SCHEDULE_ASSET_ROOT,
) {
  if (!inviteToken) return errorResponse("Unauthorized.", 401);

  try {
    if (!(await validateInvite())) return errorResponse("Unauthorized.", 401);
  } catch {
    return errorResponse("Schedule asset authorization is unavailable.", 503);
  }

  const assetPath = resolveScheduleAssetPath(pathSegments, root);
  if (!assetPath) return errorResponse("Not found.", 404);

  try {
    return new Response(await readAsset(assetPath), {
      headers: {
        "Cache-Control": SCHEDULE_ASSET_CACHE_CONTROL,
        "Content-Type": contentTypes[extname(assetPath).toLowerCase() as keyof typeof contentTypes],
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return errorResponse("Not found.", 404);
  }
}
