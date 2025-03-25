import Dashboard from "./components/Dashboard";
import ThemeToggle from "./components/ThemeToggle";
import DelegationActivity from "./components/DelegationActivity";

function App() {
  return (
    <div className="min-h-screen px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl sm:text-2xl font-bold">
          Delegation Activity Log for The Graph Network 👩‍🚀
        </h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">v1.0.1</span>
          <ThemeToggle />
        </div>
      </div>
      <Dashboard />
      <DelegationActivity />
    </div>
  );
}

export default App;