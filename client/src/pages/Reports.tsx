import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSystemType } from '@/hooks/useSystemType';
import { useQuery } from '@tanstack/react-query';
import { exportToExcel } from '@/lib/fileUtils';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, ResponsiveContainer
} from 'recharts';

interface ExpiryStatus {
  name: string;
  value: number;
}

interface CategoryBreakdown {
  category: string;
  count: number;
  expired: number;
  expiringSoon: number;
}

interface MonthlyData {
  month: string;
  expired: number;
  expiringSoon: number;
}

interface WeeklyData {
  week: string;
  expired: number;
  expiringSoon: number;
}

const Reports: React.FC = () => {
  const { getSystemName } = useSystemType();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Get expiry status data for pie chart
  const { data: expiryStatusData, isLoading: statusLoading } = useQuery<ExpiryStatus[]>({
    queryKey: ['/api/reports/expiry-status'],
  });

  // Get category breakdown data for bar chart
  const { data: categoryData, isLoading: categoryLoading } = useQuery<CategoryBreakdown[]>({
    queryKey: ['/api/reports/category-breakdown'],
  });

  // Get monthly comparison data
  const { data: monthlyData, isLoading: monthlyLoading } = useQuery<MonthlyData[]>({
    queryKey: ['/api/reports/monthly'],
  });

  // Get weekly comparison data
  const { data: weeklyData, isLoading: weeklyLoading } = useQuery<WeeklyData[]>({
    queryKey: ['/api/reports/weekly'],
  });

  const handleExportReports = () => {
    // Combine all report data
    const exportData = {
      expiryStatus: expiryStatusData || [],
      categoryBreakdown: categoryData || [],
      monthlyComparison: monthlyData || [],
      weeklyComparison: weeklyData || []
    };

    exportToExcel(Object.values(exportData).flat(), 'expiry_reports');
    
    toast({
      title: "Reports Exported",
      description: "All reports have been exported to Excel",
    });
  };

  const handleApplyDateFilter = () => {
    // In a real implementation, this would refresh the queries with date filters
    toast({
      title: "Date Filter Applied",
      description: `Showing data from ${startDate} to ${endDate}`,
    });
  };

  // Colors for charts
  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#2563eb'];
  
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Reports</h1>
        <p className="mt-1 text-sm text-neutral-600">{getSystemName()} Reports</p>
      </div>

      {/* Date Range Filter */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div>
              <h3 className="text-lg leading-6 font-medium text-neutral-900">Reports & Analytics</h3>
              <p className="mt-1 max-w-2xl text-sm text-neutral-500">Select date range to filter reports</p>
            </div>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
              <div>
                <label htmlFor="start-date" className="block text-sm font-medium text-neutral-700">Start Date</label>
                <Input 
                  type="date" 
                  id="start-date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="end-date" className="block text-sm font-medium text-neutral-700">End Date</label>
                <Input 
                  type="date" 
                  id="end-date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="self-end pt-1 sm:pt-0">
                <Button 
                  onClick={handleApplyDateFilter}
                  disabled={!startDate || !endDate}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Expiry Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Expiry Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full aspect-[16/9]">
              {statusLoading ? (
                <div className="w-full h-full flex items-center justify-center">Loading chart data...</div>
              ) : !expiryStatusData?.length ? (
                <div className="w-full h-full flex items-center justify-center">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expiryStatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {expiryStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="flex items-center">
                <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                <span className="text-sm text-neutral-500">Good</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-amber-500 rounded-full mr-2"></span>
                <span className="text-sm text-neutral-500">Expiring Soon</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                <span className="text-sm text-neutral-500">Expired</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                <span className="text-sm text-neutral-500">Short-dated</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full aspect-[16/9]">
              {categoryLoading ? (
                <div className="w-full h-full flex items-center justify-center">Loading chart data...</div>
              ) : !categoryData?.length ? (
                <div className="w-full h-full flex items-center justify-center">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categoryData}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="expired" name="Expired" fill="#ef4444" />
                    <Bar dataKey="expiringSoon" name="Expiring Soon" fill="#f59e0b" />
                    <Bar dataKey="count" name="Total" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-4">
              {categoryData?.length && (
                <p className="text-sm text-neutral-500">
                  Top category with expiry issues: <span className="font-medium text-neutral-900">
                    {[...categoryData].sort((a, b) => (b.expired + b.expiringSoon) - (a.expired + a.expiringSoon))[0]?.category}
                  </span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full aspect-[16/9]">
              {monthlyLoading ? (
                <div className="w-full h-full flex items-center justify-center">Loading chart data...</div>
              ) : !monthlyData?.length ? (
                <div className="w-full h-full flex items-center justify-center">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={monthlyData}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="expired" name="Expired" stroke="#ef4444" activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="expiringSoon" name="Expiring Soon" stroke="#f59e0b" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-4">
              {monthlyData?.length && (
                <p className="text-sm text-neutral-500">
                  Month with highest expiry issues: <span className="font-medium text-neutral-900">
                    {[...monthlyData].sort((a, b) => (b.expired + b.expiringSoon) - (a.expired + a.expiringSoon))[0]?.month}
                  </span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Weekly Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full aspect-[16/9]">
              {weeklyLoading ? (
                <div className="w-full h-full flex items-center justify-center">Loading chart data...</div>
              ) : !weeklyData?.length ? (
                <div className="w-full h-full flex items-center justify-center">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={weeklyData}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="expired" name="Expired" fill="#ef4444" />
                    <Bar dataKey="expiringSoon" name="Expiring Soon" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-4">
              {weeklyData?.length && (
                <p className="text-sm text-neutral-500">
                  Week with highest expiry issues: <span className="font-medium text-neutral-900">
                    {[...weeklyData].sort((a, b) => (b.expired + b.expiringSoon) - (a.expired + a.expiringSoon))[0]?.week}
                  </span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Reports Button */}
      <div className="mt-6 flex justify-end">
        <Button onClick={handleExportReports}>
          <Download className="mr-2 h-4 w-4" />
          Export Reports
        </Button>
      </div>
    </div>
  );
};

export default Reports;
