import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const privateVisualPaths = {
  landing: "boarding/landing-final.png",
  confirm: "boarding/confirm-final.png",
  status: "boarding/status-final.png",
  "neutral-seat-patch": "boarding/neutral-seat-patch.png",
} as const;

export async function loadPrivateVisual(asset: keyof typeof privateVisualPaths) {
  if (!Object.hasOwn(privateVisualPaths, asset)) {
    throw new Error("Unknown private visual.");
  }

  const { data, error } = await createSupabaseAdminClient()
    .storage.from("app-visuals")
    .download(privateVisualPaths[asset]);

  if (error || !data?.size) throw new Error("Private visual download failed.");
  return data.arrayBuffer();
}
