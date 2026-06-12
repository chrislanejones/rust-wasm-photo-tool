import { EDITOR_URL } from "../config";

export default function CTA() {
  return (
    <section
      id="cta"
      className="border-t border-zinc-900 bg-gradient-to-b from-zinc-950 to-zinc-900"
    >
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight">
          Open it in a tab. Edit a photo. Decide.
        </h2>
        <p className="mt-4 text-zinc-400 max-w-xl mx-auto">
          No account, no email gate, no upload. Just the editor running locally
          in your browser, talking to a Rust binary you can inspect.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <a
            href={EDITOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 text-white font-medium hover:opacity-90 transition glow"
          >
            Beta Version
          </a>
        </div>
      </div>
    </section>
  );
}
