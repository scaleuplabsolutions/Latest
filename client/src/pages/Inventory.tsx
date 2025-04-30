import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSystemType } from '@/hooks/useSystemType';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import FileUpload from '@/components/FileUpload';
import DataTable from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { apiRequest } from '@/lib/queryClient';
import { Download, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface InventoryItem {
  id: number;
  upc: string;
  venCode?: string;
  description: string;
  size?: string;
  wh2qty?: number;
  rvsbondqty?: number;
  sdeptName?: string;
  vendorId?: string;
  storeQty?: number;
  hostQty?: number;
  cost?: string;
  price?: string;
  grossMargin?: string;
  lastUpdated: string;
}

const Inventory: React.FC = () => {
  const { getSystemName } = useSystemType();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  const { data: inventoryItems, isLoading } = useQuery<InventoryItem[]>({
    queryKey: ['/api/inventory']
  });

  const clearDataMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/overview/clear');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Data cleared",
        description: "All inventory data has been cleared successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      setIsClearDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to clear data. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleClearData = () => {
    clearDataMutation.mutate();
  };

  const handleExportData = () => {
    if (!inventoryItems || inventoryItems.length === 0) {
      toast({
        title: "Nothing to export",
        description: "There is no inventory data to export.",
        variant: "destructive",
      });
      return;
    }

    // Convert data to CSV
    const headers = columns.map(col => col.header).join(',');
    const rows = inventoryItems.map(item => 
      columns.map(col => {
        const value = item[col.accessor as keyof InventoryItem];
        // Handle commas in strings by wrapping in quotes
        return value === null || value === undefined 
          ? '' 
          : typeof value === 'string' && value.includes(',') 
            ? `"${value}"` 
            : value;
      }).join(',')
    ).join('\n');
    
    const csv = `${headers}\n${rows}`;
    
    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Export complete",
      description: "Your inventory data has been exported to a CSV file.",
    });
  };

  const handleUploadSuccess = () => {
    // Refresh inventory data after successful upload
    queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const columns = [
    { header: 'UPC', accessor: 'upc' },
    { header: 'Ven_code', accessor: 'venCode' },
    { header: 'Description', accessor: 'description' },
    { header: 'Size', accessor: 'size' },
    { header: 'WH2QTY', accessor: 'wh2qty' },
    { header: 'RVSBONDQTY', accessor: 'rvsbondqty' },
    { header: 'SDeptName', accessor: 'sdeptName' },
    { header: 'Vendor_id', accessor: 'vendorId' },
    { header: 'StoreQty', accessor: 'storeQty' },
    { header: 'HOSTQty', accessor: 'hostQty' },
    { header: 'Cost', accessor: 'cost' },
    { header: 'Price', accessor: 'price' },
    { header: 'Gross_Margin', accessor: 'grossMargin' }
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Inventory Management</h1>
        <p className="mt-1 text-sm text-neutral-600">{getSystemName()} Inventory</p>
      </div>

      {/* File Upload Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Upload Inventory File</CardTitle>
        </CardHeader>
        <CardContent>
          <FileUpload 
            endpoint="/api/inventory/upload" 
            onSuccess={handleUploadSuccess}
            fileTypeMessage="Upload your inventory file (Excel, CSV, XLSX) to update the current inventory."
          />
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Current Inventory</CardTitle>
            <p className="mt-1 max-w-2xl text-sm text-neutral-500">
              Last updated: {inventoryItems?.length && inventoryItems[0].lastUpdated 
                ? formatDate(inventoryItems[0].lastUpdated) 
                : 'Never'}
            </p>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportData}
              disabled={!inventoryItems || inventoryItems.length === 0}
              className="flex items-center gap-1"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            
            <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex items-center gap-1"
                  disabled={!inventoryItems || inventoryItems.length === 0}
                >
                  <Trash2 className="h-4 w-4" />
                  Clear Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will permanently delete all inventory and container data for this system.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearData}>
                    {clearDataMutation.isPending ? "Clearing..." : "Yes, clear all data"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable 
            columns={columns} 
            data={inventoryItems || []} 
            isLoading={isLoading}
            searchPlaceholder="Search by UPC or Description"
            categoryFilterKey="sdeptName"
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default Inventory;
