import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useSystemType } from '@/hooks/useSystemType';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { exportToExcel } from '@/lib/fileUtils';
import { Trash2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface OverviewItem {
  upc: string;
  description?: string;
  shelfExpiryEstimate: string;
  totalStock: number;
  dailyStock: number;
  sales: string;
  batchNumbers: string;
  status: string;
}

const Overview: React.FC = () => {
  const { getSystemName } = useSystemType();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: overviewItems, isLoading } = useQuery<OverviewItem[]>({
    queryKey: ['/api/overview', { search: searchTerm }],
    queryFn: async ({ queryKey }) => {
      const [url, params] = queryKey;
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.append('search', params.search as string);
      
      const queryString = searchParams.toString();
      const response = await fetch(`${url}${queryString ? `?${queryString}` : ''}`);
      if (!response.ok) throw new Error('Failed to fetch overview data');
      return response.json();
    }
  });

  const handleClearData = async () => {
    try {
      await apiRequest('POST', '/api/overview/clear');
      
      // Invalidate all queries to refresh data
      queryClient.invalidateQueries();
      
      toast({
        title: "Data Cleared",
        description: "All data has been successfully cleared",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear data",
        variant: "destructive",
      });
    }
  };

  const handleExport = () => {
    if (!overviewItems?.length) {
      toast({
        title: "Export Failed",
        description: "No data available to export",
        variant: "destructive",
      });
      return;
    }
    
    exportToExcel(overviewItems, 'inventory_overview');
    
    toast({
      title: "Export Successful",
      description: "Overview data has been exported to Excel",
    });
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const columns = [
    { header: 'UPC', accessor: 'upc' },
    { header: 'Description', accessor: 'description' },
    { header: 'Shelf Expiry Estimate', accessor: 'shelfExpiryEstimate' },
    { header: 'Total Stock', accessor: 'totalStock' },
    { header: 'Daily Stock', accessor: 'dailyStock' },
    { header: 'Sales', accessor: 'sales' },
    { header: 'Batch Numbers', accessor: 'batchNumbers' },
    { 
      header: 'Status', 
      accessor: 'status',
      cell: (row: OverviewItem) => <StatusBadge status={row.status} />
    }
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Overview</h1>
        <p className="mt-1 text-sm text-neutral-600">{getSystemName()} Inventory Overview</p>
      </div>

      {/* Action Buttons */}
      <div className="mb-6 flex justify-end space-x-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-red-600 border-red-200 hover:text-red-700 hover:bg-red-50">
              <Trash2 className="mr-2 h-4 w-4" />
              Clear Data
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action will permanently delete all inventory, container, and expiry data for the current system. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleClearData} className="bg-red-600 hover:bg-red-700">
                Yes, clear all data
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        <Button onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Overview Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable 
            columns={columns} 
            data={overviewItems || []} 
            isLoading={isLoading}
            searchPlaceholder="Search by UPC or Description"
            onSearch={handleSearch}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default Overview;
