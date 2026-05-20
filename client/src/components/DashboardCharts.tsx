'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, BarChart3, PieChart as PieIcon } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const CHANNELS = ['email', 'sms', 'push', 'in_app'];
const STATUS_COLORS = {
  delivered: '#10b981',   // Emerald / Green
  sent: '#3b82f6',        // Blue
  queued: '#f59e0b',      // Amber / Orange
  processing: '#8b5cf6',  // Purple
  failed: '#ef4444',      // Red
};

type Matrix = Record<string, Record<string, number>>;

export function DashboardCharts() {
  const [data, setData] = useState<Matrix>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);
  const fetching = useRef(false);

  const fetchData = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    setLoading(true);
    setError(null);

    try {
      const matrix = await api.getNotificationMatrix();
      setData(matrix);
      setLastFetch(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load chart metrics');
    } finally {
      setLoading(false);
      fetching.current = false;
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchData();
    const t = setInterval(fetchData, 30000);
    return () => clearInterval(t);
  }, [fetchData]);

  if (!mounted) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-[360px] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl animate-pulse" />
        <div className="h-[360px] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl animate-pulse" />
      </div>
    );
  }

  // Parse data for Stacked Bar Chart (Channel Volume)
  const barChartData = CHANNELS.map(ch => {
    const channelName = ch === 'in_app' ? 'In-App' : ch.toUpperCase();
    return {
      name: channelName,
      Delivered: data[ch]?.delivered ?? 0,
      Sent: data[ch]?.sent ?? 0,
      Queued: data[ch]?.queued ?? 0,
      Processing: data[ch]?.processing ?? 0,
      Failed: data[ch]?.failed ?? 0,
    };
  });

  // Calculate status totals for Pie/Donut Chart
  const statusTotals = {
    delivered: 0,
    sent: 0,
    queued: 0,
    processing: 0,
    failed: 0,
  };

  let totalNotifications = 0;

  CHANNELS.forEach(ch => {
    statusTotals.delivered += data[ch]?.delivered ?? 0;
    statusTotals.sent += data[ch]?.sent ?? 0;
    statusTotals.queued += data[ch]?.queued ?? 0;
    statusTotals.processing += data[ch]?.processing ?? 0;
    statusTotals.failed += data[ch]?.failed ?? 0;
  });

  const pieChartData = [
    { name: 'Delivered', value: statusTotals.delivered, color: STATUS_COLORS.delivered },
    { name: 'Sent', value: statusTotals.sent, color: STATUS_COLORS.sent },
    { name: 'Queued', value: statusTotals.queued, color: STATUS_COLORS.queued },
    { name: 'Processing', value: statusTotals.processing, color: STATUS_COLORS.processing },
    { name: 'Failed', value: statusTotals.failed, color: STATUS_COLORS.failed },
  ].filter(item => {
    totalNotifications += item.value;
    return item.value > 0;
  });

  // Fallback placeholder data if all values are 0
  const isDataEmpty = totalNotifications === 0;
  const displayPieData = isDataEmpty
    ? [
        { name: 'No Data Available', value: 1, color: 'var(--border-color)' }
      ]
    : pieChartData;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] p-3 rounded-lg shadow-xl text-xs">
          <p className="font-bold text-[var(--text-primary)] mb-1.5">{payload[0].name}</p>
          {payload.map((pld: any) => (
            <div key={pld.name} className="flex items-center gap-2 text-[var(--text-secondary)] py-0.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pld.color || pld.payload.color }} />
              <span className="capitalize">{pld.name}:</span>
              <span className="font-semibold text-[var(--text-primary)] tabular-nums">{pld.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Chart Control Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${loading ? 'bg-amber-400' : 'bg-green-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${loading ? 'bg-amber-500' : 'bg-green-500'}`}></span>
          </span>
          <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Metrics Overview</span>
        </div>
        <div className="flex items-center gap-2">
          {lastFetch && (
            <span className="text-[0.65rem] text-[var(--text-muted)] font-mono">
              Live Sync: {lastFetch.toLocaleTimeString()}
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={fetchData} disabled={loading} className="h-6 w-6 rounded-md hover:bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
            <RotateCcw size={11} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie/Donut Chart Card */}
        <Card className="overflow-hidden border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <PieIcon size={14} className="text-[var(--accent)]" />
              Delivery Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center min-h-[300px] relative">
            {error ? (
              <p className="text-xs text-[var(--text-muted)]">{error}</p>
            ) : (
              <>
                <div className="w-full h-[220px] relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={displayPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={isDataEmpty ? 0 : 3}
                        dataKey="value"
                      >
                        {displayPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      {!isDataEmpty && <Tooltip content={<CustomTooltip />} />}
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Total Counter in center */}
                  <div className="absolute flex flex-col items-center justify-center pointer-events-none text-center">
                    <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums leading-none">
                      {totalNotifications}
                    </span>
                    <span className="text-[0.65rem] uppercase font-bold text-[var(--text-muted)] tracking-wider mt-1.5">
                      Total Sent
                    </span>
                  </div>
                </div>

                {/* Custom Legend */}
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2 px-4">
                  {isDataEmpty ? (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--border-color)]" />
                      No notification logs found.
                    </div>
                  ) : (
                    pieChartData.map(item => (
                      <div key={item.name} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-[var(--text-secondary)]">{item.name}</span>
                        <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                          ({item.value})
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Stacked Bar Chart Card */}
        <Card className="overflow-hidden border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 size={14} className="text-[var(--accent)]" />
              Volume by Channel
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-center min-h-[300px] pt-4">
            {error ? (
              <p className="text-xs text-[var(--text-muted)]">{error}</p>
            ) : (
              <div className="w-full h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={barChartData}
                    margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} />
                    <XAxis
                      dataKey="name"
                      stroke="var(--text-muted)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--text-muted)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-tertiary)', opacity: 0.15 }} />
                    <Legend
                      verticalAlign="bottom"
                      height={32}
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => <span className="text-xs text-[var(--text-secondary)] capitalize">{value}</span>}
                    />
                    <Bar dataKey="Delivered" stackId="a" fill={STATUS_COLORS.delivered} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Sent" stackId="a" fill={STATUS_COLORS.sent} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Queued" stackId="a" fill={STATUS_COLORS.queued} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Processing" stackId="a" fill={STATUS_COLORS.processing} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Failed" stackId="a" fill={STATUS_COLORS.failed} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
