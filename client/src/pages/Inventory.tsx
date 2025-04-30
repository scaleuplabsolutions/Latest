import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSystemType } from '@/hooks/useSystemType';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import FileUpload from '@/components/FileUpload';
import DataTable from '@/components/DataTable';

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

  const { data: inventoryItems, isLoading } = useQuery<InventoryItem[]>({
    queryKey: ['/api/inventory']
  });

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
        </CardHeader>
        <CardContent>
          <DataTable 
            columns={columns} 
            data={inventoryItems || []} 
            isLoading={isLoading}
            searchPlaceholder="Search by UPC or Description"
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default Inventory;
