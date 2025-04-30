import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useSystemType } from '@/hooks/useSystemType';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { CalendarClock, AlertCircle, CheckCircle, Package, Clock, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DashboardStats {
  expired: number;
  expiringSoon: number;
  totalProducts: number;
  goodStatus: number;
  shortDated: number;
}

interface Activity {
  id: number;
  type: string;
  title: string;
  description?: string;
  category?: string;
  timestamp: string;
}

interface ExpiryChartData {
  date: string;
  quantity: number;
  products: number;
}

const Dashboard: React.FC = () => {
  const { getSystemName } = useSystemType();
  
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats']
  });
  
  const { data: activities, isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ['/api/dashboard/activities']
  });
  
  const { data: expiryChartData, isLoading: chartLoading } = useQuery<ExpiryChartData[]>({
    queryKey: ['/api/dashboard/expiry-chart']
  });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <span className="material-icons text-warning mr-2">warning</span>;
      case 'success':
        return <span className="material-icons text-success mr-2">check_circle</span>;
      case 'error':
        return <span className="material-icons text-danger mr-2">error</span>;
      default:
        return <span className="material-icons text-primary mr-2">info</span>;
    }
  };

  const getActivityBadge = (type: string) => {
    switch (type) {
      case 'warning':
        return (
          <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-warning bg-opacity-10 text-warning">
            Warning
          </p>
        );
      case 'success':
        return (
          <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-success bg-opacity-10 text-success">
            Completed
          </p>
        );
      case 'error':
        return (
          <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-danger bg-opacity-10 text-danger">
            Alert
          </p>
        );
      default:
        return (
          <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary bg-opacity-10 text-primary">
            Info
          </p>
        );
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  // Filter out chart data with zero quantities for better visualization
  const filteredChartData = expiryChartData?.filter(item => item.quantity > 0) || [];
  
  // Group nearby dates for cleaner visualization if we have too much data
  const groupedChartData = filteredChartData.length > 15
    ? filteredChartData.reduce((acc: ExpiryChartData[], item, index) => {
        if (index % 2 === 0) {
          // For even indexes, create a new group
          acc.push({
            date: formatDate(item.date),
            quantity: item.quantity,
            products: item.products
          });
        } else {
          // For odd indexes, add to the previous group
          const lastItem = acc[acc.length - 1];
          lastItem.quantity += item.quantity;
          lastItem.products += item.products;
        }
        return acc;
      }, [])
    : filteredChartData.map(item => ({
        ...item,
        date: formatDate(item.date)
      }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-600">{getSystemName()} Overview</p>
      </div>
      
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {/* Expired Products Card */}
        <Card>
          <CardContent className="pt-6 flex flex-col">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-red-100 rounded-md p-3">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-neutral-500 truncate">
                    Expired Products
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-red-500">
                      {statsLoading ? '...' : stats?.expired}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-neutral-500">
                  Total: <span>{statsLoading ? '...' : stats?.totalProducts}</span>
                </span>
                <span className="text-xs text-red-500">
                  {statsLoading ? '...' : `${((stats?.expired || 0) / (stats?.totalProducts || 1) * 100).toFixed(1)}%`}
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-1.5 mt-1">
                <div 
                  className="bg-red-500 h-1.5 rounded-full" 
                  style={{ width: `${statsLoading ? 0 : ((stats?.expired || 0) / (stats?.totalProducts || 1) * 100)}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-neutral-50 p-2">
            <Link href="/expiry-alerts?status=expired">
              <a className="text-sm text-primary flex items-center">
                View details <span className="material-icons text-sm ml-1">arrow_forward</span>
              </a>
            </Link>
          </CardFooter>
        </Card>

        {/* Expiring Soon Card */}
        <Card>
          <CardContent className="pt-6 flex flex-col">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-amber-100 rounded-md p-3">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-neutral-500 truncate">
                    Expiring Soon
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-amber-500">
                      {statsLoading ? '...' : stats?.expiringSoon}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-neutral-500">
                  Total: <span>{statsLoading ? '...' : stats?.totalProducts}</span>
                </span>
                <span className="text-xs text-amber-500">
                  {statsLoading ? '...' : `${((stats?.expiringSoon || 0) / (stats?.totalProducts || 1) * 100).toFixed(1)}%`}
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-1.5 mt-1">
                <div 
                  className="bg-amber-500 h-1.5 rounded-full" 
                  style={{ width: `${statsLoading ? 0 : ((stats?.expiringSoon || 0) / (stats?.totalProducts || 1) * 100)}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-neutral-50 p-2">
            <Link href="/expiry-alerts?status=expiring-soon">
              <a className="text-sm text-primary flex items-center">
                View details <span className="material-icons text-sm ml-1">arrow_forward</span>
              </a>
            </Link>
          </CardFooter>
        </Card>

        {/* Total Products Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                <Package className="h-5 w-5 text-blue-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-neutral-500 truncate">
                    Total Products
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-neutral-900">
                      {statsLoading ? '...' : stats?.totalProducts}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-neutral-50 p-2">
            <Link href="/inventory">
              <a className="text-sm text-primary flex items-center">
                View inventory <span className="material-icons text-sm ml-1">arrow_forward</span>
              </a>
            </Link>
          </CardFooter>
        </Card>

        {/* Good Status Products Card */}
        <Card>
          <CardContent className="pt-6 flex flex-col">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-neutral-500 truncate">
                    Good Status
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-green-500">
                      {statsLoading ? '...' : stats?.goodStatus}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-neutral-500">
                  Total: <span>{statsLoading ? '...' : stats?.totalProducts}</span>
                </span>
                <span className="text-xs text-green-500">
                  {statsLoading ? '...' : `${((stats?.goodStatus || 0) / (stats?.totalProducts || 1) * 100).toFixed(1)}%`}
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-1.5 mt-1">
                <div 
                  className="bg-green-500 h-1.5 rounded-full" 
                  style={{ width: `${statsLoading ? 0 : ((stats?.goodStatus || 0) / (stats?.totalProducts || 1) * 100)}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-neutral-50 p-2">
            <Link href="/expiry-alerts?status=good">
              <a className="text-sm text-primary flex items-center">
                View details <span className="material-icons text-sm ml-1">arrow_forward</span>
              </a>
            </Link>
          </CardFooter>
        </Card>

        {/* Short-dated Products Card */}
        <Card>
          <CardContent className="pt-6 flex flex-col">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-orange-100 rounded-md p-3">
                <CalendarClock className="h-5 w-5 text-orange-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-neutral-500 truncate">
                    Short-dated
                  </dt>
                  <dd>
                    <div className="text-lg font-medium text-orange-500">
                      {statsLoading ? '...' : stats?.shortDated}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-neutral-500">
                  Total: <span>{statsLoading ? '...' : stats?.totalProducts}</span>
                </span>
                <span className="text-xs text-orange-500">
                  {statsLoading ? '...' : `${((stats?.shortDated || 0) / (stats?.totalProducts || 1) * 100).toFixed(1)}%`}
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-1.5 mt-1">
                <div 
                  className="bg-orange-500 h-1.5 rounded-full" 
                  style={{ width: `${statsLoading ? 0 : ((stats?.shortDated || 0) / (stats?.totalProducts || 1) * 100)}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-neutral-50 p-2">
            <Link href="/expiry-alerts?status=short-dated">
              <a className="text-sm text-primary flex items-center">
                View details <span className="material-icons text-sm ml-1">arrow_forward</span>
              </a>
            </Link>
          </CardFooter>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-neutral-900 mb-4">Recent Activity</h2>
        <Card>
          <CardContent className="p-0">
            <ul role="list" className="divide-y divide-neutral-200">
              {activitiesLoading ? (
                <li className="px-4 py-4 sm:px-6 text-center">Loading activities...</li>
              ) : !activities?.length ? (
                <li className="px-4 py-4 sm:px-6 text-center">No recent activities</li>
              ) : (
                activities.map(activity => (
                  <li key={activity.id}>
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          {getActivityIcon(activity.type)}
                          <p className="text-sm font-medium text-primary truncate">
                            {activity.title}
                          </p>
                        </div>
                        <div className="ml-2 flex-shrink-0 flex">
                          {getActivityBadge(activity.type)}
                        </div>
                      </div>
                      <div className="mt-2 sm:flex sm:justify-between">
                        <div className="sm:flex">
                          {activity.category && (
                            <p className="flex items-center text-sm text-neutral-500">
                              <span className="material-icons text-sm mr-1">category</span>
                              {activity.category}
                            </p>
                          )}
                        </div>
                        <div className="mt-2 flex items-center text-sm text-neutral-500 sm:mt-0">
                          <span className="material-icons text-sm mr-1">schedule</span>
                          <p>{formatDateTime(activity.timestamp)}</p>
                        </div>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
