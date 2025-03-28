import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { DelegationActivityChart } from "./DelegationActivityChart";

// Interface definitions
interface Delegation {
  id: string;
  delegator: { id: string; ensName?: string | null };
  indexer: {
    id: string;
    ensName?: string | null;
    account?: {
      metadata?: {
        image?: string;
      };
    };
  };
  stakedTokens: string;
  unstakedTokens: string;
  lastDelegatedAt: number;
  lastUndelegatedAt: number;
  tx_hash?: string;
}

interface StakeEvent {
  id: string;
  delegator: string;
  indexer: string;
  tokens: string;
  blockTimestamp: string;
  transactionHash: string;
}

export default function DelegationActivity() {
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [totalDelegators, setTotalDelegators] = useState<number | null>(null);
  const [activeDelegators, setActiveDelegators] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("Updated");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [timeFilter, setTimeFilter] = useState<"all" | "24h" | "48h" | "72h">("all");
  const PAGE_SIZE = 50;

  // ENS Query for fetching ENS names
  const GET_ENS_NAME = `
    query GetEnsName($address: String!) {
      domains(where: { resolvedAddress: $address, name_ends_with: ".eth" }, first: 1) {
        name
      }
    }
  `;

  // Cache for ENS names to avoid repeated requests
  const ensCache = new Map<string, string | null>();

  const fetchEnsName = async (address: string): Promise<string | null> => {
    if (ensCache.has(address)) {
      return ensCache.get(address)!;
    }

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
      if (data.errors) {
        throw new Error(data.errors[0].message);
      }

      const ensName = data.data?.domains?.[0]?.name || null;
      ensCache.set(address, ensName);
      return ensName;
    } catch (error) {
      console.error(`Error fetching ENS name for ${address}:`, error);
      ensCache.set(address, null);
      return null;
    }
  };

  // Fetch delegation events and stats
  const fetchDelegations = async () => {
    setLoading(true);
    setError(null);

    // Query for stake events (from VITE_GRAPH_API)
    const eventsQuery = `
      {
        stakeDelegateds(first: 1000, orderBy: blockTimestamp, orderDirection: desc) {
          id
          delegator
          indexer
          tokens
          blockTimestamp
          transactionHash
        }
        stakeDelegatedWithdrawns(first: 1000, orderBy: blockTimestamp, orderDirection: desc) {
          id
          delegator
          indexer
          tokens
          blockTimestamp
          transactionHash
        }
      }
    `;

    // Query for delegator stats (from VITE_API_URL)
    const statsQuery = `
      {
        graphNetwork(id: "1") {
          delegatorCount
          activeDelegatorCount
        }
      }
    `;

    try {
      console.log("Fetching from Events API:", import.meta.env.VITE_GRAPH_API);
      console.log("Fetching from Stats API:", import.meta.env.VITE_API_URL);
      
      // Fetch both events and stats concurrently
      const [eventsResponse, statsResponse] = await Promise.all([
        fetch(import.meta.env.VITE_GRAPH_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: eventsQuery }),
        }),
        fetch(import.meta.env.VITE_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: statsQuery }),
        }),
      ]);

      const eventsData = await eventsResponse.json();
      const statsData = await statsResponse.json();

      console.log("Events API response:", eventsData);
      console.log("Stats API response:", statsData);

      // Check for errors in the responses
      if (eventsData.errors) {
        console.error("Events query errors:", eventsData.errors);
        throw new Error(`Events query failed: ${eventsData.errors[0].message}`);
      }
      
      // Handle stats data - even if there are errors, try to continue
      if (statsData.errors) {
        console.error("Stats query errors:", statsData.errors);
        // Don't throw here, just set defaults
        setTotalDelegators(0);
        setActiveDelegators(0);
      } else if (statsData.data?.graphNetwork) {
        // Parse as numbers to ensure proper formatting
        setTotalDelegators(Number(statsData.data.graphNetwork.delegatorCount));
        setActiveDelegators(Number(statsData.data.graphNetwork.activeDelegatorCount));
      } else {
        console.error("Invalid stats API response structure:", statsData);
        setTotalDelegators(0);
        setActiveDelegators(0);
      }

      // Validate the events response structure
      if (!eventsData.data?.stakeDelegateds || !eventsData.data?.stakeDelegatedWithdrawns) {
        console.error("Invalid events API response:", eventsData);
        throw new Error("Invalid API response structure for events");
      }

      // Process delegated events
      const depositedEvents: Delegation[] = eventsData.data.stakeDelegateds.map((event: StakeEvent) => ({
        id: event.id,
        delegator: { id: event.delegator },
        indexer: {
          id: event.indexer,
          account: { metadata: { image: null } },
        },
        stakedTokens: event.tokens,
        unstakedTokens: "0",
        lastDelegatedAt: parseInt(event.blockTimestamp),
        lastUndelegatedAt: 0,
        tx_hash: event.transactionHash,
      }));

      // Process withdrawn events
      const withdrawnEvents: Delegation[] = eventsData.data.stakeDelegatedWithdrawns.map((event: StakeEvent) => ({
        id: event.id,
        delegator: { id: event.delegator },
        indexer: {
          id: event.indexer,
          account: { metadata: { image: null } },
        },
        stakedTokens: "0",
        unstakedTokens: event.tokens,
        lastDelegatedAt: 0,
        lastUndelegatedAt: parseInt(event.blockTimestamp),
        tx_hash: event.transactionHash,
      }));

      // Combine and sort events by timestamp (most recent first)
      const combinedEvents = [...depositedEvents, ...withdrawnEvents]
        .sort((a, b) => {
          const timeA = Math.max(a.lastDelegatedAt, a.lastUndelegatedAt);
          const timeB = Math.max(b.lastDelegatedAt, b.lastUndelegatedAt);
          return timeB - timeA;
        })
        .slice(0, 100);

      // Enhance with ENS names
      const enhancedDelegations = await Promise.all(
        combinedEvents.map(async (d) => {
          const [delegatorEns, indexerEns] = await Promise.all([
            fetchEnsName(d.delegator.id),
            fetchEnsName(d.indexer.id),
          ]);
          return {
            ...d,
            delegator: { ...d.delegator, ensName: delegatorEns },
            indexer: { ...d.indexer, ensName: indexerEns },
          };
        })
      );

      setDelegations(enhancedDelegations);
      setLoading(false);
    } catch (err: unknown) {
      console.error("Error fetching delegation data:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to load delegation activity: ${errorMessage}`);
      setDelegations([]);
      setLoading(false);
    }
  };

  // Export the table data as a CSV file
  const exportCSV = () => {
    const headers = ["Type", "Delegator", "Delegator ENS", "Indexer", "Indexer ENS", "Transaction", "Amount", "Updated"];
    const csvContent = [
      headers.join(","),
      ...sorted.map((d) => {
        const isDelegation = d.lastDelegatedAt >= d.lastUndelegatedAt;
        const updatedAt = new Date((isDelegation ? d.lastDelegatedAt : d.lastUndelegatedAt) * 1000);
        const amount = isDelegation ? d.stakedTokens : d.unstakedTokens;

        return [
          isDelegation ? "Delegation" : "Undelegation",
          `"${d.delegator.id}"`,
          `"${d.delegator.ensName || ""}"`,
          `"${d.indexer.id}"`,
          `"${d.indexer.ensName || ""}"`,
          `"${d.tx_hash || ""}"`,
          formatAmount(amount),
          updatedAt.toISOString(),
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `delegation-activity-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchDelegations();
  }, []);

  // Filtering logic: Apply indexer filter
  const filtered = delegations.filter((d) =>
    d.indexer.id.toLowerCase().includes(filter.toLowerCase()) ||
    (d.indexer.ensName?.toLowerCase().includes(filter.toLowerCase()) ?? false)
  );

  // Time filtering logic: Apply time range filter
  const now = Date.now();
  const timeFiltered = filtered.filter((d) => {
    const latestTime = Math.max(d.lastDelegatedAt, d.lastUndelegatedAt) * 1000;
    switch (timeFilter) {
      case "24h":
        return latestTime >= now - 24 * 60 * 60 * 1000;
      case "48h":
        return latestTime >= now - 48 * 60 * 60 * 1000;
      case "72h":
        return latestTime >= now - 72 * 60 * 60 * 1000;
      default:
        return true;
    }
  });

  // Calculate totals using timeFiltered data (after both filters are applied)
  const totalDelegatedGRT = timeFiltered.reduce((acc, d) => {
    if (d.lastDelegatedAt >= d.lastUndelegatedAt) {
      const tokens = Number(d.stakedTokens);
      return isNaN(tokens) ? acc : acc + tokens / 1e18;
    }
    return acc;
  }, 0);

  const totalUndelegatedGRT = timeFiltered.reduce((acc, d) => {
    if (d.lastUndelegatedAt > d.lastDelegatedAt) {
      const tokens = Number(d.unstakedTokens);
      return isNaN(tokens) ? acc : acc + tokens / 1e18;
    }
    return acc;
  }, 0);

  const netChange = totalDelegatedGRT - totalUndelegatedGRT;

  // Sorting logic
  const sorted = [...timeFiltered].sort((a, b) => {
    const dateA = Math.max(a.lastDelegatedAt, a.lastUndelegatedAt);
    const dateB = Math.max(b.lastDelegatedAt, b.lastUndelegatedAt);

    const valA =
      sortBy === "Type"
        ? a.lastDelegatedAt >= a.lastUndelegatedAt
          ? "Delegation"
          : "Undelegation"
        : sortBy === "Delegator"
        ? a.delegator.id
        : sortBy === "Indexer"
        ? a.indexer.id
        : sortBy === "Amount"
        ? parseFloat(a.lastDelegatedAt >= a.lastUndelegatedAt ? a.stakedTokens : a.unstakedTokens)
        : dateA;

    const valB =
      sortBy === "Type"
        ? b.lastDelegatedAt >= b.lastUndelegatedAt
          ? "Delegation"
          : "Undelegation"
        : sortBy === "Delegator"
        ? b.delegator.id
        : sortBy === "Indexer"
        ? b.indexer.id
        : sortBy === "Amount"
        ? parseFloat(b.lastDelegatedAt >= b.lastUndelegatedAt ? b.stakedTokens : b.unstakedTokens)
        : dateB;

    return (valA < valB ? -1 : 1) * (sortDirection === "asc" ? 1 : -1);
  });

  // Pagination logic
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

  // Toggle sorting direction
  const toggleSort = (column: string) => {
    setSortBy(column);
    setSortDirection(sortBy === column && sortDirection === "asc" ? "desc" : "asc");
  };

  // Format token amounts (convert from wei to GRT)
  const formatAmount = (amt: string) =>
    (Number(amt) / 1e18).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // JSX Rendering
  return (
    <div className="mt-10">
      {/* Header with time filter buttons */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">
          <span className="font-normal text-gray-400">(last 1000 transactions)</span>
          <span className="ml-4 text-sm space-x-2">
            {["all", "24h", "48h", "72h"].map((key) => (
              <button
                key={key}
                className={`underline ${timeFilter === key ? "font-bold" : ""}`}
                onClick={() => setTimeFilter(key as "all" | "24h" | "48h" | "72h")}
              >
                {key === "all" ? "All" : `Last ${key}`}
              </button>
            ))}
          </span>
        </h2>
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Filter by Indexer ..."
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
            className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-gray-800 text-white placeholder-gray-400"
          />
          <button onClick={fetchDelegations} className="text-sm px-3 py-1 border rounded bg-gray-700 text-white">
            🔄 Refresh
          </button>
          <button onClick={exportCSV} className="text-sm px-3 py-1 border rounded bg-gray-700 text-white">
            ⬇️ Export CSV
          </button>
        </div>
      </div>


{/* Stats Cards */}
<div className="flex flex-wrap gap-4 mb-6">
  <div className="bg-gray-800 p-4 rounded-lg flex-1 min-w-[200px]">
    <h3 className="text-sm font-semibold text-gray-300 text-left">Total Delegators</h3>
    <p className="text-xl font-bold text-white mt-1 text-right">
      {totalDelegators !== null ? totalDelegators.toLocaleString() : "Loading..."}
    </p>
  </div>
  <div className="bg-gray-800 p-4 rounded-lg flex-1 min-w-[200px]">
    <h3 className="text-sm font-semibold text-gray-300 text-left">Active Delegators</h3>
    <p className="text-xl font-bold text-white mt-1 text-right">
      {activeDelegators !== null ? activeDelegators.toLocaleString() : "Loading..."}
    </p>
  </div>
  <div className="bg-gray-800 p-4 rounded-lg flex-1 min-w-[200px]">
    <h3 className="text-sm font-semibold text-gray-300 text-left">🟢 Total Delegated</h3>
    <p className="text-xl font-bold text-white mt-1 text-right">
      {Math.round(totalDelegatedGRT).toLocaleString()} GRT
    </p>
  </div>
  <div className="bg-gray-800 p-4 rounded-lg flex-1 min-w-[200px]">
    <h3 className="text-sm font-semibold text-gray-300 text-left">🔴 Total Undelegated</h3>
    <p className="text-xl font-bold text-white mt-1 text-right">
      {Math.round(totalUndelegatedGRT).toLocaleString()} GRT
    </p>
  </div>
  <div className="bg-gray-800 p-4 rounded-lg flex-1 min-w-[200px]">
    <h3 className="text-sm font-semibold text-gray-300 text-left">📊 Net Change</h3>
    <p className={`text-xl font-bold mt-1 text-right ${netChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
      {Math.round(netChange).toLocaleString()} GRT
    </p>
  </div>
</div>

{/* Charts */}
{!loading && timeFiltered.length > 0 && (
  <div className="mb-8">
    <DelegationActivityChart delegations={timeFiltered} timeFilter={timeFilter} />
  </div>
)}

      {/* Error and Loading States */}
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {loading && <div className="text-center text-gray-500 py-4">Loading delegations...</div>}
      {!loading && sorted.length === 0 && (
        <div className="text-center text-gray-500 py-4">No delegation activity found.</div>
      )}

      {/* Delegation Table */}
      {sorted.length > 0 && (
        <div className="overflow-auto">
          <table className="min-w-full table-auto border-collapse text-sm text-white">
            <thead>
              <tr className="bg-gray-700 text-left cursor-pointer">
                {["Type", "Delegator", "Indexer", "Transaction", "Amount", "Updated"].map((col) => (
                  <th key={col} className="p-2 whitespace-nowrap" onClick={() => toggleSort(col)}>
                    {col} {sortBy === col && (sortDirection === "asc" ? "⬆️" : "⬇️")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((d) => {
                const isDelegation = d.lastDelegatedAt >= d.lastUndelegatedAt;
                const updatedAt = new Date((isDelegation ? d.lastDelegatedAt : d.lastUndelegatedAt) * 1000);
                const amount = isDelegation ? d.stakedTokens : d.unstakedTokens;

                return (
                  <tr key={d.id} className="border-t border-gray-600">
                    <td className="p-2">{isDelegation ? "🟢 Delegation" : "🔴 Undelegation"}</td>
                    <td className="p-2 max-w-xs truncate">
                      <a
                        href={`https://thegraph.com/explorer/profile/${d.delegator.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 underline"
                      >
                        {d.delegator.ensName || d.delegator.id}
                      </a>
                    </td>
                    <td className="p-2 max-w-xs truncate flex items-center space-x-2">
                      {d.indexer.account?.metadata?.image ? (
                        <img src={d.indexer.account.metadata.image} alt="avatar" className="w-5 h-5 rounded-full" />
                      ) : (
                        <span className="text-lg">🔗</span>
                      )}
                      <a
                        href={`https://thegraph.com/explorer/profile/${d.indexer.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 underline ml-1"
                      >
                        {d.indexer.ensName || d.indexer.id}
                      </a>
                    </td>
                    <td className="p-2">
                      {d.tx_hash && (
                        <a
                          href={`https://arbiscan.io/tx/${d.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 underline"
                        >
                          {d.tx_hash.slice(0, 8)}...
                        </a>
                      )}
                    </td>
                    <td className="p-2 text-right">{formatAmount(amount)}</td>
                    <td className="p-2">{formatDistanceToNow(updatedAt, { addSuffix: true })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {sorted.length > 0 && (
        <div className="mt-4 flex justify-center space-x-2">
          {Array.from({ length: Math.min(totalPages, 10) }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`px-3 py-1 border rounded ${
                page === i + 1 ? "bg-gray-600" : "bg-gray-700"
              } text-white`}
            >
              {i + 1}
            </button>
          ))}
          {totalPages > 10 && <span className="text-gray-400 px-2">...</span>}
        </div>
      )}
    </div>
  );
}
