"use client";

import { useState, useRef, useEffect } from "react";
import * as Button from "@/components/ui/button";
import { cn } from "@/utils/cn";
import Image from "next/image";
import {
  RiCloseLine,
  RiDeleteBinLine,
  RiFilePdf2Fill,
  RiFileWordFill,
  RiFileExcelFill,
  RiFilePptFill,
  RiFileImageFill,
  RiFileAddFill,
} from "@remixicon/react";

interface UploadedFile {
  id: string;
  name: string;
  type: string;
  icon: React.ElementType;
  color: string;
}

interface UploadFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveFiles: (files: UploadedFile[]) => void;
  projectTitle: string;
  existingFiles?: UploadedFile[];
}

interface ModalContent {
  title: string;
  description: string;
  warning: string;
  uploadArea: {
    icon: string;
    instruction1: string;
    instruction2: string;
  };
  buttons: {
    cancel: string;
    save: string;
  };
}

const fakeModalData: ModalContent = {
  title: "Upload project files",
  description: "Attach relevant files to help your agent give better answers.",
  warning: "Responses may be lower quality due to file count.",
  uploadArea: {
    icon: "RiFileAddFill",
    instruction1: "Upload documents, code files, images, and more.",
    instruction2: "You can access {projectTitle} content during chat.",
  },
  buttons: {
    cancel: "Cancel",
    save: "Save project files",
  },
};

const fileTypeIcons = {
  pdf: { icon: RiFilePdf2Fill, color: "fill-red-600/56 text-white" },
  docx: { icon: RiFileWordFill, color: "fill-blue-600/56 text-white" },
  xlsx: { icon: RiFileExcelFill, color: "fill-green-600/56 text-white" },
  pptx: { icon: RiFilePptFill, color: "fill-orange-600/56 text-white" },
  jpg: { icon: RiFileImageFill, color: "fill-purple-600/56 text-white" },
  jpeg: { icon: RiFileImageFill, color: "fill-purple-600/56 text-white" },
  png: { icon: RiFileImageFill, color: "fill-purple-600/56 text-white" },
  gif: { icon: RiFileImageFill, color: "fill-purple-600/56 text-white" },
  webp: { icon: RiFileImageFill, color: "fill-purple-600/56 text-white" },
  svg: { icon: RiFileImageFill, color: "fill-purple-600/56 text-white" },
  default: { icon: RiFileAddFill, color: "fill-gray-500/56 text-white" },
};

const getFileIcon = (fileName: string) => {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return (
    fileTypeIcons[extension as keyof typeof fileTypeIcons] ||
    fileTypeIcons.default
  );
};

export default function UploadFilesModal({
  isOpen,
  onClose,
  onSaveFiles,
  projectTitle,
  existingFiles = [],
}: UploadFilesModalProps) {
  const [uploadedFiles, setUploadedFiles] =
    useState<UploadedFile[]>(existingFiles);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;

    const newFiles: UploadedFile[] = Array.from(files).map((file, index) => {
      const { icon, color } = getFileIcon(file.name);
      return {
        id: `uploaded-${Date.now()}-${index}`,
        name: file.name,
        type: file.name.split(".").pop()?.toUpperCase() || "FILE",
        icon,
        color,
      };
    });

    setUploadedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(e.target.files);
  };

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.id !== fileId));
  };

  const handleSave = () => {
    onSaveFiles(uploadedFiles);
    onClose();
  };

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setUploadedFiles(existingFiles);
      onClose();
    }, 400);
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-62 flex items-end justify-center transition-all duration-400 lg:items-center",
        isAnimating ? "bg-overlay-gray" : "bg-transparent",
      )}
      onClick={handleClose}
    >
      <div
        className={cn(
          "bg-bg-white-0 lg:shadow-complex flex w-full flex-col rounded-t-3xl transition-transform duration-400 ease-out lg:max-h-133 lg:min-h-121.25 lg:w-175 lg:gap-5 lg:rounded-[28px] lg:px-6 lg:py-5",
          isAnimating
            ? "translate-y-0"
            : "translate-y-full lg:translate-y-0 lg:opacity-0",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-stroke-soft-200 flex w-full justify-between border-b px-5 py-5 lg:border-b-0 lg:px-0 lg:py-0 lg:pb-0">
          <div className="flex flex-col gap-1">
            <h2 className="text-text-strong-950 tracking-spacing-tiny-2 text-sm font-medium lg:text-base">
              {fakeModalData.title}
            </h2>
            <p className="text-text-soft-400 tracking-spacing-tiny-2 text-xs font-medium lg:text-sm">
              {fakeModalData.description}
            </p>
          </div>
          <Button.Root
            variant="neutral"
            mode="ghost"
            size="small"
            onClick={handleClose}
            className="hover:bg-bg-weak-50 size-7 cursor-pointer items-center justify-center rounded-lg p-0"
          >
            <Button.Icon
              as={RiCloseLine}
              className="text-text-soft-400 group-hover:text-text-sub-600 size-5"
            />
          </Button.Root>
        </div>

        <div className="lg:bg-bg-weak-50 flex flex-1 flex-col lg:rounded-[20px]">
          <div className="border-stroke-soft-200 flex items-center gap-2 border-b p-5 lg:border-b-0 lg:p-3.5">
            <Image
              src="/icons/icon-info.svg"
              alt="Info"
              width={12}
              height={12}
              className="size-3"
            />
            <p className="text-text-soft-400 lg:text-text-sub-600 text-xs font-medium">
              {fakeModalData.warning}
            </p>
          </div>

          {uploadedFiles.length === 0 && (
            <div className="flex flex-1 lg:p-0.25">
              <div
                className="bg-bg-white-0 lg:shadow-custom-input flex w-full flex-1 flex-col items-center justify-center gap-5 px-5 py-21.5 lg:rounded-[19px] lg:px-0 lg:py-0"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <RiFileAddFill className="text-text-disabled-300 size-7" />
                <p className="text-text-soft-400 tracking-spacing-tiny-2 text-center text-sm leading-relaxed lg:max-w-[53%]">
                  Upload documents, code files, images, and more. You can access
                  <span className="text-text-sub-600">
                    {" "}
                    {projectTitle}
                  </span>{" "}
                  content during chat.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {uploadedFiles.length > 0 && (
            <div className="flex flex-1 lg:p-0.25">
              <div
                className="bg-bg-white-0 lg:shadow-custom-input max-h-[40vh] w-full flex-1 overflow-y-auto lg:max-h-82 lg:rounded-[19px] lg:p-1.5"
                style={{ scrollbarWidth: "none" }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex flex-col gap-5 p-5 pb-0 lg:gap-1 lg:p-0">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="group hover:bg-bg-weak-50 flex items-center gap-3 rounded-2xl transition-colors duration-200 lg:p-2.5"
                    >
                      <div className="border-faded-lighter bg-bg-white-0 group-hover:shadow-regular-xs flex size-10 items-center justify-center rounded-full border transition-shadow duration-200">
                        <file.icon className={cn("size-6", file.color)} />
                      </div>
                      <div className="flex flex-1 flex-col gap-1">
                        <p className="text-text-strong-950 tracking-spacing-tiny-2 text-sm font-medium">
                          {file.name}
                        </p>
                        <p className="text-text-soft-400 text-xs font-medium uppercase">
                          {file.type}
                        </p>
                      </div>
                      <Button.Root
                        variant="neutral"
                        mode="ghost"
                        size="small"
                        onClick={() => handleRemoveFile(file.id)}
                        className="rounded-[9px bg-bg-white-0 hover:bg-bg-soft-200 size-8 cursor-pointer p-0 transition-opacity duration-200 group-hover:opacity-100 lg:opacity-0"
                      >
                        <Button.Icon
                          as={RiDeleteBinLine}
                          className="text-text-soft-400 lg:text-text-sub-600 size-5"
                        />
                      </Button.Root>
                    </div>
                  ))}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>
            </div>
          )}
          {uploadedFiles.length > 0 && (
            <div className="flex p-5 lg:hidden">
              <Button.Root
                size="small"
                variant="neutral"
                mode="lighter"
                onClick={() => fileInputRef.current?.click()}
                className="bg-bg-weak-50 rounded-10 text-text-sub-600 tracking-spacing-tiny-2 w-full text-sm font-medium"
              >
                Upload file
              </Button.Root>
            </div>
          )}
        </div>

        <div className="border-stroke-soft-200 flex items-center gap-3 border-t p-5 lg:justify-end lg:border-t-0 lg:p-0">
          <Button.Root
            size="small"
            variant="neutral"
            mode="stroke"
            onClick={handleClose}
            className="ring-bg-soft-200 lg:rounded-10 tracking-spacing-tiny-2 w-full cursor-pointer rounded-xl text-sm font-medium !shadow-none lg:w-fit"
          >
            {fakeModalData.buttons.cancel}
          </Button.Root>
          <Button.Root
            size="small"
            mode="filled"
            variant="primary"
            onClick={handleSave}
            className="bg-success-base tracking-spacing-tiny-2 w-full cursor-pointer rounded-xl text-sm font-medium text-white hover:bg-green-700 lg:w-fit"
          >
            {fakeModalData.buttons.save}
          </Button.Root>
        </div>
      </div>
    </div>
  );
}
