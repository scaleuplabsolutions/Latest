import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSystemType } from '@/hooks/useSystemType';
import { useQuery } from '@tanstack/react-query';
import StatusBadge from '@/components/StatusBadge';
import DataTable from '@/components/DataTable';
import { getDaysUntilExpiry } from '@/lib/expiryUtils';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

interface ExpiryItem {
  id: number;
  upc: string;
  description: string;
  sdeptName?: string;
  batchNumber: string;
  remainingQty?: number;
  receivingDate: string;
  expiryDate: string;
  status?: string;
}

type ExpiryStatus = 'all' | 'expired' | 'expiring-soon' | 'good' | 'short-dated';

const ExpiryAlerts: React.FC = () => {
  const { getSystemName } = useSystemType();
  const [location] = useLocation();
  const { toast } = useToast();
  
  // Parse query parameters from URL
  const params = new URLSearchParams(location.split('?')[1] || '');
  const initialStatus = (params.get('status') as ExpiryStatus) || 'all';
  
  const [status, setStatus] = useState<ExpiryStatus>(initialStatus);
  const [category, setCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Get expiry items from API
  const { data: expiryItems, isLoading } = useQuery<ExpiryItem[]>({
    queryKey: ['/api/expiry-alerts', { status, category, search: searchTerm }],
    queryFn: async ({ queryKey }) => {
      const [url, params] = queryKey;
      const searchParams = new URLSearchParams();
      if (params.status && params.status !== 'all') searchParams.append('status', params.status as string);
      if (params.category) searchParams.append('category', params.category as string);
      if (params.search) searchParams.append('search', params.search as string);
      
      const queryString = searchParams.toString();
      const response = await fetch(`${url}${queryString ? `?${queryString}` : ''}`);
      if (!response.ok) throw new Error('Failed to fetch expiry alerts');
      return response.json();
    }
  });

  // Extract unique categories for filter dropdown
  const categories = React.useMemo(() => {
    if (!expiryItems) return [];
    const uniqueCategories = new Set<string>();
    expiryItems.forEach(item => {
      if (item.sdeptName) uniqueCategories.add(item.sdeptName);
    });
    return Array.from(uniqueCategories);
  }, [expiryItems]);

  // Handle status tab change
  const handleStatusChange = (newStatus: ExpiryStatus) => {
    setStatus(newStatus);
    toast({
      title: `Showing ${newStatus === 'all' ? 'all items' : newStatus + ' items'}`,
      description: `Filtered by status: ${newStatus === 'all' ? 'All Expiry Dates' : 
                    newStatus === 'expiring-soon' ? 'Expiring Soon' :
                    newStatus === 'expired' ? 'Expired Products' : 
                    newStatus === 'good' ? 'Good Products' : 'Short-dated Products'}`,
    });
  };

  // Handle category filter change
  const handleCategoryChange = (value: string) => {
    setCategory(value);
  };

  // Handle search term change
  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const columns = [
    { header: 'UPC', accessor: 'upc' },
    { header: 'Description', accessor: 'description' },
    { header: 'Category', accessor: 'sdeptName' },
    { header: 'Batch #', accessor: 'batchNumber' },
    { header: 'Qty', accessor: 'remainingQty' },
    { header: 'Received', accessor: 'receivingDate' },
    { header: 'Expiry Date', accessor: 'expiryDate' },
    { 
      header: 'Days Left', 
      accessor: 'daysLeft',
      cell: (row: ExpiryItem) => {
        const daysLeft = getDaysUntilExpiry(row.expiryDate);
        const textClass = daysLeft < 0 ? 'text-red-600 font-medium' : 
                        daysLeft <= 7 ? 'text-orange-600 font-medium' : 
                        daysLeft <= 14 ? 'text-amber-600 font-medium' :
                        'text-neutral-900';
        return <span className={textClass}>{daysLeft}</span>;
      }
    },
    { 
      header: 'Status', 
      accessor: 'status',
      cell: (row: ExpiryItem) => <StatusBadge status={row.status || 'unknown'} />
    }
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Expiry Alerts</h1>
        <p className="mt-1 text-sm text-neutral-600">{getSystemName()} Expiry Tracking</p>
      </div>

      {/* Filter Bar */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            {/* Status Tabs */}
            <div className="flex space-x-2 overflow-x-auto pb-2 md:pb-0">
              <Button
                variant={status === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStatusChange('all')}
              >
                All Expiry Dates
              </Button>
              <Button
                variant={status === 'expiring-soon' ? 'default' : 'outline'}
                size="sm"
                className={status === 'expiring-soon' ? '' : 'text-amber-600 hover:text-amber-700'}
                onClick={() => handleStatusChange('expiring-soon')}
              >
                Expiring Soon
              </Button>
              <Button
                variant={status === 'expired' ? 'default' : 'outline'}
                size="sm"
                className={status === 'expired' ? '' : 'text-red-600 hover:text-red-700'}
                onClick={() => handleStatusChange('expired')}
              >
                Expired Products
              </Button>
              <Button
                variant={status === 'good' ? 'default' : 'outline'}
                size="sm"
                className={status === 'good' ? '' : 'text-green-600 hover:text-green-700'}
                onClick={() => handleStatusChange('good')}
              >
                Good Products
              </Button>
            </div>
            
            {/* Category Filter */}
            <div className="w-full md:w-48">
              <Select value={category} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expiry Alerts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Expiry Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable 
            columns={columns} 
            data={expiryItems || []} 
            isLoading={isLoading}
            searchPlaceholder="Search by UPC or Description"
            onSearch={handleSearch}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpiryAlerts;
