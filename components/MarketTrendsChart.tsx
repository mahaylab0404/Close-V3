
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getMarketData } from '../services/geminiService';

export const MarketTrendsChart: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [source, setSource] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [loading, setLoading] = useState(true);
  const [showFullRange, setShowFullRange] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await getMarketData();
        setData(result.data);
        setSource(result.source);
        setLastUpdated(result.lastUpdated);
      } catch (error) {
        console.error("Market data fetch failed", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 p-8">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading Market Data...</p>
      </div>
    );
  }

  const formatCurrency = (val: number) => `$${(val / 1000).toFixed(0)}k`;
  const displayData = showFullRange ? data : data.slice(-12);

  // Custom tooltip with YoY comparison
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-white p-4 rounded-2xl shadow-2xl border border-slate-100">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
        {payload.map((entry: any, i: number) => {
          // Find YoY comparison (12 months prior)
          const currentIdx = data.findIndex(d => d.month === label);
          const priorIdx = currentIdx - 12;
          const priorVal = priorIdx >= 0 ? data[priorIdx][entry.dataKey] : null;
          const yoyChange = priorVal ? ((entry.value - priorVal) / priorVal * 100).toFixed(1) : null;

          return (
            <div key={i} className="flex items-center justify-between gap-6 py-1">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                <span className="text-xs font-bold text-slate-600">{entry.name}</span>
              </span>
              <span className="text-xs font-black text-slate-900">
                ${entry.value.toLocaleString()}
                {yoyChange && (
                  <span className={`ml-2 text-[10px] ${Number(yoyChange) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {Number(yoyChange) >= 0 ? '↑' : '↓'}{Math.abs(Number(yoyChange))}% YoY
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-full w-full py-4 relative flex flex-col">
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-3">
          <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black px-3 py-1.5 rounded-lg border border-emerald-100">
            ✓ Verified SFH Median Prices
          </span>
          <button
            onClick={() => setShowFullRange(!showFullRange)}
            className={`text-[10px] font-black px-3 py-1.5 rounded-lg border transition-all ${showFullRange ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-blue-50 hover:text-blue-600'}`}
          >
            {showFullRange ? '24 Months' : '12 Months'}
          </button>
        </div>
      </div>

      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displayData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
              dy={10}
              interval={showFullRange ? 2 : 0}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
              tickFormatter={formatCurrency}
              domain={['dataMin - 20000', 'dataMax + 20000']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', paddingBottom: 20 }}
            />
            <Line type="monotone" dataKey="miami" name="Miami-Dade" stroke="#1e40af" strokeWidth={4} dot={{ r: 3, fill: '#1e40af', strokeWidth: 2, stroke: '#fff' }} />
            <Line type="monotone" dataKey="broward" name="Broward" stroke="#059669" strokeWidth={4} dot={{ r: 3, fill: '#059669', strokeWidth: 2, stroke: '#fff' }} />
            <Line type="monotone" dataKey="palmbeach" name="Palm Beach" stroke="#d97706" strokeWidth={4} dot={{ r: 3, fill: '#d97706', strokeWidth: 2, stroke: '#fff' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between mt-3 px-2">
        <p className="text-[9px] font-bold text-slate-400">
          Source: {source}
        </p>
        <p className="text-[9px] font-bold text-slate-400">
          Last Updated: {new Date(lastUpdated).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
      </div>
    </div>
  );
};
