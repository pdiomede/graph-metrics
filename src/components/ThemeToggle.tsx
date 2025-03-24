import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (localStorage.theme === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  }, []);

  const toggle = () => {
    const html = document.documentElement;
    const newMode = !isDark;
    html.classList.toggle("dark", newMode);
    localStorage.theme = newMode ? "dark" : "light";
    setIsDark(newMode);
  };

  return (
    <button onClick={toggle} className="text-sm border px-4 py-2 rounded">
      {isDark ? "☀ Light" : "🌙 Dark"}
    </button>
  );
}
