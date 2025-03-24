import Dashboard from "./components/Dashboard";
import { useEffect, useState } from "react";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-black text-gray-900 dark:text-white p-6">
      <Header />
      <Dashboard />
    </div>
  );
}

function Header() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const prefersDark = localStorage.theme === "dark";
    document.documentElement.classList.toggle("dark", prefersDark);
    setIsDark(prefersDark);
  }, []);

  const toggleTheme = () => {
    const newMode = !isDark;
    document.documentElement.classList.toggle("dark", newMode);
    localStorage.theme = newMode ? "dark" : "light";
    setIsDark(newMode);
  };

  return (
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-2xl font-bold">Graph Dashboard</h1>
      <div className="flex items-center space-x-4">
        <span className="text-xs text-gray-500 dark:text-gray-400">v1.0.1</span>
        <button
          onClick={toggleTheme}
          className="text-sm border px-3 py-1 rounded"
        >
          {isDark ? "☀ Light" : "🌙 Dark"}
        </button>
      </div>
    </div>
  );
}
