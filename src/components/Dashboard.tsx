import { useEffect, useState } from "react";
import CountUp from "react-countup";
import { formatDistanceToNow } from "date-fns";


interface GraphData {
  totalSupply: string;
  delegatorCount: string;
  activeDelegatorCount: string;
  curatorCount: string;
}

function formatGRT(grt: string): string {
  const grtNumber = Number(grt) / 1e18;
  const billions = grtNumber / 1e9;
  return billions.toFixed(2) + " B GRT";
}

export default function Dashboard() {
  const [data, setData] = useState<GraphData | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = `
      {
        graphNetwork(id: "1") {
          totalSupply
          delegatorCount
          activeDelegatorCount
          curatorCount
        }
      }
    `;

    fetch(import.meta.env.VITE_GRAPH_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    })
      .then((res) => res.json())
      .then((result) => {
        const g = result?.data?.graphNetwork;
        if (!g) throw new Error("No graphNetwork entity returned.");
        setData({
          totalSupply: g.totalSupply,
          delegatorCount: g.delegatorCount,
          activeDelegatorCount: g.activeDelegatorCount,
          curatorCount: g.curatorCount,
        });
        setFetchedAt(new Date());
      })
      .catch((err) => {
        console.error("GraphQL fetch error:", err);
        setError(err.message);
      });
  }, []);

  const exportCSV = () => {
    if (!data) return;
    const headers = ["Metric", "Value"];
    const rows = [
      ["Total GRT Supply", data.totalSupply],
      ["Total Delegators", data.delegatorCount],
      ["Active Delegators", data.activeDelegatorCount],
      ["Total Curators", data.curatorCount]
    ];
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows].map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "graph_metrics.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const aiSummary = data
    ? `🧠 AI Summary: The Graph Network currently has ${formatGRT(data.totalSupply)} in supply, ${parseInt(data.delegatorCount).toLocaleString()} total delegators, and ${parseInt(data.curatorCount).toLocaleString()} curators.`
    : null;

  return (
    <div>

      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card title="Total GRT Supply" value={data?.totalSupply} readable />
        <Card title="Total Delegators" value={data?.delegatorCount} />
        <Card title="Active Delegators" value={data?.activeDelegatorCount} />
        <Card title="Total Curators" value={data?.curatorCount} />
      </div>

      {fetchedAt && (
        <p className="mt-4 text-xs text-gray-500">
          Updated: {formatDistanceToNow(fetchedAt, { addSuffix: true })}
        </p>
      )}
      {aiSummary && (
        <div className="mt-4 p-4 text-sm bg-blue-50 dark:bg-blue-900 dark:text-white rounded shadow-sm">
          {aiSummary}
        </div>
      )}

      <button
        onClick={exportCSV}
        className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded"
      >
        📥 Export CSV
      </button>

      {error && <p className="mt-4 text-red-500">{error}</p>}

      
    </div>
  );
}

function Card({ title, value, readable }: { title: string; value?: string; readable?: boolean }) {
  const formatted = readable && value ? formatGRT(value) : undefined;
  return (
    <div
      className="rounded-lg shadow-md p-4 sm:p-6 bg-white dark:bg-gray-800 hover:shadow-xl transition"
      title={title}
    >
      <h2 className="text-md sm:text-lg font-semibold">{title}</h2>
      <p className="text-xl sm:text-2xl mt-2 font-medium">
        {value ? (
          readable ? (
            formatted
          ) : (
            <CountUp end={parseInt(value)} separator="," duration={1.4} />
          )
        ) : (
          "Loading..."
        )}
      </p>
    </div>
  );
}
