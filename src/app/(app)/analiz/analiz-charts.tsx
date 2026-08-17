"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";

const COLORS = {
  revenue: "#10b981",
  expense: "#ef4444",
  profit: "#3b82f6",
  cash: "#10b981",
  card: "#3b82f6",
  debt: "#f59e0b",
};
const PIE_PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

function money(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

function tooltipFormatter(value: unknown) {
  return money(Number(Array.isArray(value) ? value[0] : value));
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-sm font-medium mb-3">{title}</div>
        <div className="h-64">{children}</div>
      </CardContent>
    </Card>
  );
}

export function AnalizCharts({
  dailyRows,
  paymentBreakdown,
  expensesByCategory,
  topProducts,
}: {
  dailyRows: { day: string; revenue: number; expense: number; profit: number; salesCount: number }[];
  paymentBreakdown: { cash: number; card: number; debt: number };
  expensesByCategory: { category: string | null; total: number }[];
  topProducts: { name: string; totalRevenue: number }[];
}) {
  const chronological = [...dailyRows].reverse();
  const shortDay = (d: string) => d.slice(5);

  const paymentPieData = [
    { name: "Наличные", value: paymentBreakdown.cash, color: COLORS.cash },
    { name: "Карта", value: paymentBreakdown.card, color: COLORS.card },
    { name: "Долг", value: paymentBreakdown.debt, color: COLORS.debt },
  ].filter((d) => d.value > 0);

  const expensePieData = expensesByCategory.map((e) => ({
    name: e.category ?? "Без категории",
    value: e.total,
  }));

  const topProductsData = [...topProducts].reverse().map((p) => ({
    name: p.name.length > 18 ? p.name.slice(0, 18) + "…" : p.name,
    revenue: p.totalRevenue,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="Выручка по дням">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chronological}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tickFormatter={shortDay} fontSize={12} />
            <YAxis fontSize={12} width={60} />
            <Tooltip formatter={tooltipFormatter} labelFormatter={(l) => l} />
            <Area type="monotone" dataKey="revenue" stroke={COLORS.revenue} fill={COLORS.revenue} fillOpacity={0.2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Выручка / расходы / прибыль по дням">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chronological}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tickFormatter={shortDay} fontSize={12} />
            <YAxis fontSize={12} width={60} />
            <Tooltip formatter={tooltipFormatter} />
            <Legend />
            <Bar dataKey="revenue" name="Выручка" fill={COLORS.revenue} radius={[3, 3, 0, 0]} />
            <Bar dataKey="expense" name="Расходы" fill={COLORS.expense} radius={[3, 3, 0, 0]} />
            <Bar dataKey="profit" name="Прибыль" fill={COLORS.profit} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Количество продаж по дням">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chronological}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tickFormatter={shortDay} fontSize={12} />
            <YAxis fontSize={12} width={40} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="salesCount" name="Продаж" fill={COLORS.profit} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Способы оплаты">
        {paymentPieData.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={paymentPieData} dataKey="value" nameKey="name" outerRadius={80} label>
                {paymentPieData.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Расходы по категориям">
        {expensePieData.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={expensePieData} dataKey="value" nameKey="name" outerRadius={80} label>
                {expensePieData.map((d, i) => (
                  <Cell key={d.name} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Топ товаров по выручке">
        {topProductsData.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topProductsData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" fontSize={12} />
              <YAxis dataKey="name" type="category" fontSize={11} width={110} />
              <Tooltip formatter={tooltipFormatter} />
              <Bar dataKey="revenue" name="Выручка" fill={COLORS.profit} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
      Нет данных за период
    </div>
  );
}
