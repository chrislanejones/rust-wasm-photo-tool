import { Link, NavLink, useLocation } from "react-router-dom";
import Logo from "./Logo";

export default function Nav() {
  const loc = useLocation();
  const onHome = loc.pathname === "/";
  return (
    <nav className="sticky top-0 z-50 backdrop-blur bg-zinc-950/70 border-b border-zinc-900">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <Logo />
        <div className="hidden md:flex items-center gap-7 text-sm text-zinc-400">
          {onHome ? (
            <>
              <a href="#features" className="hover:text-zinc-100 transition">Features</a>
              <a href="#how" className="hover:text-zinc-100 transition">How it works</a>
              <a href="#pricing" className="hover:text-zinc-100 transition">Pricing</a>
            </>
          ) : (
            <>
              <Link to="/#features" className="hover:text-zinc-100 transition">Features</Link>
              <Link to="/#how" className="hover:text-zinc-100 transition">How it works</Link>
              <Link to="/#pricing" className="hover:text-zinc-100 transition">Pricing</Link>
            </>
          )}
          <NavLink
            to="/architecture"
            className={({ isActive }) =>
              isActive ? "text-orange-400" : "hover:text-zinc-100 transition"
            }
          >
            Architecture
          </NavLink>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="#"
            className="text-sm text-zinc-400 hover:text-zinc-100 transition hidden sm:inline"
          >
            Sign in
          </a>
          <a
            href={onHome ? "#cta" : "/#cta"}
            className="text-sm font-medium px-3 py-1.5 rounded-md bg-zinc-100 text-zinc-900 hover:bg-white transition"
          >
            Try the demo
          </a>
        </div>
      </div>
    </nav>
  );
}
