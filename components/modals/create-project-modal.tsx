import { useState, useEffect, useRef } from "react";
import * as Button from "@/components/ui/button";
import * as Input from "@/components/ui/input";
import { RiCloseLine } from "@remixicon/react";
import Image from "next/image";
import { cn } from "@/utils/cn";

interface ModalContent {
  title: string;
  instruction: string;
  inputPlaceholder: string;
  infoSection: {
    title: string;
    description: string;
  };
  buttons: {
    cancel: string;
    create: string;
  };
}

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (projectName: string) => void;
}

const fakeModalData: ModalContent = {
  title: "Create a project",
  instruction: "Attach relevant files to help your agent give better answers.",
  inputPlaceholder: "e.g. Birthday Party Planning",
  infoSection: {
    title: "What's a project?",
    description:
      "Projects keep chats, files, and custom instructions in one place. Use them for ongoing work, or just to keep things tidy.",
  },
  buttons: {
    cancel: "Cancel",
    create: "Create project",
  },
};

export default function CreateProjectModal({
  isOpen,
  onClose,
  onCreateProject,
}: CreateProjectModalProps) {
  const [projectName, setProjectName] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        setIsAnimating(true);
      }, 10);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (projectName.trim()) {
      onCreateProject(projectName.trim());
      setProjectName("");
      onClose();
    }
  };

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setProjectName("");
      if (inputRef.current) {
        inputRef.current.blur();
      }
      onClose();
    }, 400);
  };

  useEffect(() => {
    if (!isOpen && inputRef.current) {
      inputRef.current.blur();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 z-50 flex h-full w-full items-end justify-center transition-all duration-400 lg:items-center",
        isAnimating ? "bg-overlay-gray" : "bg-transparent",
      )}
      onClick={handleClose}
    >
      <div
        className={cn(
          "bg-bg-white-0 lg:shadow-complex w-full rounded-t-3xl transition-transform duration-400 ease-out lg:max-w-137 lg:rounded-[28px] lg:p-5",
          isAnimating
            ? "translate-y-0"
            : "translate-y-full lg:translate-y-0 lg:opacity-0",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between p-5 pb-0 lg:p-0">
          <h2 className="text-text-strong-950 tracking-spacing-tiny-4 text-sm font-medium lg:text-base">
            {fakeModalData.title}
          </h2>
          <Button.Root
            size="small"
            variant="neutral"
            mode="ghost"
            className="group bg-bg-white-0 hover:bg-bg-weak-50 size-6 cursor-pointer items-center justify-center rounded-md p-0 shadow-none lg:size-7"
            onClick={handleClose}
          >
            <Button.Icon
              as={RiCloseLine}
              className="text-text-soft-400 group-hover:text-text-sub-600 ease size-4.5 shrink-0 duration-200 lg:size-5"
            />
          </Button.Root>
        </div>

        <p className="text-text-soft-400 tracking-spacing-tiny-2 px-5 text-xs font-medium lg:mb-5 lg:px-0 lg:text-sm">
          {fakeModalData.instruction}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="border-stroke-soft-200 mt-5 mb-3 border-t px-5 pt-5 lg:mt-0 lg:mb-5 lg:border-t-0 lg:px-0 lg:pt-0">
            <Input.Root
              size="medium"
              className="shadow-custom-input group h-12 rounded-[14px]"
            >
              <Input.Wrapper>
                <Input.Input
                  ref={inputRef}
                  type="text"
                  placeholder={fakeModalData.inputPlaceholder}
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="text-text-sub-600 hover:placeholder:text-text-sub-600 group-hover:hover:placeholder:text-text-sub-600"
                />
              </Input.Wrapper>
            </Input.Root>
          </div>

          <div className="bg-bg-weak-50 mx-5 mb-5 rounded-[14px] p-3.5 lg:mx-0">
            <div className="flex items-start gap-3.5">
              <div className="flex size-5 items-center justify-center">
                <Image
                  src="/icons/icon-info.svg"
                  alt="Info"
                  width={20}
                  height={20}
                  className="size-3.5 shrink-0 lg:size-3"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-text-sub-600 tracking-spacing-tiny-2 text-sm font-medium">
                  {fakeModalData.infoSection.title}
                </h3>
                <p className="text-text-soft-400 tracking-spacing-tiny-2 text-sm font-medium">
                  {fakeModalData.infoSection.description}
                </p>
              </div>
            </div>
          </div>

          <div className="border-stroke-soft-200 flex items-center gap-3 border-t p-5 lg:justify-end lg:border-t-0 lg:p-0">
            <Button.Root
              type="button"
              variant="neutral"
              mode="stroke"
              size="small"
              className="lg:rounded-10 w-full cursor-pointer rounded-xl text-sm font-medium lg:w-fit"
              onClick={handleClose}
            >
              {fakeModalData.buttons.cancel}
            </Button.Root>
            <Button.Root
              type="submit"
              variant="primary"
              mode="filled"
              size="small"
              className="bg-success-base w-full cursor-pointer rounded-xl text-sm font-medium hover:bg-green-700 lg:w-fit"
              disabled={!projectName.trim()}
            >
              {fakeModalData.buttons.create}
            </Button.Root>
          </div>
        </form>
      </div>
    </div>
  );
}
