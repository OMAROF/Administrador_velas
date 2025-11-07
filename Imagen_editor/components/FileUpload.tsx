
import React, { useRef } from 'react';
import { UploadIcon } from './icons';

interface FileUploadProps {
  onFileUpload: (files: FileList) => void;
  label: string;
  multiple?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, label, multiple = false }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      onFileUpload(event.target.files);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      onFileUpload(event.dataTransfer.files);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <label
      className="flex flex-col items-center justify-center w-full h-32 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-md appearance-none cursor-pointer hover:border-indigo-500 focus:outline-none"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <span className="flex items-center space-x-2">
        <UploadIcon className="w-6 h-6 text-gray-400" />
        <span className="font-medium text-gray-500">
          {label}
          <span className="text-indigo-500 underline ml-1">browse</span>
        </span>
      </span>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </label>
  );
};

export default FileUpload;