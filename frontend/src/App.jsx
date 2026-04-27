import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Explorer from "./pages/Explorer.jsx";
import History from "./pages/History.jsx";

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? "bg-indigo-600 text-white"
            : "text-gray-400 hover:text-white hover:bg-gray-800"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-6">
          <span className="text-white font-bold text-lg tracking-tight">
            ⚡ API Dashboard
          </span>
          <nav className="flex gap-2">
            <NavItem to="/" label="Dashboard" />
            <NavItem to="/explorer" label="Explorer" />
            <NavItem to="/history" label="History" />
          </nav>
        </header>
        <main className="flex-1 p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/explorer" element={<Explorer />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
