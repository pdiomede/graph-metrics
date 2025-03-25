import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

interface Delegation {
  id: string;
  delegator: { id: string };
  indexer: { id: string };
  stakedTokens: string;
  unstakedTokens: string;
  lastDelegatedAt: number;
  lastUndelegatedAt: number;
}

export default function DelegationActivity() {
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const PAGE_SIZE = 50;

  const fetchDelegations = () => {
    setLoading(true);
    const query = `
      {
        delegatedStakes(first: 100, orderBy: lastDelegatedAt, orderDirection: desc) {
          id
          stakedTokens
          unstakedTokens
          lastDelegatedAt
          lastUndelegatedAt
          delegator { id }
          indexer { id }
        }
      }
    `;

    fetch(import.meta.env.VITE_GRAPH_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    })
      .then(res => res.json())
      .then(res => {
        console.log('[DelegationActivity] GraphQL response:', res.data);
        setDelegations(res.data.delegatedStakes);
        setLoading(false);
      })
      .catch(err => {
        console.error("DelegationActivity fetch error:", err);
        setError("Failed to load delegation activity.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchDelegations();
  }, []);

  const filtered = delegations.filter(d =>
    d.delegator.id.toLowerCase().includes(filter.toLowerCase()) ||
    d.indexer.id.toLowerCase().includes(filter.toLowerCase())
  );

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const exportCSV = () => {
    const header = "Type,Delegator,Indexer,Amount,Updated\n";
    const rows = filtered.map(d => {
      const isDelegation = (d.lastDelegatedAt || 0) >= (d.lastUndelegatedAt || 0);
      const amount = isDelegation ? d.stakedTokens : d.unstakedTokens;
      const updatedAt = new Date(((isDelegation ? d.lastDelegatedAt : d.lastUndelegatedAt) || 0) * 1000);
      return [
        isDelegation ? "Delegation" : "Undelegation",
        d.delegator.id,
        d.indexer.id,
        (Number(amount) / 1e18).toFixed(2),
        updatedAt.toISOString()
      ].join(",");
    }).join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "delegations.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="mt-10">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">
          <span className="font-normal text-gray-400">(last 100 transactions)</span>
        </h2>
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Filter by address..."
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
            className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          />
          <button onClick={fetchDelegations} className="text-sm px-3 py-1 border rounded">
            🔄 Refresh
          </button>
          <button onClick={exportCSV} className="text-sm px-3 py-1 border rounded">
            ⬇️ Export CSV
          </button>
        </div>
      </div>
      {error && <p className="text-red-500">{error}</p>}
      
      {loading && (
        <div className="text-center text-gray-500 dark:text-gray-400 py-4">Loading delegations...</div>
      )}
      {!loading && filtered.length === 0 && (
        <div className="text-center text-gray-500 dark:text-gray-400 py-4">No delegation activity found.</div>
      )}

      <div className="overflow-auto">
        <table className="min-w-full table-auto border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700 text-left">
              <th className="p-2">Type</th>
              <th className="p-2">Delegator</th>
              <th className="p-2">Indexer</th>
              <th className="p-2">Amount (GRT)</th>
              <th className="p-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((d) => {
              const delegatedAt = d.lastDelegatedAt || 0;
              const undelegatedAt = d.lastUndelegatedAt || 0;
              const isDelegation = delegatedAt >= undelegatedAt;
              const updatedAt = new Date((isDelegation ? delegatedAt : undelegatedAt) * 1000);
              const amount = isDelegation ? d.stakedTokens : d.unstakedTokens;
              return (
                <tr key={d.id} className="border-t border-gray-200 dark:border-gray-600">
                  <td className="p-2">
                    {isDelegation ? (
                      <span className="text-green-600">🟢 Delegation</span>
                    ) : (
                      <span className="text-red-500">🔴 Undelegation</span>
                    )}
                  </td>
                  <td className="p-2"><a href={`https://arbiscan.io/address/${d.delegator.id}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">{d.delegator.id.slice(0, 10)}...</a></td>
                  <td className="p-2"><a href={`https://arbiscan.io/address/${d.indexer.id}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">{d.indexer.id.slice(0, 10)}...</a></td>
                  <td className="p-2">{(Number(amount) / 1e18).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="p-2">{formatDistanceToNow(updatedAt, { addSuffix: true })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-center space-x-2">
        {Array.from({ length: totalPages }).map((_, i) => (
          <button
            key={i}
            onClick={() => setPage(i + 1)}
            className={`px-3 py-1 border rounded ${page === i + 1 ? "bg-gray-300 dark:bg-gray-600" : ""}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
