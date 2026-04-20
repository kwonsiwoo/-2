import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface CostChartProps {
  taxiCost: number;
  hybridCost: number;
}

const CostChart: React.FC<CostChartProps> = ({ taxiCost, hybridCost }) => {
  const data = [
    {
      name: '택시만',
      cost: taxiCost,
      color: '#FF6B6B', // brandPink
      icon: '🚕'
    },
    {
      name: '찐막차',
      cost: hybridCost,
      color: '#06D6A0', // brandMint
      icon: '🚌'
    },
  ];

  return (
    <div className="w-full h-52 bg-white rounded-3xl p-5 border border-gray-100 shadow-xl">
      <h3 className="text-lg text-gray-600 mb-4 font-bold text-center flex items-center justify-center gap-2">
        <span>💸</span> 요금 비교
      </h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 40, left: 10, bottom: 40 }}
        >
          <XAxis type="number" hide />
          <YAxis 
            type="category" 
            dataKey="name" 
            tick={{ fill: '#4B5563', fontSize: 16, fontWeight: 'bold' }} 
            width={50}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip 
            cursor={{fill: 'transparent'}}
            contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '2px solid #E2E8F0', color: '#1F2937', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
            formatter={(value: number) => [`${value.toLocaleString()}원`, '요금']}
          />
          <Bar dataKey="cost" radius={[0, 20, 20, 0]} barSize={36}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CostChart;