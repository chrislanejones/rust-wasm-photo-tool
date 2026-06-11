// app/src/lib/testImages.ts
//
// "Test Free Images" — 12 large, royalty-free Unsplash photos (2.6–9.9 MB each)
// hosted on the project's UploadThing account. These are PUBLIC CDN URLs, so no
// API key/secret is needed in the browser; the secret (UPLOADTHING_TOKEN) is
// only used server-side / at setup time and lives in the gitignored .env.local.
//
// The button pulls these from UploadThing on every press and feeds them through
// the normal upload pipeline (so the per-tier gallery cap still applies).

const UPLOADTHING_APP_ID = "f1avkyiqgj";

/** Public file URL for an UploadThing file key. */
const fileUrl = (key: string) =>
  `https://${UPLOADTHING_APP_ID}.ufs.sh/f/${key}`;

interface TestImage {
  key: string;
  name: string;
}

// Stable set — same images every press. (12 largest of the uploaded set so they
// fit the 12-photo demo cap exactly.)
const TEST_IMAGES: readonly TestImage[] = [
  { key: "z5H6uhfIK1OUZxYa2qa8jus21DyTrlYdkxGv8cmQtbzIiog9", name: "simone-mascellari-Mjp5k5_gVjw-unsplash.jpg" },
  { key: "z5H6uhfIK1OUUUK8XFGAZT4HhdUcJnmlb20xOjik9pg3Ye18", name: "fujiphilm-8gqcEArJ-SI-unsplash.jpg" },
  { key: "z5H6uhfIK1OUXFzqIlgh7mpoSwhU5cRegfCL6Jsjd1DZV38a", name: "musa-ortac-4jAhqZRzsVI-unsplash.jpg" },
  { key: "z5H6uhfIK1OUQT0D12xaDW5bMEFo3XPTqB7jerhC2ckgy1pL", name: "luise-and-nic-Ien3TLof-uw-unsplash.jpg" },
  { key: "z5H6uhfIK1OUsYs5qgnwfPFtDYZoMqJLcRASageGW27rHnXy", name: "filipe-freitas-r9-0WbhZYWI-unsplash.jpg" },
  { key: "z5H6uhfIK1OUAGz4dqsmVK7RUD8teFWnoPTg6xihHCrsBdQ9", name: "erwan-hesry-6TGBG_2nnBU-unsplash.jpg" },
  { key: "z5H6uhfIK1OUPqxXePBOm1Y3s0iJoF9tb7DfBWNnVXryT42x", name: "sou-jest-Bj9zjd12DQY-unsplash.jpg" },
  { key: "z5H6uhfIK1OUrMAzCFvqfmnB5jvN6YP1zwCADeWbhGKTscRO", name: "noelle-xHDN-da46r8-unsplash.jpg" },
  { key: "z5H6uhfIK1OUsA36dCnwfPFtDYZoMqJLcRASageGW27rHnXy", name: "jayesh-patel-zHRlfpTGXx8-unsplash.jpg" },
  { key: "z5H6uhfIK1OUdqwudJCJntl4PCg2Go07ej3saNYL6TDcK9wk", name: "alexander-mass-unTptM0nsNE-unsplash.jpg" },
  { key: "z5H6uhfIK1OUo4sb7olmaWjJvsZ4ewzpqK3B0C9IOAbuDd2R", name: "sasha-matveeva-h92-1gEx6sU-unsplash.jpg" },
  { key: "z5H6uhfIK1OUNevmrr1D9GXJAHBeTjLIVnlS4bmYxzZK6yuc", name: "vitalii-onyshchuk-dMACEJnLlY0-unsplash.jpg" },
];

/** How many test images this button will attempt to load. */
export const TEST_IMAGE_COUNT = TEST_IMAGES.length;

/**
 * Fetch the test images from UploadThing as `File`s, ready to feed into the
 * normal upload handler. Resilient: any image that fails to download is skipped
 * rather than failing the whole batch.
 */
export async function fetchTestImages(): Promise<File[]> {
  const settled = await Promise.allSettled(
    TEST_IMAGES.map(async ({ key, name }) => {
      const res = await fetch(fileUrl(key));
      if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
      const blob = await res.blob();
      return new File([blob], name, { type: blob.type || "image/jpeg" });
    }),
  );

  const files: File[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") files.push(r.value);
    else console.error("Test image failed to load —", r.reason);
  }
  return files;
}
