// Cloudinary: direct-from-browser upload, and thumbnail URLs.
//
// Two touch points, deliberately. The image goes straight from the user's
// browser to Cloudinary, and only the resulting URL is sent to our backend —
// which means our Express server never handles a file upload at all. No
// multipart parsing, no temp files, no memory spike from a 5MB photo, no
// request timeout on a slow mobile connection. The backend's `imageUrl` has
// been a plain optional string since Module 3 and does not change.

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

/** 5MB. Mirrors the limit that should also be set on the preset itself. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Is upload configured?
 *
 * Checked rather than assumed so the form can degrade: without these variables
 * the photo field explains itself and every other field still works. Same rule
 * as the AI layer and the stats panel — an optional extra that is unavailable
 * must not break the operation the user came to perform.
 */
export function isUploadConfigured(): boolean {
  return Boolean(CLOUD_NAME && UPLOAD_PRESET);
}

export type UploadResult = { secureUrl: string };

/**
 * Uploads one image and resolves with its permanent URL.
 *
 * ---- WHY XMLHttpRequest AND NOT fetch ------------------------------------
 *
 * This is the one genuinely interesting line of the integration, and it comes
 * up in interviews.
 *
 * `fetch` cannot report UPLOAD progress. It can stream a response *down* —
 * `response.body` is a ReadableStream — but there is no supported way to
 * observe how much of the request BODY has gone *up*. (Request streaming with
 * duplex half exists, but it is not broadly supported and does not give you a
 * progress event.)
 *
 * `XMLHttpRequest.upload.onprogress` does exactly that, and it is still the
 * only reliable way to draw a real percentage. That is why a twenty-year-old
 * API survives in modern codebases for this one job.
 *
 * It matters here specifically: this app is used on a phone, on mobile data,
 * uploading a multi-megabyte photo. A spinner that might mean "10% done" or
 * "silently stalled" is not good enough.
 *
 * The promise wrapper exists because XHR is callback-based; every terminal path
 * (load, error, abort, timeout) settles it exactly once.
 */
export function uploadImage(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      reject(new Error("Image upload is not configured."));
      return;
    }

    // Multipart form data, not JSON — a file is binary and JSON has no way to
    // carry it without base64, which would inflate it by about a third.
    const body = new FormData();
    body.append("file", file);
    body.append("upload_preset", UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`);

    xhr.upload.onprogress = (event) => {
      // lengthComputable is false when the total size is unknown — rare for a
      // File, but reporting a percentage of an unknown total would be a lie.
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      // XHR resolves `onload` for 4xx and 5xx too — unlike a thrown error, an
      // HTTP error IS a completed request. The status has to be checked by hand.
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (typeof data.secure_url !== "string") {
            reject(new Error("Cloudinary did not return an image URL."));
            return;
          }
          // secure_url, not url: the https variant. An http image on an https
          // page is mixed content and browsers block it outright.
          resolve({ secureUrl: data.secure_url });
        } catch {
          reject(new Error("Could not read Cloudinary's response."));
        }
      } else {
        // Cloudinary's own message is genuinely useful here — "Upload preset
        // not found", "File size too large" — so it is surfaced rather than
        // replaced with something generic. Nothing sensitive is in it, because
        // there is no secret in this request to leak.
        let message = `Upload failed (${xhr.status})`;
        try {
          const data = JSON.parse(xhr.responseText);
          if (data?.error?.message) message = data.error.message;
        } catch {
          // Keep the generic message.
        }
        reject(new Error(message));
      }
    };

    xhr.onerror = () => reject(new Error("Network error while uploading."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.ontimeout = () => reject(new Error("Upload timed out."));

    // A phone on a poor connection needs room; an indefinite hang does not.
    xhr.timeout = 60_000;

    xhr.send(body);
  });
}

/**
 * Rewrites a Cloudinary URL to request a resized, re-encoded version.
 *
 * Cloudinary transformations live in the URL PATH, not in a query string:
 *
 *   .../image/upload/v1234/photo.jpg
 *   .../image/upload/c_fill,w_160,h_120,q_auto,f_auto/v1234/photo.jpg
 *
 * Cloudinary generates that variant on first request, caches it on its CDN, and
 * serves it thereafter. So a list of twenty reports downloads twenty ~8KB WebP
 * thumbnails instead of twenty multi-megabyte phone photos, with no build step,
 * no image pipeline of ours, and no storage cost for the derived files.
 *
 * What the parameters do:
 *   c_fill    crop to fill the box exactly, keeping the centre
 *   w_ / h_   the target box
 *   q_auto    let Cloudinary choose a quality that looks unchanged
 *   f_auto    serve WebP or AVIF when the browser's Accept header allows it,
 *             JPEG when it does not
 *
 * ---- WHY THIS RETURNS SOME URLS UNTOUCHED --------------------------------
 *
 * `imageUrl` is a plain string in the API contract. It usually holds a
 * Cloudinary URL, but the backend accepts any string, and reports created
 * before this phase may hold something else entirely. Blindly splicing a
 * transformation into an arbitrary URL would corrupt it, so anything that is
 * not a recognisable Cloudinary upload URL is returned exactly as given.
 */
export function cloudinaryThumb(
  url: string | null,
  width: number,
  height: number
): string | null {
  if (!url) return null;

  const marker = "/image/upload/";
  const index = url.indexOf(marker);

  // Not a Cloudinary upload URL — hand it back unchanged.
  if (!url.includes("res.cloudinary.com") || index === -1) return url;

  const before = url.slice(0, index + marker.length);
  const after = url.slice(index + marker.length);

  return `${before}c_fill,w_${width},h_${height},q_auto,f_auto/${after}`;
}
