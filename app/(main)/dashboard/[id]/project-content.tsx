"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import * as Button from "@/components/ui/button";
import * as Popover from "@radix-ui/react-popover";
import ChatInput from "@/components/layout/chat-input";
import * as LinkButton from "@/components/ui/link-button";
import UploadFilesModal from "@/components/modals/upload-files-modal";
import SetInstructionsModal from "@/components/modals/set-instructions-modal";
import {
  RiFolderOpenFill,
  RiLockFill,
  RiStarLine,
  RiMore2Line,
  RiAddLine,
  RiPencilLine,
  RiDeleteBinLine,
  RiShareLine,
  RiSettings3Line,
  RiArrowLeftLongLine,
  RiChatAiFill,
  RiFileExcelFill,
  RiFileWordFill,
  RiFilePdf2Fill,
} from "@remixicon/react";
import { cn } from "@/utils/cn";

interface ProjectDetailData {
  project: {
    id: string;
    title: string;
    description: string;
    isPrivate: boolean;
    isStarred: boolean;
  };
  premiumBanner: {
    icon: string;
    text: string;
    buttonText: string;
  };
  projectFiles: {
    title: string;
    count: number;
    files: {
      id: string;
      name: string;
      type: string;
      icon: React.ElementType;
      color: string;
    }[];
  };
  instructions: {
    title: string;
    description: string;
    content: string;
  };
  chats: {
    id: string;
    title: string;
    description: string;
    time: string;
    isActive?: boolean;
  }[];
  emptyState: {
    icon: string;
    title: string;
  };
}

const allProjectsData = [
  {
    id: "research-analysis",
    title: "Research & Analysis",
    description: "User research insights & data analysis",
    updatedAt: "Updated 12 days ago",
  },
  {
    id: "web-search",
    title: "Web Search",
    description: "Search functionality and SEO optimization",
    updatedAt: "Updated 12 days ago",
  },
  {
    id: "api-documentation",
    title: "API Documentation",
    description: "Rest API documentation and examples",
    updatedAt: "Updated 12 days ago",
  },
  {
    id: "feature-overview",
    title: "Feature Overview",
    description: "Product feature planning and specifications",
    updatedAt: "Updated 12 days ago",
  },
  {
    id: "knowledge-base",
    title: "Knowledge Base",
    description: "Key tips for effective project management",
    updatedAt: "Updated 12 days ago",
  },
  {
    id: "user-guide",
    title: "User Guide",
    description: "User onboarding and guide creation",
    updatedAt: "Updated 12 days ago",
  },
];

const getFakeProjectDetailData = (projectId: string): ProjectDetailData => {
  const project = allProjectsData.find((p) => p.id === projectId);

  if (!project) {
    return {
      project: {
        id: projectId,
        title: "Unknown Project",
        description: "Project not found",
        isPrivate: true,
        isStarred: false,
      },
      premiumBanner: {
        icon: "RiFlashlightFill",
        text: "Access premium models & features",
        buttonText: "Upgrade",
      },
      projectFiles: {
        title: "Project files",
        count: 0,
        files: [],
      },
      instructions: {
        title: "Instructions",
        description: "Set project behavior guidelines",
        content: "",
      },
      chats: [],
      emptyState: {
        icon: "/icons/empty-chat.svg",
        title:
          "Start a chat to keep conversations organized and re-use project knowledge.",
      },
    };
  }

  return {
    project: {
      id: project.id,
      title: project.title,
      description: project.description,
      isPrivate: true,
      isStarred: false,
    },
    premiumBanner: {
      icon: "RiFlashlightFill",
      text: "Access premium models & features",
      buttonText: "Upgrade",
    },
    projectFiles: {
      title: "Project files",
      count: 3,
      files: [
        {
          id: "1",
          name: "Excel",
          type: "Excel",
          icon: RiFileExcelFill,
          color: "fill-green-600/56 text-white",
        } as const,
        {
          id: "2",
          name: "Word",
          type: "Word",
          icon: RiFileWordFill,
          color: "fill-blue-600/56 text-white",
        } as const,
        {
          id: "3",
          name: "PDF",
          type: "PDF",
          icon: RiFilePdf2Fill,
          color: "fill-red-600/56 text-white",
        } as const,
      ],
    },
    instructions: {
      title: "Instructions",
      description: "Set project behavior guidelines",
      content:
        "Respond in a friendly, professional, and concise tone. When appropriate, include real-world examples to improve clarity.",
    },
    chats: [
      {
        id: "1",
        title: "UI Design Review",
        description: "Analyzing color schemes and layout adjustments.",
        time: "1:00 PM",
      },
      {
        id: "2",
        title: "User Testing Feedback",
        description: "Gathering insights from recent usability tests.",
        time: "3:15 PM",
        isActive: true,
      },
      {
        id: "3",
        title: "Accessibility Standards",
        description: "Reviewing WCAG compliance requirements.",
        time: "4:00 PM",
      },
      {
        id: "4",
        title: "Marketing Strategies",
        description: "Developing campaign ideas for product launch.",
        time: "5:30 PM",
      },
      {
        id: "5",
        title: "Feature Roadmap Planning",
        description: "Prioritizing upcoming feature developments.",
        time: "6:45 PM",
      },
    ],
    emptyState: {
      icon: "/icons/empty-chat.svg",
      title:
        "Start a chat to keep conversations organized and re-use project knowledge.",
    },
  };
};

export default function ProjectContent({ id }: { id: string }) {
  const projectData = getFakeProjectDetailData(id);

  const searchParams = useSearchParams();
  const isEmpty = searchParams.get("empty") === "true";

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isStarred, setIsStarred] = useState(projectData.project.isStarred);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [projectFiles, setProjectFiles] = useState(
    projectData.projectFiles.files,
  );
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
  const [projectInstructions, setProjectInstructions] = useState(
    isEmpty ? "" : projectData.instructions.content,
  );
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);

  const handleStarToggle = () => {
    setIsStarred(!isStarred);
  };

  const handleUploadModalOpen = () => {
    setIsUploadModalOpen(true);
  };

  const handleUploadModalClose = () => {
    setIsUploadModalOpen(false);
  };

  const handleSaveFiles = (files: any[]) => {
    setProjectFiles(files);
  };

  const getExistingFiles = () => {
    return isEmpty ? [] : projectFiles;
  };

  const handleInstructionsModalOpen = () => {
    setIsInstructionsModalOpen(true);
  };

  const handleInstructionsModalClose = () => {
    setIsInstructionsModalOpen(false);
  };

  const handleSaveInstructions = (instructions: string) => {
    setProjectInstructions(instructions);
  };

  const getExistingInstructions = () => {
    return isEmpty ? "" : projectInstructions;
  };

  return (
    <div className="flex h-full flex-col lg:p-1.5 lg:pl-0">
      <div
        className="bg-bg-white-0 lg:border-stroke-soft-200 flex h-full w-full flex-col overflow-auto px-5 py-7 lg:rounded-3xl lg:border lg:p-5"
        style={{ scrollbarWidth: "none" }}
      >
        <div className="bg-bg-white-0 border-stroke-soft-200 fixed top-0 left-0 z-61 flex w-full items-center justify-between border-b p-5 lg:relative lg:mb-8 lg:border-b-0 lg:px-0 lg:py-0">
          <LinkButton.Root
            asChild
            className="group lg:font-regular tracking-spacing-tiny-2 text-text-sub-600 cursor-pointer gap-2 rounded-md p-0 text-sm font-medium no-underline hover:no-underline"
          >
            <Link href="/dashboard">
              <LinkButton.Icon
                as={RiArrowLeftLongLine}
                className="text-text-soft-400 group-hover:text-text-sub-600 group-hover:bg-bg-weak-50 size-5 rounded-md"
              />
              All projects
            </Link>
          </LinkButton.Root>
          <div className="flex items-center gap-2 lg:hidden">
            <Button.Root
              size="small"
              variant="neutral"
              mode="ghost"
              className={cn(
                "group size-6 cursor-pointer rounded-md p-0",
                isStarred && "shadow-gray-shadow bg-bg-weak-50",
              )}
              onClick={handleStarToggle}
            >
              <Button.Icon
                as={RiStarLine}
                className={cn(
                  "size-4.5 transition-colors duration-200",
                  isStarred
                    ? "text-text-sub-600"
                    : "text-text-soft-400 group-hover:text-text-sub-600",
                )}
              />
            </Button.Root>

            <Popover.Root
              open={isMobileMenuOpen}
              onOpenChange={setIsMobileMenuOpen}
            >
              <Popover.Trigger asChild>
                <Button.Root
                  size="small"
                  variant="neutral"
                  mode="ghost"
                  className={cn(
                    "group size-6 cursor-pointer rounded-md p-0",
                    isMobileMenuOpen && "shadow-gray-shadow bg-bg-weak-50",
                  )}
                >
                  <Button.Icon
                    as={RiMore2Line}
                    className={cn(
                      "text-text-soft-400 group-hover:text-text-sub-600 size-4.5",
                      isMobileMenuOpen && "text-text-sub-600",
                    )}
                  />
                </Button.Root>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="bg-bg-white-0 shadow-complex z-62 min-w-32 rounded-xl p-1"
                  side="bottom"
                  sideOffset={10}
                  align="end"
                >
                  <div className="flex flex-col gap-0.5">
                    <Button.Root
                      variant="neutral"
                      mode="ghost"
                      size="small"
                      className="group/menu-item text-text-sub-600 !h-auto cursor-pointer justify-start !gap-1.5 !p-1.5 text-xs font-medium"
                    >
                      <Button.Icon
                        as={RiShareLine}
                        className="text-text-soft-400 group-hover/menu-item:text-text-sub-600 !-mx-0 !size-4"
                      />
                      Share
                    </Button.Root>
                    <Button.Root
                      variant="neutral"
                      mode="ghost"
                      size="small"
                      className="group/menu-item text-text-sub-600 !h-auto cursor-pointer justify-start !gap-1.5 !p-1.5 text-xs font-medium"
                    >
                      <Button.Icon
                        as={RiPencilLine}
                        className="text-text-soft-400 group-hover/menu-item:text-text-sub-600 !-mx-0 !size-4"
                      />
                      Rename
                    </Button.Root>
                    <Button.Root
                      variant="neutral"
                      mode="ghost"
                      size="small"
                      className="group/menu-item text-text-sub-600 !h-auto cursor-pointer justify-start !gap-1.5 !p-1.5 text-xs font-medium"
                    >
                      <Button.Icon
                        as={RiSettings3Line}
                        className="text-text-soft-400 group-hover/menu-item:text-text-sub-600 !-mx-0 !size-4"
                      />
                      Settings
                    </Button.Root>
                    <Button.Root
                      variant="neutral"
                      mode="ghost"
                      size="small"
                      className="group/menu-item text-text-sub-600 !h-auto cursor-pointer justify-start !gap-1.5 !p-1.5 text-xs font-medium"
                    >
                      <Button.Icon
                        as={RiDeleteBinLine}
                        className="text-error-base !-mx-0 !size-4"
                      />
                      Delete
                    </Button.Root>
                  </div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>
        </div>

        <div className="mx-auto w-full pt-16 lg:max-w-175 lg:min-w-175 lg:pt-0">
          <div className="flex flex-col items-center lg:items-start">
            <div className="border-faded-lighter mb-5 flex size-12 items-center justify-center rounded-full border">
              <RiFolderOpenFill className="size-7 text-green-600/56" />
            </div>
            <div className="mb-5 flex w-full items-start justify-center gap-2 lg:mb-4 lg:justify-between">
              <div className="flex items-center gap-2">
                <h1 className="text-text-strong-950 tracking-spacing-tiny-1 text-lg font-medium">
                  {projectData.project.title}
                </h1>
                <div className="bg-faded-lighter flex items-center gap-1 rounded-[7px] px-1.5 py-1">
                  <RiLockFill className="text-faded-base size-3.5" />
                  <span className="text-faded-base text-xs font-medium">
                    Private
                  </span>
                </div>
              </div>
              <div className="hidden items-center gap-2 lg:flex">
                <Button.Root
                  size="small"
                  variant="neutral"
                  mode="ghost"
                  className={cn(
                    "group size-6 cursor-pointer rounded-md p-0",
                    isStarred && "shadow-gray-shadow bg-bg-weak-50",
                  )}
                  onClick={handleStarToggle}
                >
                  <Button.Icon
                    as={RiStarLine}
                    className={cn(
                      "size-4.5 transition-colors duration-200",
                      isStarred
                        ? "text-text-sub-600"
                        : "text-text-soft-400 group-hover:text-text-sub-600",
                    )}
                  />
                </Button.Root>

                <Popover.Root open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                  <Popover.Trigger asChild>
                    <Button.Root
                      size="small"
                      variant="neutral"
                      mode="ghost"
                      className={cn(
                        "group size-6 cursor-pointer rounded-md p-0",
                        isMenuOpen && "shadow-gray-shadow bg-bg-weak-50",
                      )}
                    >
                      <Button.Icon
                        as={RiMore2Line}
                        className={cn(
                          "text-text-soft-400 group-hover:text-text-sub-600 size-4.5 transition-transform duration-400",
                          isMenuOpen && "text-text-sub-600",
                        )}
                      />
                    </Button.Root>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content
                      className="bg-bg-white-0 shadow-complex z-50 min-w-32 rounded-xl p-1"
                      side="bottom"
                      sideOffset={10}
                      align="end"
                    >
                      <div className="flex flex-col gap-0.5">
                        <Button.Root
                          variant="neutral"
                          mode="ghost"
                          size="small"
                          className="group/menu-item text-text-sub-600 !h-auto cursor-pointer justify-start !gap-1.5 !p-1.5 text-xs font-medium"
                        >
                          <Button.Icon
                            as={RiShareLine}
                            className="text-text-soft-400 group-hover/menu-item:text-text-sub-600 !-mx-0 !size-4"
                          />
                          Share
                        </Button.Root>
                        <Button.Root
                          variant="neutral"
                          mode="ghost"
                          size="small"
                          className="group/menu-item text-text-sub-600 !h-auto cursor-pointer justify-start !gap-1.5 !p-1.5 text-xs font-medium"
                        >
                          <Button.Icon
                            as={RiPencilLine}
                            className="text-text-soft-400 group-hover/menu-item:text-text-sub-600 !-mx-0 !size-4"
                          />
                          Rename
                        </Button.Root>
                        <Button.Root
                          variant="neutral"
                          mode="ghost"
                          size="small"
                          className="group/menu-item text-text-sub-600 !h-auto cursor-pointer justify-start !gap-1.5 !p-1.5 text-xs font-medium"
                        >
                          <Button.Icon
                            as={RiSettings3Line}
                            className="text-text-soft-400 group-hover/menu-item:text-text-sub-600 !-mx-0 !size-4"
                          />
                          Settings
                        </Button.Root>
                        <Button.Root
                          variant="neutral"
                          mode="ghost"
                          size="small"
                          className="group/menu-item text-text-sub-600 !h-auto cursor-pointer justify-start !gap-1.5 !p-1.5 text-xs font-medium"
                        >
                          <Button.Icon
                            as={RiDeleteBinLine}
                            className="text-error-base !-mx-0 !size-4"
                          />
                          Delete
                        </Button.Root>
                      </div>
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              </div>
            </div>
          </div>

          <div className="w-calc[100% + 16px] mb-8 -ml-2 lg:-ml-0 lg:w-full">
            <ChatInput placeholder="How can I help you today?" />
          </div>

          <div className="rounded-20 border-faded-lighter -mt-30 mb-6 grid grid-cols-1 border px-5 pt-21 pb-4 lg:-mt-23 lg:mb-7 lg:grid-cols-2 lg:px-6 lg:pt-14">
            <div className="border-faded-lighter flex w-full items-center gap-2 border-b pb-3 lg:border-r lg:border-b-0 lg:pr-6 lg:pb-0">
              <div className="flex flex-1 flex-col gap-1">
                <h3 className="text-text-strong-950 text-xs font-medium">
                  {projectData.projectFiles.title}
                </h3>
                <div className="text-text-soft-400 text-xs font-medium">
                  {isEmpty
                    ? "No files added yet"
                    : `${projectFiles.length} files`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex max-w-37.5 overflow-hidden">
                  <div
                    className="flex w-full items-center gap-2 overflow-auto"
                    style={{ scrollbarWidth: "none" }}
                  >
                    {!isEmpty &&
                      projectFiles.map((file) => (
                        <div
                          key={file.id}
                          className="bg-bg-white-0 border-faded-lighter flex size-7 shrink-0 items-center justify-center rounded-[9px] border"
                        >
                          <file.icon className={cn("size-5", file.color)} />
                        </div>
                      ))}
                  </div>
                </div>
                <Button.Root
                  variant="neutral"
                  mode="ghost"
                  size="small"
                  onClick={handleUploadModalOpen}
                  className="border-faded-lighter bg-bg-white-0 hover:bg-bg-soft-200 size-7 cursor-pointer rounded-[9px] border p-0"
                >
                  <Button.Icon
                    as={RiAddLine}
                    className="text-text-soft-400 group-hover:text-text-sub-600 size-4"
                  />
                </Button.Root>
              </div>
            </div>

            <div className="flex w-full items-center gap-2 pt-3 lg:pt-0 lg:pl-6">
              <div className="flex flex-col gap-1">
                <h3 className="text-text-strong-950 text-xs font-medium">
                  {projectData.instructions.title}
                </h3>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-text-soft-400 text-xs font-medium",
                      projectInstructions.trim() !== "" && "line-clamp-1",
                    )}
                  >
                    {projectInstructions.trim() === ""
                      ? "Set project behavior guidelines"
                      : projectInstructions}
                  </p>
                </div>
              </div>
              <Button.Root
                size="small"
                variant="neutral"
                mode="ghost"
                onClick={handleInstructionsModalOpen}
                className="bg-bg-white-0 border-faded-lighter ml-auto flex size-7 cursor-pointer items-center justify-center rounded-[9px] border"
              >
                <Button.Icon
                  as={isEmpty ? RiAddLine : RiPencilLine}
                  className="text-text-soft-400 group-hover:text-text-sub-600 size-4"
                />
              </Button.Root>
            </div>
          </div>

          <div className="flex-1">
            <h3 className="text-text-soft-400 mb-2.5 text-xs font-medium lg:mb-3">
              Chats in this project
            </h3>

            {isEmpty ? (
              <div className="bg-bg-white-0 border-faded-lighter rounded-20 flex h-fit w-full flex-col items-center justify-center gap-4 border p-7">
                <RiChatAiFill className="text-text-disabled-300 size-7" />
                <p className="text-text-soft-400 tracking-spacing-tiny-2 max-w-80 text-center text-sm">
                  {projectData.emptyState.title}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 lg:gap-2.5">
                {projectData.chats.map((chat) => (
                  <div
                    key={chat.id}
                    className={cn(
                      "group bg-bg-white-0 border-faded-lighter relative flex cursor-pointer gap-3.5 rounded-[14px] border p-4 transition-all duration-200 lg:h-11 lg:items-center lg:gap-2.5 lg:px-3 lg:py-0",
                      "lg:hover:bg-bg-weak-50",
                    )}
                    data-state={openPopoverId === chat.id ? "open" : "closed"}
                  >
                    <div className="flex size-5 items-center justify-center">
                      <RiChatAiFill className="fill-text-disabled-300 size-5 transition-colors duration-200 lg:group-hover:fill-green-600" />
                    </div>

                    <div className="-mt-0.25 flex w-[80%] flex-col gap-3.5 lg:mt-0 lg:w-full lg:flex-row lg:items-center">
                      <div className="flex flex-1 flex-col gap-1.5 lg:flex-row lg:items-center lg:gap-2.5">
                        <h4 className="text-text-strong-950 tracking-spacing-tiny-2 text-sm font-medium">
                          {chat.title}
                        </h4>
                        <p className="text-text-soft-400 tracking-spacing-tiny-2 flex items-center text-xs lg:text-sm">
                          <span className="text-text-disabled-300 mr-2.5 hidden lg:flex">
                            —
                          </span>
                          {chat.description}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-text-soft-400 border-bg-soft-200 pl-0 text-xs font-medium lg:border-l lg:pl-3.5 lg:group-hover:hidden",
                          openPopoverId === chat.id && "lg:hidden",
                        )}
                      >
                        {chat.time}
                      </span>
                    </div>
                    <div
                      className="absolute top-4 right-4 h-fit w-fit lg:top-3 lg:right-3.5"
                      data-state={openPopoverId === chat.id ? "open" : "closed"}
                    >
                      <Popover.Root
                        onOpenChange={(open) =>
                          setOpenPopoverId(open ? chat.id : null)
                        }
                      >
                        <Popover.Trigger asChild>
                          <Button.Root
                            size="small"
                            variant="neutral"
                            mode="ghost"
                            className="pointer-events-auto size-5 cursor-pointer rounded-md p-0 opacity-100 transition-opacity duration-200 data-[state=open]:pointer-events-auto data-[state=open]:opacity-100 lg:pointer-events-none lg:opacity-0 lg:group-hover:pointer-events-auto lg:group-hover:opacity-100"
                          >
                            <Button.Icon
                              as={RiMore2Line}
                              className="text-text-sub-600 hover:bg-bg-soft-200 data-[state=open]:bg-bg-soft-200 size-5 rounded-sm duration-200"
                            />
                          </Button.Root>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content
                            className="bg-bg-white-0 shadow-complex z-50 min-w-32 rounded-xl p-1"
                            side="bottom"
                            sideOffset={10}
                            align="end"
                          >
                            <div className="flex flex-col gap-0.5">
                              <Button.Root
                                variant="neutral"
                                mode="ghost"
                                size="small"
                                className="group/menu-item text-text-sub-600 !h-auto cursor-pointer justify-start !gap-1.5 !p-1.5 text-xs font-medium"
                              >
                                <Button.Icon
                                  as={RiPencilLine}
                                  className="text-text-soft-400 group-hover/menu-item:text-text-sub-600 !-mx-0 !size-4"
                                />
                                Rename
                              </Button.Root>
                              <Button.Root
                                variant="neutral"
                                mode="ghost"
                                size="small"
                                className="group/menu-item text-text-sub-600 !h-auto cursor-pointer justify-start !gap-1.5 !p-1.5 text-xs font-medium"
                              >
                                <Button.Icon
                                  as={RiShareLine}
                                  className="text-text-soft-400 group-hover/menu-item:text-text-sub-600 !-mx-0 !size-4"
                                />
                                Share
                              </Button.Root>
                              <Button.Root
                                variant="neutral"
                                mode="ghost"
                                size="small"
                                className="group/menu-item text-text-sub-600 !h-auto cursor-pointer justify-start !gap-1.5 !p-1.5 text-xs font-medium"
                              >
                                <Button.Icon
                                  as={RiDeleteBinLine}
                                  className="text-error-base !-mx-0 !size-4"
                                />
                                Delete
                              </Button.Root>
                            </div>
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <UploadFilesModal
        isOpen={isUploadModalOpen}
        onClose={handleUploadModalClose}
        onSaveFiles={handleSaveFiles}
        projectTitle={projectData.project.title}
        existingFiles={getExistingFiles()}
      />

      <SetInstructionsModal
        isOpen={isInstructionsModalOpen}
        onClose={handleInstructionsModalClose}
        onSaveInstructions={handleSaveInstructions}
        existingInstructions={getExistingInstructions()}
      />
    </div>
  );
}
