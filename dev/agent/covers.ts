import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { fetchPublic } from "./public-web";

export async function downloadCover(url: string, directory: string) {
  const response = await fetchPublic(url, 8_000_000);
  if (!/^image\/(jpeg|png|webp)(?:;|$)/i.test(response.contentType)) {
    throw new Error("Choose a JPEG, PNG, or WebP cover. SVG and other formats are not accepted.");
  }
  const image = sharp(response.body, { limitInputPixels: 40_000_000, animated: false });
  const metadata = await image.metadata();
  if (
    !metadata.format ||
    !["jpeg", "png", "webp"].includes(metadata.format) ||
    (metadata.pages ?? 1) > 1
  ) {
    throw new Error("The download is not a supported still image.");
  }
  const bytes = await image
    .rotate()
    .resize({ width: 1600, height: 2400, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .timeout({ seconds: 5 })
    .toBuffer();
  const filename = `agent-${createHash("sha256").update(bytes).digest("hex").slice(0, 24)}.webp`;
  await mkdir(directory, { recursive: true });
  try {
    await writeFile(join(directory, filename), bytes, { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  return `/covers/${filename}`;
}
