import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Column {
  header: string;
  accessor: string;
  cell?: (row: any) => React.ReactNode;
  filterable?: boolean;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  searchPlaceholder?: string;
  onSearch?: (searchTerm: string) => void;
  isSearchable?: boolean;
  isLoading?: boolean;
  categoryFilterKey?: string;
}

const DataTable: React.FC<DataTableProps> = ({
  columns,
  data,
  searchPlaceholder = "Search...",
  onSearch,
  isSearchable = true,
  isLoading = false,
  categoryFilterKey,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const rowsPerPage = 10;

  // Extract unique categories from data if categoryFilterKey is provided
  useEffect(() => {
    if (categoryFilterKey && data.length > 0) {
      const categories = data
        .map(item => item[categoryFilterKey])
        .filter((value: any, index: number, self: any[]) => 
          value && self.indexOf(value) === index
        )
        .sort();
      
      setAvailableCategories(['All', ...categories]);
    }
  }, [data, categoryFilterKey]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    setCurrentPage(1);
    if (onSearch) {
      onSearch(term);
    }
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setCurrentPage(1);
  };

  // Filter data based on search term and category
  const filteredData = data.filter(row => {
    // First apply search filter
    const passesSearch = !searchTerm ? true : 
      Object.values(row).some(
        value => 
          value !== null && 
          value !== undefined && 
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
      );
      
    // Then apply category filter
    const passesCategory = !selectedCategory || selectedCategory === 'All' ? true :
      categoryFilterKey && row[categoryFilterKey] === selectedCategory;
    
    return passesSearch && passesCategory;
  });

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + rowsPerPage);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getPaginationRange = () => {
    const delta = 1; // Number of pages to show before and after current page
    const range = [];
    
    for (
      let i = Math.max(1, currentPage - delta);
      i <= Math.min(totalPages, currentPage + delta);
      i++
    ) {
      range.push(i);
    }
    
    if (currentPage - delta > 2) {
      range.unshift('...');
      range.unshift(1);
    } else if (currentPage - delta > 1) {
      range.unshift(1);
    }
    
    if (currentPage + delta < totalPages - 1) {
      range.push('...');
      range.push(totalPages);
    } else if (currentPage + delta < totalPages) {
      range.push(totalPages);
    }
    
    return range;
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between mb-4">
        {/* Category filter */}
        {categoryFilterKey && availableCategories.length > 1 && (
          <div className="flex items-center space-x-2 mb-2 sm:mb-0">
            <Filter className="h-4 w-4 text-neutral-500" />
            <Select value={selectedCategory} onValueChange={handleCategoryChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Category" />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map((category, index) => (
                  <SelectItem key={index} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        {/* Search bar */}
        {isSearchable && (
          <div className="relative rounded-md shadow-sm max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-neutral-500" />
            </div>
            <Input
              type="text"
              value={searchTerm}
              onChange={handleSearch}
              className="pl-10 sm:text-sm"
              placeholder={searchPlaceholder}
            />
          </div>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-4 text-sm text-center text-neutral-500">
                  Loading...
                </td>
              </tr>
            ) : paginatedData.length > 0 ? (
              paginatedData.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((column, colIndex) => (
                    <td key={colIndex} className="px-6 py-4 text-sm text-neutral-900 whitespace-nowrap">
                      {column.cell ? column.cell(row) : row[column.accessor]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-6 py-4 text-sm text-center text-neutral-500">
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {totalPages > 1 && (
        <div className="bg-neutral-50 px-4 py-3 border-t border-neutral-200 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-neutral-700">
                  Showing
                  <span className="font-medium"> {startIndex + 1} </span>
                  to
                  <span className="font-medium"> {Math.min(startIndex + rowsPerPage, filteredData.length)} </span>
                  of
                  <span className="font-medium"> {filteredData.length} </span>
                  results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-neutral-300 bg-white text-sm font-medium text-neutral-500 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Previous</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  {getPaginationRange().map((page, index) => (
                    page === '...' ? (
                      <span
                        key={`ellipsis-${index}`}
                        className="relative inline-flex items-center px-4 py-2 border border-neutral-300 bg-white text-sm font-medium text-neutral-700"
                      >
                        ...
                      </span>
                    ) : (
                      <button
                        key={`page-${page}`}
                        onClick={() => goToPage(page as number)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          page === currentPage
                            ? 'z-10 bg-primary bg-opacity-10 border-primary text-primary'
                            : 'bg-white border-neutral-300 text-neutral-500 hover:bg-neutral-50'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  ))}
                  
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-neutral-300 bg-white text-sm font-medium text-neutral-500 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Next</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
