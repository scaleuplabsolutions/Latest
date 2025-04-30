import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Upload, FolderOpen } from 'lucide-react';
import { readExcelFile } from '@/lib/fileUtils';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface FileUploadProps {
  endpoint: string;
  onSuccess?: (data: any) => void;
  fileTypeMessage?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  endpoint, 
  onSuccess,
  fileTypeMessage = "Upload your file (Excel, CSV, XLSX)"
}) => {
  const [fileName, setFileName] = useState('No file chosen');
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileName(e.target.files[0].name);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const uploadFile = async () => {
    if (!fileInputRef.current?.files?.length) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    const file = fileInputRef.current.files[0];
    setIsUploading(true);
    setProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + 5;
          return newProgress < 90 ? newProgress : prev;
        });
      }, 100);

      // Read the file
      const data = await readExcelFile(file);

      // Send data to server
      const response = await apiRequest('POST', endpoint, { data });
      const result = await response.json();

      // Complete progress
      clearInterval(progressInterval);
      setProgress(100);

      toast({
        title: "Upload successful",
        description: result.message || `${result.count} items imported successfully`,
      });

      // Reset form
      setTimeout(() => {
        setIsUploading(false);
        setProgress(0);
        setFileName('No file chosen');
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (onSuccess) onSuccess(result);
      }, 500);
    } catch (error) {
      setIsUploading(false);
      setProgress(0);
      
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <div className="mt-2 max-w-xl text-sm text-neutral-500">
        <p>{fileTypeMessage}</p>
      </div>
      
      <form className="mt-5 sm:flex sm:items-center">
        <div className="w-full sm:max-w-xs">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
          />
          <div className="relative">
            <div className="mt-1 flex rounded-md shadow-sm">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-neutral-300 bg-neutral-50 text-neutral-500 sm:text-sm">
                File
              </span>
              <Input
                type="text"
                readOnly
                value={fileName}
                className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border border-neutral-300 text-neutral-500 sm:text-sm"
                placeholder="No file chosen"
              />
            </div>
          </div>
        </div>
        
        <Button
          type="button"
          onClick={handleBrowseClick}
          className="mt-3 w-full inline-flex items-center justify-center sm:mt-0 sm:ml-3 sm:w-auto"
          variant="outline"
          disabled={isUploading}
        >
          <FolderOpen className="mr-2 h-4 w-4" />
          Browse
        </Button>
        
        <Button
          type="button"
          onClick={uploadFile}
          className="mt-3 w-full inline-flex items-center justify-center sm:mt-0 sm:ml-3 sm:w-auto"
          variant="default"
          disabled={isUploading || fileName === 'No file chosen'}
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload
        </Button>
      </form>
      
      {isUploading && (
        <div className="mt-4">
          <div className="flex justify-between mb-1">
            <span className="text-xs font-medium text-primary">Uploading...</span>
            <span className="text-xs font-medium text-primary">{progress}%</span>
          </div>
          <Progress value={progress} className="w-full h-2" />
        </div>
      )}
    </div>
  );
};

export default FileUpload;
