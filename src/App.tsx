import ThemeToggle from "./components/ThemeToggle";
import DelegationActivity from "./components/DelegationActivity";

function App() {
  return (
    <div className="min-h-screen px-4 py-6 bg-gray-50 dark:bg-gray-900">
      {/* Enhanced Header */}
      <header className="mb-10 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col items-center">
            <div className="mb-3">
              <div className="relative">
                {/* Enhanced logo with multiple animated glow effects */}
                <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-60 animate-pulse"></div>
                <div className="absolute inset-0 bg-purple-500 rounded-full blur-lg opacity-40 animate-ping" style={{ animationDuration: '3s' }}></div>
                {/* Rotating outer ring */}
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-blue-300 animate-spin" style={{ animationDuration: '10s' }}></div>
                {/* Main icon container with enhanced gradient */}
                <div className="relative bg-gradient-to-br from-blue-600 via-indigo-500 to-purple-600 rounded-full p-3 shadow-xl transform hover:scale-110 transition-transform duration-300">
                  {/* Icon with subtle hover rotation */}
                  <img 
                    src="/favicon.png" 
                    alt="The Graph Logo" 
                    className="w-12 h-12 object-contain hover:rotate-12 transition-transform duration-300"
                  />
                </div>
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              The Graph Network
            </h1>
            <p className="mt-2 text-xl text-gray-600 dark:text-gray-300">
              Delegation Activity Dashboard
            </p>
            <div className="mt-4 flex items-center gap-4">
              <span className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300">
                v1.0.5
              </span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto">
        <DelegationActivity />
      </main>
      
      {/* Footer */}
      <footer className="mt-12 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>© {new Date().getFullYear()} The Graph Network Analytics • All data sourced from The Graph Protocol</p>
      </footer>
    </div>
  );
}

export default App;
