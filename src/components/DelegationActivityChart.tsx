import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Define the Delegation interface
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

interface DelegationActivityChartProps {
  delegations: Delegation[];
  timeFilter: "all" | "24h" | "48h" | "72h";
}

export function DelegationActivityChart({ delegations, timeFilter }: DelegationActivityChartProps) {
  // Transform delegations data for the chart
  const chartData = useMemo(() => {
    // Group delegations by day
    const groupedByDay = delegations.reduce((acc, delegation) => {
      const isDelegation = delegation.lastDelegatedAt >= delegation.lastUndelegatedAt;
      const timestamp = isDelegation ? delegation.lastDelegatedAt : delegation.lastUndelegatedAt;
      const date = new Date(timestamp * 1000);
      const day = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      if (!acc[day]) {
        acc[day] = {
          date: day,
          delegated: 0,
          undelegated: 0,
          net: 0
        };
      }
      
      const amount = Math.round(Number(isDelegation ? delegation.stakedTokens : delegation.unstakedTokens) / 1e18);
      
      if (isDelegation) {
        acc[day].delegated += amount;
      } else {
        acc[day].undelegated += amount;
      }
      
      acc[day].net = acc[day].delegated - acc[day].undelegated;
      
      return acc;
    }, {} as Record<string, { date: string; delegated: number; undelegated: number; net: number }>);
    
    // Convert to array and sort by date
    return Object.values(groupedByDay)
      .sort((a, b) => (a.date as string).localeCompare(b.date as string))
      .map(day => ({
        ...day,
        // Format date for display
        date: new Date(day.date as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }));
  }, [delegations]);

  // Calculate totals
  const totalDelegated = useMemo(() => {
    return delegations.reduce((acc, d) => {
      if (d.lastDelegatedAt >= d.lastUndelegatedAt) {
        const tokens = Number(d.stakedTokens);
        return isNaN(tokens) ? acc : acc + Math.round(tokens / 1e18);
      }
      return acc;
    }, 0);
  }, [delegations]);

  const totalUndelegated = useMemo(() => {
    return delegations.reduce((acc, d) => {
      if (d.lastUndelegatedAt > d.lastDelegatedAt) {
        const tokens = Number(d.unstakedTokens);
        return isNaN(tokens) ? acc : acc + Math.round(tokens / 1e18);
      }
      return acc;
    }, 0);
  }, [delegations]);

  const netChange = totalDelegated - totalUndelegated;

  // Calculate net change by indexer
  const indexerNetChange = useMemo(() => {
    const indexerMap = delegations.reduce((acc, delegation) => {
      const indexerId = delegation.indexer.id;
      const indexerName = delegation.indexer.ensName || indexerId.substring(0, 6) + '...' + indexerId.substring(indexerId.length - 4);
      
      if (!acc[indexerId]) {
        acc[indexerId] = {
          name: indexerName,
          delegated: 0,
          undelegated: 0,
          net: 0
        };
      }
      
      const isDelegation = delegation.lastDelegatedAt >= delegation.lastUndelegatedAt;
      const amount = Math.round(Number(isDelegation ? delegation.stakedTokens : delegation.unstakedTokens) / 1e18);
      
      if (isDelegation) {
        acc[indexerId].delegated += amount;
      } else {
        acc[indexerId].undelegated += amount;
      }
      
      acc[indexerId].net = acc[indexerId].delegated - acc[indexerId].undelegated;
      
      return acc;
    }, {} as Record<string, { name: string; delegated: number; undelegated: number; net: number }>);
    
    // Convert to array, sort by net change, and take top 10
    return Object.values(indexerMap)
      .sort((a, b) => Math.abs(b.net as number) - Math.abs(a.net as number))
      .slice(0, 10);
  }, [delegations]);

  return (
    <div className="space-y-8">
      {/* Activity Over Time Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Delegation Activity Over Time</CardTitle>
          <CardDescription>
            {timeFilter === "all" ? "All time" : `Last ${timeFilter}`} delegation activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="date" stroke="#888" tickLine={false} axisLine={false} />
              <YAxis 
                stroke="#888" 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(value) => `${Math.round(Math.abs(value)).toLocaleString()}`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1f2937', 
                  border: '1px solid #374151', 
                  borderRadius: '0.5rem',
                  color: '#fff'
                }}
                formatter={(value: number, name: string) => {
                  return [
                    <span style={{ color: value >= 0 ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                      {Math.round(value).toLocaleString()} GRT
                    </span>, 
                    name
                  ];
                }}
                labelStyle={{ color: '#d1d5db', marginBottom: '4px' }}
              />
              <Legend 
                iconType="circle" 
                wrapperStyle={{ paddingTop: 10 }}
              />
              <Area 
                type="monotone" 
                dataKey="delegated" 
                name="Delegated" 
                stroke="#22c55e" 
                fill="#22c55e" 
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Area 
                type="monotone" 
                dataKey="undelegated" 
                name="Undelegated" 
                stroke="#ef4444" 
                fill="#ef4444" 
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Area 
                type="monotone" 
                dataKey="net" 
                name="Net Change" 
                stroke="#3b82f6" 
                fill="#3b82f6" 
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Indexers by Net Change */}
      <Card>
        <CardHeader>
          <CardTitle>Top Indexers by Net Change</CardTitle>
          <CardDescription>
            Indexers with the largest delegation changes {timeFilter === "all" ? "all time" : `in the last ${timeFilter}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={indexerNetChange} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis 
                type="number" 
                stroke="#888" 
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${Math.round(Math.abs(value)).toLocaleString()}`}
              />
              <YAxis 
                dataKey="name" 
                type="category" 
                width={150} 
                stroke="#888" 
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1f2937', 
                  border: '1px solid #374151', 
                  borderRadius: '0.5rem',
                  color: '#fff'
                }}
                formatter={(value: number, name: string) => {
                  return [
                    <span style={{ color: value >= 0 ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                      {Math.round(value).toLocaleString()} GRT
                    </span>, 
                    name
                  ];
                }}
                labelStyle={{ color: '#d1d5db', marginBottom: '4px' }}
              />
              <Legend 
                iconType="circle" 
                wrapperStyle={{ paddingTop: 10 }}
                // This customizes the legend text color to white
                formatter={(value: string) => <span style={{ color: '#ffffff' }}>{value}</span>}
              />
              <Bar 
                dataKey="net" 
                name="Net Change" 
                barSize={20}
                radius={[0, 4, 4, 0]}
                fill="#ffffff"
              >
                {indexerNetChange.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={(entry.net as number) >= 0 ? "#22c55e" : "#ef4444"} 
                    fillOpacity={0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
