"use client";

import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowUpLine,
  RiAttachment2,
  RiBook2Line,
  RiBrainLine,
  RiFileSearchLine,
  RiFlashlightFill,
  RiImageCircleAiLine,
  RiCloseLine,
} from "@remixicon/react";
import { useState, useEffect } from "react";
import * as Button from "@/components/ui/button";
import { cn } from "@/utils/cn";
import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface ChatInputProps {
  className?: string;
  placeholder?: string;
  bottomText?: boolean;
}

export default function ChatInput({
  className,
  placeholder = "How can I help you today?",
  bottomText = false,
}: ChatInputProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<
    {
      id: string;
      name: string;
      type: string;
    }[]
  >([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);

    files.forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const imageData = e.target?.result as string;
          setUploadedImages((prev) => [...prev, imageData]);
        };
        reader.readAsDataURL(file);
      } else {
        const fileExtension =
          file.name.split(".").pop()?.toUpperCase() || "FILE";
        const newFile = {
          id: Date.now().toString() + Math.random(),
          name: file.name,
          type: fileExtension,
        };
        setUploadedFiles((prev) => [...prev, newFile]);
      }
    });
  };

  useEffect(() => {
    const handleGlobalDragEnd = () => {
      setIsDragging(false);
    };

    const handleGlobalDrop = () => {
      setIsDragging(false);
    };

    const handleGlobalDragLeave = (e: DragEvent) => {
      if (e.clientX === 0 && e.clientY === 0) {
        setIsDragging(false);
      }
    };

    document.addEventListener("dragend", handleGlobalDragEnd);
    document.addEventListener("drop", handleGlobalDrop);
    document.addEventListener("dragleave", handleGlobalDragLeave);

    return () => {
      document.removeEventListener("dragend", handleGlobalDragEnd);
      document.removeEventListener("drop", handleGlobalDrop);
      document.removeEventListener("dragleave", handleGlobalDragLeave);
    };
  }, []);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      let hasImage = false;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (item.type.startsWith("image/")) {
          hasImage = true;
          e.preventDefault();

          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const imageData = e.target?.result as string;
              setUploadedImages((prev) => [...prev, imageData]);
            };
            reader.readAsDataURL(file);
          }
          break;
        }
      }

      if (!hasImage) {
        const plainText = e.clipboardData?.getData("text/plain");
        if (plainText) {
          e.preventDefault();

          const textareaDisplay = document.getElementById(
            "prompt-textarea-display",
          );
          if (textareaDisplay) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              range.deleteContents();

              const textNode = document.createTextNode(plainText);
              range.insertNode(textNode);

              range.setStartAfter(textNode);
              range.setEndAfter(textNode);
              selection.removeAllRanges();
              selection.addRange(range);
            }

            setMessage(textareaDisplay.innerText || "");
          }
        }
      }
    };

    document.addEventListener("paste", handlePaste);

    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, []);

  const handleImageUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,application/pdf,.doc,.docx,.txt,.csv,.xlsx";
    input.multiple = false;

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const imageData = e.target?.result as string;
            setUploadedImages((prev) => [...prev, imageData]);
          };
          reader.readAsDataURL(file);
        } else {
          const fileExtension =
            file.name.split(".").pop()?.toUpperCase() || "FILE";
          const newFile = {
            id: Date.now().toString(),
            name: file.name,
            type: fileExtension,
          };
          setUploadedFiles((prev) => [...prev, newFile]);
        }
      }
    };

    input.click();
    setIsMenuOpen(false);
  };

  const handleRemoveImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();

    if (
      !message.trim() &&
      uploadedImages.length === 0 &&
      uploadedFiles.length === 0
    )
      return;

    router.push("/chat/1");

    setMessage("");
    setUploadedImages([]);
    setUploadedFiles([]);

    const textareaDisplay = document.getElementById("prompt-textarea-display");
    if (textareaDisplay) {
      textareaDisplay.innerText = "";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = element;

    setShowTopShadow(scrollTop > 0);

    setShowBottomShadow(scrollTop < scrollHeight - clientHeight - 1);
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest('[role="button"]')) {
      return;
    }

    const textareaDisplay = document.getElementById("prompt-textarea-display");
    if (textareaDisplay) {
      textareaDisplay.focus();

      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(textareaDisplay);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  };

  return (
    <div
      className={cn("z-20 flex flex-col items-center px-2 lg:p-1", className)}
    >
      <div
        className="lg:rounded-20 bg-bg-weak-50 mb-4 w-full rounded-[16px] p-0.25 lg:w-175"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="flex items-center gap-1 px-2.5 py-2 lg:px-3 lg:py-2.5">
          <div className="text-text-soft-400 flex items-center gap-1 text-xs font-medium">
            <RiFlashlightFill className="size-4" /> Access premium models &
            features
          </div>
          <div className="text-text-disabled-300 text-xs font-medium">∙</div>
          <Link
            href="/upgrade"
            className="text-text-sub-600 text-xs font-medium hover:underline"
          >
            Upgrade
          </Link>
        </div>

        <div
          className={cn(
            "bg-bg-white-0 shadow-complex-2 hover:[&>div>span]:text-text-sub-600 flex cursor-text flex-col gap-2 rounded-[15px] p-2.5 pt-0 transition-all duration-200 lg:rounded-[19px] lg:p-3 lg:pt-0",
            isDragging && "bg-bg-soft-200",
          )}
          onClick={handleContainerClick}
        >
          <textarea
            id="prompt-textarea"
            style={{ display: "none" }}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          {(uploadedImages.length > 0 || uploadedFiles.length > 0) && (
            <div className="flex flex-wrap gap-2 pt-2.5 lg:pt-3.5">
              {uploadedImages.map((image, index) => (
                <div key={index} className="relative w-fit">
                  <Image
                    src={image}
                    alt={`Uploaded preview ${index + 1}`}
                    width={96}
                    height={96}
                    className="border-stroke-soft-200 max-h-24 min-h-24 max-w-24 min-w-24 rounded-2xl border object-cover"
                  />
                  <Button.Root
                    variant="neutral"
                    mode="ghost"
                    size="xxsmall"
                    onClick={() => handleRemoveImage(index)}
                    className="bg-bg-surface-800 hover:bg-surface-800 absolute top-2 right-2 size-4 cursor-pointer rounded-full p-0"
                  >
                    <Button.Icon
                      as={RiCloseLine}
                      className="text-text-white-0 size-3.5"
                    />
                  </Button.Root>
                </div>
              ))}

              {uploadedFiles.map((file) => (
                <div key={file.id} className="relative w-fit">
                  <div className="bg-bg-white-0 border-stroke-soft-200 flex items-center gap-3 rounded-2xl border py-2.5 pr-11 pl-3">
                    <div className="bg-bg-weak-50 flex size-9 items-center justify-center rounded-full">
                      <RiAttachment2 className="text-text-sub-600 size-5" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="text-text-strong-950 tracking-spacing-tiny-2 text-sm font-medium">
                        {file.name}
                      </div>
                      <div className="text-text-sub-600 text-xs font-medium">
                        {file.type}
                      </div>
                    </div>
                  </div>
                  <Button.Root
                    variant="neutral"
                    mode="ghost"
                    size="xxsmall"
                    onClick={() => handleRemoveFile(file.id)}
                    className="bg-bg-surface-800 hover:bg-surface-800 absolute top-3 right-4 size-4 cursor-pointer rounded-full p-0"
                  >
                    <Button.Icon
                      as={RiCloseLine}
                      className="text-text-white-0 size-3.5"
                    />
                  </Button.Root>
                </div>
              ))}
            </div>
          )}

          <div className="relative">
            {showTopShadow && (
              <div className="from-bg-white-0/80 pointer-events-none absolute top-0 right-0 left-0 z-10 h-4 bg-gradient-to-b to-transparent" />
            )}

            {showBottomShadow && (
              <div className="from-bg-white-0/80 pointer-events-none absolute right-0 bottom-0 left-0 z-10 h-4 bg-gradient-to-t to-transparent" />
            )}

            {!message.trim() && (
              <span className="text-text-soft-400 tracking-spacing-tiny-2 pointer-events-none absolute top-0 left-1 z-20 pt-2.5 text-[14px] leading-5 duration-200 lg:pt-3.5 lg:text-[15px] lg:leading-6">
                How can I help you today?
              </span>
            )}
            <div
              id="prompt-textarea-display"
              contentEditable
              onInput={(e) => setMessage(e.currentTarget.innerText)}
              onKeyDown={handleKeyDown}
              onScroll={handleScroll}
              suppressContentEditableWarning={true}
              className={cn(
                "tracking-spacing-tiny-2 max-h-40 min-h-6 w-full overflow-y-auto border-0 pt-2.5 pl-1 text-[14px] leading-5 outline-none focus:border-0 focus:ring-0 focus:outline-none lg:pt-3.5 lg:pb-6 lg:text-[15px] lg:leading-6",
                message.trim() ? "text-text-strong-950" : "text-text-soft-400",
              )}
              style={{
                border: "none",
                outline: "none",
                boxShadow: "none",
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Popover.Root open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <Popover.Trigger asChild>
                  <Button.Root
                    variant="neutral"
                    mode="ghost"
                    size="xxsmall"
                    className={cn(
                      "group hover:bg-bg-weak-50 bg-bg-weak-50 size-7 cursor-pointer p-0",
                      isMenuOpen && "bg-bg-strong-950 hover:bg-bg-strong-950",
                    )}
                  >
                    <Button.Icon
                      as={RiAddLine}
                      className={cn(
                        "text-text-soft-400 group-hover:text-text-sub-600 size-5 duration-200",
                        isMenuOpen &&
                          "text-bg-white-0 group-hover:text-bg-white-0",
                      )}
                    />
                  </Button.Root>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    className="bg-bg-white-0 shadow-complex z-20 min-w-55 rounded-2xl p-1.5"
                    side="top"
                    sideOffset={10}
                    align="center"
                    alignOffset={0}
                    avoidCollisions={true}
                  >
                    <div className="flex flex-col gap-1">
                      <Button.Root
                        variant="neutral"
                        mode="ghost"
                        size="small"
                        className="group/menu-item text-text-sub-600 !h-auto cursor-pointer justify-start !gap-1.5 !p-1.5 text-xs font-medium"
                      >
                        <Button.Icon
                          as={RiImageCircleAiLine}
                          className="text-text-soft-400 group-hover/menu-item:text-text-sub-600 !-mx-0 !size-4"
                        />
                        Generate image
                      </Button.Root>

                      <Button.Root
                        variant="neutral"
                        mode="ghost"
                        size="small"
                        onClick={handleImageUpload}
                        className="group/menu-item text-text-sub-600 !h-auto cursor-pointer justify-start !gap-1.5 !p-1.5 text-xs font-medium"
                      >
                        <Button.Icon
                          as={RiAttachment2}
                          className="text-text-soft-400 group-hover/menu-item:text-text-sub-600 !-mx-0 !size-4"
                        />
                        Upload image or file
                      </Button.Root>

                      <Button.Root
                        variant="neutral"
                        mode="ghost"
                        size="small"
                        className="group/menu-item text-text-sub-600 !h-auto cursor-pointer justify-start !gap-1.5 !p-1.5 text-xs font-medium"
                      >
                        <Button.Icon
                          as={RiFileSearchLine}
                          className="text-text-soft-400 group-hover/menu-item:text-text-sub-600 !-mx-0 !size-4"
                        />
                        Deep research
                      </Button.Root>

                      <Button.Root
                        variant="neutral"
                        mode="ghost"
                        size="small"
                        className="group/menu-item text-text-sub-600 !h-auto cursor-pointer justify-start !gap-1.5 !p-1.5 text-xs font-medium"
                      >
                        <Button.Icon
                          as={RiBrainLine}
                          className="text-text-soft-400 group-hover/menu-item:text-text-sub-600 !-mx-0 !size-4"
                        />
                        Agent mode
                      </Button.Root>

                      <Button.Root
                        variant="neutral"
                        mode="ghost"
                        size="small"
                        className="group/menu-item text-text-sub-600 !h-auto cursor-pointer justify-start !gap-1.5 !p-1.5 text-xs font-medium"
                      >
                        <Button.Icon
                          as={RiBook2Line}
                          className="text-text-soft-400 group-hover/menu-item:text-text-sub-600 !-mx-0 !size-4"
                        />
                        Study and learn
                      </Button.Root>
                    </div>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>

              <Button.Root
                variant="neutral"
                mode="ghost"
                size="xxsmall"
                className="group hover:bg-bg-soft-200 hover:text-text-sub-600 bg-bg-weak-50 text-text-sub-600 tracking-spacing-tiny-2 hidden cursor-pointer gap-1 text-sm font-medium lg:flex"
              >
                GPT-4
                <Button.Icon
                  as={RiArrowDownSLine}
                  className="text-text-soft-400 size-5 duration-200"
                />
              </Button.Root>
            </div>
            <div>
              <Button.Root
                variant="neutral"
                mode="ghost"
                size="xxsmall"
                onClick={handleSubmit}
                className={cn(
                  "group size-7 cursor-pointer p-0 duration-200",
                  message.trim() ||
                    uploadedImages.length > 0 ||
                    uploadedFiles.length > 0
                    ? "bg-bg-strong-950 hover:bg-bg-strong-950"
                    : "bg-bg-weak-50 hover:bg-bg-weak-50",
                )}
              >
                <Button.Icon
                  as={RiArrowUpLine}
                  className={cn(
                    "size-5 duration-200",
                    message.trim() ||
                      uploadedImages.length > 0 ||
                      uploadedFiles.length > 0
                      ? "text-bg-white-0 group-hover:text-bg-white-0"
                      : "text-text-soft-400 group-hover:text-text-sub-600",
                  )}
                />
              </Button.Root>
            </div>
          </div>
        </div>
      </div>
      {bottomText && (
        <p className="text-text-soft-400 text-center text-xs lg:w-175">
          AI can make <b className="font-medium">mistakes</b> - please
          double-check
        </p>
      )}
    </div>
  );
}
