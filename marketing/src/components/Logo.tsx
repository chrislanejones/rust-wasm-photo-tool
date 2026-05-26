import { Link } from "react-router-dom";

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 ${className}`}>
      <img
        src="/Image-Horse-Logo.svg"
        alt="Image Horse"
        className="w-9 h-9 rounded-lg"
      />
      <span className="font-semibold tracking-tight">Image Horse</span>
    </Link>
  );
}
