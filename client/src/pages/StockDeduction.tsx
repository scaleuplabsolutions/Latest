import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSystemType } from '@/hooks/useSystemType';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { Coins } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BatchItem {
  id: number;
  upc: string;
  description: string;
  batchNumber: string;
  receivingDate: string;
  expiryDate: string;
  qtyReceived: number;
  remainingQty: number;
  status: string;
}

interface StockDeduction {
  id: number;
  upc: string;
  description: string;
  qtyDeducted: number;
  batchNumber: string;
  expiryDate: string;
  deductionDate: string;
  fefoApplied: boolean;
}

const StockDeduction: React.FC = () => {
  const { getSystemName } = useSystemType();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [upc, setUpc] = useState('');
  const [quantity, setQuantity] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeducting, setIsDeducting] = useState(false);

  // Get batch distribution data
  const { data: batchItems, isLoading: batchLoading } = useQuery<BatchItem[]>({
    queryKey: ['/api/containers', { search: searchTerm }],
    queryFn: async ({ queryKey }) => {
      const [url, params] = queryKey;
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.append('search', params.search as string);
      
      const queryString = searchParams.toString();
      const response = await fetch(`${url}${queryString ? `?${queryString}` : ''}`);
      if (!response.ok) throw new Error('Failed to fetch batch data');
      return response.json();
    }
  });

  // Get stock deductions history
  const { data: deductions, isLoading: deductionsLoading } = useQuery<StockDeduction[]>({
    queryKey: ['/api/stock-deductions'],
  });

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const handleDeductStock = async () => {
    if (!upc) {
      toast({
        title: "UPC Required",
        description: "Please enter a UPC to deduct stock",
        variant: "destructive",
      });
      return;
    }

    if (!quantity || parseInt(quantity) <= 0) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a valid quantity greater than 0",
        variant: "destructive",
      });
      return;
    }

    setIsDeducting(true);
    try {
      await apiRequest('POST', '/api/stock-deductions/deduct', {
        upc,
        quantity: parseInt(quantity)
      });
      
      // Reset form
      setUpc('');
      setQuantity('');
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/containers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stock-deductions'] });
      
      toast({
        title: "Stock Deducted",
        description: `Successfully deducted ${quantity} units of UPC ${upc} using FEFO logic`,
      });
    } catch (error) {
      toast({
        title: "Deduction Failed",
        description: error instanceof Error ? error.message : "Failed to deduct stock",
        variant: "destructive",
      });
    } finally {
      setIsDeducting(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const batchColumns = [
    { header: 'UPC', accessor: 'upc' },
    { header: 'Description', accessor: 'description' },
    { header: 'Batch #', accessor: 'batchNumber' },
    { header: 'Receiving Date', accessor: 'receivingDate' },
    { header: 'Expiry Date', accessor: 'expiryDate' },
    { header: 'Original Qty', accessor: 'qtyReceived' },
    { header: 'Remaining Qty', accessor: 'remainingQty' },
    { 
      header: 'Status', 
      accessor: 'status',
      cell: (row: BatchItem) => <StatusBadge status={row.status} />
    }
  ];

  const deductionColumns = [
    { 
      header: 'Date & Time', 
      accessor: 'deductionDate',
      cell: (row: StockDeduction) => formatDateTime(row.deductionDate)
    },
    { header: 'UPC', accessor: 'upc' },
    { header: 'Description', accessor: 'description' },
    { header: 'Qty Deducted', accessor: 'qtyDeducted' },
    { header: 'Batch #', accessor: 'batchNumber' },
    { header: 'Expiry Date', accessor: 'expiryDate' },
    { 
      header: 'FEFO Applied', 
      accessor: 'fefoApplied',
      cell: (row: StockDeduction) => (
        <span className={row.fefoApplied ? 'text-green-600 font-medium' : 'text-neutral-500'}>
          {row.fefoApplied ? 'Yes' : 'No'}
        </span>
      )
    }
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Stock Deduction & Expiry Logic</h1>
        <p className="mt-1 text-sm text-neutral-600">{getSystemName()} FEFO System</p>
      </div>

      {/* FEFO Information Card */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <h3 className="text-lg leading-6 font-medium text-neutral-900">First-Expire-First-Out (FEFO) Strategy</h3>
          <div className="mt-2 max-w-xl text-sm text-neutral-600">
            <p>To ensure the most efficient and safe use of inventory, this system follows a First-Expire-First-Out (FEFO) strategy, meaning that products are sold in the order of their expiry dates, not their arrival dates. This logic ensures the store reduces waste and sells items before they expire.</p>
          </div>
          <div className="mt-4">
            <h4 className="text-md font-medium text-neutral-800">How FEFO Works in the System:</h4>
            <ol className="mt-2 ml-6 list-decimal text-sm text-neutral-600 space-y-2">
              <li>Each inventory item is tracked with its expiry date and batch number.</li>
              <li>When a sale is made (e.g., StoreQty is reduced):
                <ul className="ml-6 list-disc mt-1 space-y-1">
                  <li>The system looks for all available batches of the item.</li>
                  <li>It sorts these batches by soonest expiry date.</li>
                  <li>It deducts the sold quantity from the batch with the earliest expiry date first, and continues to the next earliest batch if needed.</li>
                </ul>
              </li>
              <li>If multiple batches have the same expiry date, the system falls back to FIFO (First-In-First-Out), using the oldest received batch.</li>
            </ol>
          </div>
          
          {/* Manual Deduction Form */}
          <div className="mt-6 p-4 bg-neutral-50 rounded-md border border-neutral-200">
            <h4 className="text-md font-medium text-neutral-800 mb-4">Manual Stock Deduction</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="upc">UPC</Label>
                <Input
                  id="upc"
                  placeholder="Enter UPC"
                  value={upc}
                  onChange={(e) => setUpc(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  placeholder="Enter quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={handleDeductStock} 
                  disabled={isDeducting}
                  className="w-full"
                >
                  <Coins className="mr-2 h-4 w-4" />
                  {isDeducting ? 'Deducting...' : 'Deduct Stock'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Batch Distribution */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Batch Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable 
            columns={batchColumns} 
            data={batchItems || []} 
            isLoading={batchLoading}
            searchPlaceholder="Search by UPC"
            onSearch={handleSearch}
          />
        </CardContent>
      </Card>

      {/* Recent Deductions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Stock Deductions</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable 
            columns={deductionColumns} 
            data={deductions || []} 
            isLoading={deductionsLoading}
            isSearchable={false}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default StockDeduction;
