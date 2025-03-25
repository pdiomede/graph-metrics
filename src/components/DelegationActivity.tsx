import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

interface Delegation {
  id: string;
  delegator: { id: string; ensName?: string }; // Added ensName
  indexer: { id: string; ensName?: string };   // Added ensName
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
  const [sortBy, setSortBy] = useState("Updated");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const PAGE_SIZE = 50;

  // GraphQL query for ENS names
  const GET_ENS_NAME = `
    query GetEnsName($address: String!) {
      domains(where: { resolvedAddress: $address, name_ends_with: ".eth" }, first: 1) {
        name
      }
    }
  `;

  const fetchEnsName = async (address: string): Promise<string | null> => {
    try {
      const response = await fetch(import.meta.env.VITE_ENS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: GET_ENS_NAME,
          variables: { address: address.toLowerCase() },
        }),
      });

      const data = await response.json();
      if (data.data?.domains?.length > 0) {
        return data.data.domains[0].name;
      }
      return null;
    } catch (error) {
      console.error("Error fetching ENS name:", error);
      return null;
    }
  };

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
      .then((res) => res.json())
      .then(async (res) => {
        const delegationData = res.data.delegatedStakes;

        // Fetch ENS names for all records
        const enhancedDelegations = await Promise.all(
          delegationData.map(async (d: any) => {
            const delegatorEns = await fetchEnsName(d.delegator.id);
            const indexerEns = await fetchEnsName(d.indexer.id);

            return {
              ...d,
              delegator: { ...d.delegator, ensName: delegatorEns },
              indexer: { ...d.indexer, ensName: indexerEns },
            };
          })
        );

        setDelegations(enhancedDelegations);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load delegation activity.");
        setLoading(false);
      });
  };

  const exportCSV = () => {
    const headers = ["Type", "Delegator", "Delegator ENS", "Indexer", "Indexer ENS", "Amount", "Updated"];
    const csvContent = [
      headers.join(","),
      ...sorted.map((d) => {
        const delegatedAt = d.lastDelegatedAt || 0;
        const undelegatedAt = d.lastUndelegatedAt || 0;
        const isDelegation = delegatedAt >= undelegatedAt;
        const updatedAt = new Date((isDelegation ? delegatedAt : undelegatedAt) * 1000);
        const amount = isDelegation ? d.stakedTokens : d.unstakedTokens;

        return [
          isDelegation ? "Delegation" : "Undelegation",
          `"${d.delegator.id}"`,
          `"${d.delegator.ensName || ""}"`,
          `"${d.indexer.id}"`,
          `"${d.indexer.ensName || ""}"`,
          formatAmount(amount),
          updatedAt.toISOString(),
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.setAttribute("href", url);
    link.setAttribute("download", `delegation-activity-${timestamp}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    fetchDelegations();
  }, []);

  const filtered = delegations.filter((d) =>
    d.delegator.id.toLowerCase().includes(filter.toLowerCase()) ||
    d.indexer.id.toLowerCase().includes(filter.toLowerCase())
  );

  const totalDelegatedGRT = filtered.reduce((acc, d) => {
    const delegatedAt = d.lastDelegatedAt || 0;
    const undelegatedAt = d.lastUndelegatedAt || 0;
    return delegatedAt >= undelegatedAt ? acc + Number(d.stakedTokens) / 1e18 : acc;
  }, 0);

  const totalUndelegatedGRT = filtered.reduce((acc, d) => {
    const delegatedAt = d.lastDelegatedAt || 0;
    const undelegatedAt = d.lastUndelegatedAt || 0;
    return undelegatedAt > delegatedAt ? acc + Number(d.unstakedTokens) / 1e18 : acc;
  }, 0);

  const netChange = totalDelegatedGRT - totalUndelegatedGRT;

  const sorted = [...filtered].sort((a, b) => {
    const delegatedA = a.lastDelegatedAt || 0;
    const undelegatedA = a.lastUndelegatedAt || 0;
    const delegatedB = b.lastDelegatedAt || 0;
    const undelegatedB = b.lastUndelegatedAt || 0;

    const dateA = Math.max(delegatedA, undelegatedA);
    const dateB = Math.max(delegatedB, undelegatedB);

    const valA = (() => {
      switch (sortBy) {
        case "Type":
          return delegatedA >= undelegatedA ? "Delegation" : "Undelegation";
        case "Delegator":
          return a.delegator.id;
        case "Indexer":
          return a.indexer.id;
        case "Amount":
          return parseFloat(delegatedA >= undelegatedA ? a.stakedTokens : a.un  : a.unstakedTokens);
        case "Updated":
          return dateA;
        default:
          return dateA;
      }
    })();

    const valB = (() => {
      switch (sortBy) {
        case "Type":
          return delegatedB >= undelegatedB ? "Delegation" : "Undelegation";
        case "Delegator":
          return b.delegator.id;
        case "Indexer":
          return b.indexer.id;
        case "Amount":
          return parseFloat(delegatedB >= undelegatedB ? b.stakedTokens : b.unstakedTokens);
        case "Updated":
          return dateB;
        default:
          return dateB;
      }
    })();

    if (valA < valB) return sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

  const toggleSort = (column: string) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDirection("asc");
    }
  };

  const formatAmount = (amt: string) =>
    (Number(amt) / 1e18).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

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


      <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        <p>
          🟢 Total Delegated:{" "}
          <strong>{totalDelegatedGRT.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>{" "}
          GRT
        </p>
        <p>
          🔴 Total Undelegated:{" "}
          <strong>{totalUndelegatedGRT.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>{" "}
          GRT
        </p>
      </div>

      <div className="mb-4 text-sm text-white space-y-1 w-full max-w-sm">
  <div className="flex justify-between">
    <span className="text-white">🟢 Total Delegated:</span>
    <span className="text-white font-semibold text-right w-40">{totalDelegatedGRT.toLocaleString("en-US", { minimumFractionDigits: 3 })} GRT</span>
  </div>
  <div className="flex justify-between">
    <span className="text-white">🔴 Total Undelegated:</span>
    <span className="text-white font-semibold text-right w-40">{totalUndelegatedGRT.toLocaleString("en-US", { minimumFractionDigits: 3 })} GRT</span>
  </div>
  <div className="flex justify-between">
    <span className="text-white">📊 Net:</span>
    <span className="text-white font-semibold text-right w-40">{netChange.toLocaleString("en-US", { minimumFractionDigits: 3 })} GRT</span>
  </div>
</div>


      {error && <p className="text-red-500">{error}</p>}
      {loading && <div className="text-center text-gray-500 py-4">Loading delegations...</div>}
      {!loading && sorted.length === 0 && (
        <div className="text-center text-gray-500 py-4">No delegation activity found.</div>
      )}

      <div className="overflow-auto">
        <table className="min-w-full table-auto border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700 text-left cursor-pointer">
              {["Type", "Delegator", "Indexer", "Amount", "Updated"].map((col) => (
                <th key={col} className="p-2 whitespace-nowrap" onClick={() => toggleSort(col)}>
                  {col} {sortBy === col && (sortDirection === "asc" ? "⬆️" : "⬇️")}
                </th>
              ))}
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
                  <td className="p-2">{isDelegation ? "🟢 Delegation" : "🔴 Undelegation"}</td>
                  <td className="p-2 max-w-xs truncate">
                    <a
                      href={`https://thegraph.com/explorer/profile/${d.delegator.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 underline"
                    >
                      {d.delegator.ensName || d.delegator.id}
                    </a>
                  </td>
                  <td className="p-2 max-w-xs truncate">
                    <a
                      href={`https://thegraph.com/explorer/profile/${d.indexer.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 underline"
                    >
                      {d.indexer.ensName || d.indexer.id}
                    </a>
                  </td>
                  <td className="p-2 text-right">{formatAmount(amount)}</td>
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
            className={`px-3 py-1 border rounded ${
              page === i + 1 ? "bg-gray-300 dark:bg-gray-600" : ""
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
