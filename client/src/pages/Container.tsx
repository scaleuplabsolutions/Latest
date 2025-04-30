import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSystemType } from '@/hooks/useSystemType';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import FileUpload from '@/components/FileUpload';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';

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

  const { data: containerItems, isLoading } = useQuery<ContainerItem[]>({
    queryKey: ['/api/containers']
  });

  const handleUploadSuccess = () => {
    // Refresh container data after successful upload
    queryClient.invalidateQueries({ queryKey: ['/api/containers'] });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const columns = [
    { header: 'Container', accessor: 'container' },
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Container Management</h1>
        <p className="mt-1 text-sm text-neutral-600">{getSystemName()} Container Records</p>
      </div>

      {/* File Upload Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Upload Container File</CardTitle>
        </CardHeader>
        <CardContent>
          <FileUpload 
            endpoint="/api/containers/upload" 
            onSuccess={handleUploadSuccess}
            fileTypeMessage="Upload your container file (Excel, CSV, XLSX) to update the recently received goods."
          />
        </CardContent>
      </Card>

      {/* Container Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Containers</CardTitle>
            <p className="mt-1 max-w-2xl text-sm text-neutral-500">
              Last updated: {containerItems?.length && containerItems[0].lastUpdated 
                ? formatDate(containerItems[0].lastUpdated) 
                : 'Never'}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable 
            columns={columns} 
            data={containerItems || []} 
            isLoading={isLoading}
            searchPlaceholder="Search by Container ID or UPC"
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default Container;
