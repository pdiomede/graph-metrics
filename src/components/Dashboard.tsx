import { useEffect, useState } from "react";
import CountUp from "react-countup";
import { formatDistanceToNow } from "date-fns";


interface GraphData {
  delegatorCount: string;
  activeDelegatorCount: string;
}

function formatGRT(grt: string): string {
  const value = parseInt(grt);
  const billions = value / 1e9;
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
          delegatorCount
          activeDelegatorCount
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
          delegatorCount: g.delegatorCount,
          activeDelegatorCount: g.activeDelegatorCount
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
      ["Total Delegators", data.delegatorCount],
      ["Active Delegators", data.activeDelegatorCount],
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

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card title="Total Delegators" value={data?.delegatorCount} />
        <Card title="Active Delegators" value={data?.activeDelegatorCount} />
      </div>
      
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
