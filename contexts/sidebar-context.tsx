"use client";
import { createContext, useContext } from "react";

interface SidebarContextType {
  onMenuClick?: () => void;
}

const SidebarContext = createContext<SidebarContextType>({});

export const useSidebar = () => useContext(SidebarContext);

export const SidebarProvider = ({ 
  children, 
  onMenuClick 
}: { 
  children: React.ReactNode;
  onMenuClick?: () => void;
}) => {
  return (
    <SidebarContext.Provider value={{ onMenuClick }}>
      {children}
    </SidebarContext.Provider>
  );
};
