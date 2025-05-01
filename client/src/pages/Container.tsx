import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSystemType } from '@/hooks/useSystemType';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import FileUpload from '@/components/FileUpload';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { apiRequest } from '@/lib/queryClient';
import { Download, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ContainerItem {
  id: number;
  container: string;
  supplier?: string;
  upc: string;
  description: string;
  itemNumber?: string;
  receivingDate: string;
  batchNumber: string;
  qtyReceived: number;
  expiryDate: string;
  remainingQty?: number;
  status?: string;
  lastUpdated: string;
}

const Container: React.FC = () => {
  const { getSystemName } = useSystemType();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

  const { data: containerItems, isLoading } = useQuery<ContainerItem[]>({
    queryKey: ['/api/containers']
  });

  const clearDataMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/overview/clear');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Data cleared",
        description: "All container data has been cleared successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/containers'] });
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
    if (!containerItems || containerItems.length === 0) {
      toast({
        title: "Nothing to export",
        description: "There is no container data to export.",
        variant: "destructive",
      });
      return;
    }

    // Convert data to CSV
    const headers = columns.map(col => col.header).join(',');
    const rows = containerItems.map(item => 
      columns.map(col => {
        // Skip the status column with the custom cell renderer
        if (col.accessor === 'status') {
          return item.status || '';
        }
        
        const value = item[col.accessor as keyof ContainerItem];
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
    link.download = `container-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Export complete",
      description: "Your container data has been exported to a CSV file.",
    });
  };

  const handleUploadSuccess = () => {
    // Refresh container data after successful upload
    queryClient.invalidateQueries({ queryKey: ['/api/containers'] });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const { isWarehouse } = useSystemType();

  // Create columns array, conditionally removing Container column for warehouse
  const columns = [
    ...(isWarehouse ? [] : [{ header: 'Container', accessor: 'container' }]),
    { header: 'Supplier', accessor: 'supplier' },
    { header: 'UPC', accessor: 'upc' },
    { header: 'Description', accessor: 'description' },
    { header: 'Item #', accessor: 'itemNumber' },
    { header: 'Receiving Date', accessor: 'receivingDate' },
    { header: 'Batch #', accessor: 'batchNumber' },
    { header: 'Qty Rec', accessor: 'qtyReceived' },
    { header: 'Expiry Date', accessor: 'expiryDate' },
    { 
      header: 'Status', 
      accessor: 'status',
      cell: (row: ContainerItem) => <StatusBadge status={row.status || 'unknown'} />
    }
  ];
  const pageTitle = isWarehouse ? "Receiving Management" : "Container Management";
  const recordsLabel = isWarehouse ? "Receiving Records" : "Container Records";
  const uploadTitle = isWarehouse ? "Upload Receiving File" : "Upload Container File";
  const tableTitle = isWarehouse ? "Recent Receivings" : "Recent Containers";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">{pageTitle}</h1>
        <p className="mt-1 text-sm text-neutral-600">{getSystemName()} {recordsLabel}</p>
      </div>

      {/* File Upload Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{uploadTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <FileUpload 
            endpoint="/api/containers/upload" 
            onSuccess={handleUploadSuccess}
            fileTypeMessage={`Upload your ${isWarehouse ? 'receiving' : 'container'} file (Excel, CSV, XLSX) to update the recently received goods.`}
          />
        </CardContent>
      </Card>

      {/* Container Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{tableTitle}</CardTitle>
            <p className="mt-1 max-w-2xl text-sm text-neutral-500">
              Last updated: {containerItems?.length && containerItems[0].lastUpdated 
                ? formatDate(containerItems[0].lastUpdated) 
                : 'Never'}
            </p>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportData}
              disabled={!containerItems || containerItems.length === 0}
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
                  disabled={!containerItems || containerItems.length === 0}
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
            data={containerItems || []} 
            isLoading={isLoading}
            searchPlaceholder="Search by UPC or Description"
            categoryFilterKey="status"
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default Container;
