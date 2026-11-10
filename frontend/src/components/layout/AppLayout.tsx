import React, { useState, ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopNavbar } from './TopNavbar';

interface AppLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  title,
  subtitle,
  children,
}) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background-app text-txt-primary flex">
      {/* Sidebar */}
      <Sidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopNavbar
          title={title}
          subtitle={subtitle}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
};
