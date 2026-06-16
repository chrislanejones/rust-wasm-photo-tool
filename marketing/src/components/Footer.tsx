import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-900">
      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <img src="/Image-Horse-Logo.svg" alt="" className="w-5 h-5 rounded" />
          <span>© {new Date().getFullYear()} Image Horse · Built with Rust + WASM</span>
        </div>
        <div className="flex items-center gap-5">
          <Link to="/architecture" className="hover:text-zinc-300 transition">Architecture</Link>
          <Link to="/trail-log" className="hover:text-zinc-300 transition">Trail Log</Link>
          <Link to="/#pricing" className="hover:text-zinc-300 transition">Pricing</Link>
          <a
            href="https://github.com/chrislanejones/rust-wasm-photo-tool"
            className="hover:text-zinc-300 transition"
          >
            GitHub
          </a>
          <a
            href="https://codeberg.org/chrislanejones/rust-wasm-photo-tool"
            className="hover:text-zinc-300 transition"
          >
            Codeberg
          </a>
        </div>
      </div>
    </footer>
  );
}
