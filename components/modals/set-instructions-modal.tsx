"use client";

import { useState, useRef, useEffect } from "react";
import * as Button from "@/components/ui/button";
import * as Textarea from "@/components/ui/textarea";
import { cn } from "@/utils/cn";
import Image from "next/image";
import { RiCloseLine } from "@remixicon/react";

interface SetInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveInstructions: (instructions: string) => void;
  existingInstructions?: string;
}

interface ModalContent {
  title: string;
  description: string;
  info: string;
  placeholder: string;
  buttons: {
    cancel: string;
    save: string;
  };
}

const fakeModalData: ModalContent = {
  title: "Set project instructions",
  description:
    "Set clear behavioral guidelines that help your AI agent respond more effectively.",
  info: "These instructions shape tone and context.",
  placeholder:
    "e.g. Use a friendly tone and bullet points when listing features.",
  buttons: {
    cancel: "Cancel",
    save: "Save instructions",
  },
};

export default function SetInstructionsModal({
  isOpen,
  onClose,
  onSaveInstructions,
  existingInstructions = "",
}: SetInstructionsModalProps) {
  const [instructions, setInstructions] = useState(existingInstructions);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  const handleSave = () => {
    onSaveInstructions(instructions);
    onClose();
  };

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setInstructions(existingInstructions);
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
          "bg-bg-white-0 lg:shadow-complex flex max-h-138 min-h-138 flex-col rounded-t-3xl transition-transform duration-400 ease-out lg:max-h-133 lg:min-h-121.25 lg:w-175 lg:gap-5 lg:rounded-[28px] lg:px-6 lg:py-5",
          isAnimating
            ? "translate-y-0"
            : "translate-y-full lg:translate-y-0 lg:opacity-0",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-stroke-soft-200 flex justify-between border-b p-5 lg:border-b-0 lg:p-0">
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
            <p className="text-text-sub-600 text-xs font-medium">
              {fakeModalData.info}
            </p>
          </div>

          <div className="flex w-full flex-1 p-5 lg:p-0.25">
            <Textarea.Root
              placeholder={fakeModalData.placeholder}
              simple
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="hover:!bg-bg-white-0 hover:[&:not(:focus-within)]:!bg-bg-white-0 hover:[&:not(:focus)]:!bg-bg-white-0 bg-bg-white-0 shadow-custom-input focus:shadow-gray-shadow-2 w-full resize-none rounded-[19px] p-4 text-sm ring-transparent focus:ring-0 focus:outline-none"
            />
          </div>
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
