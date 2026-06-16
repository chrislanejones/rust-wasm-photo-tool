import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Architecture from "./pages/Architecture";
import Trail from "./pages/Trail";
import Nav from "./components/Nav";
import Footer from "./components/Footer";

export default function App() {
  return (
    <div className="bg-zinc-950 text-zinc-100 antialiased min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/architecture" element={<Architecture />} />
          <Route path="/trail-log" element={<Trail />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
