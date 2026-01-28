"use client"

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHome,
  faFileAlt,
  faCog,
  faServer,
  faEnvelope,
  faGlobe,
  faSlidersH,
  faTerminal,
  faInfoCircle,
} from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  badge?: string;
}

const mainNavItems: NavItem[] = [
  { id: 'overview', label: 'Übersicht', icon: faHome },
  { id: 'documents', label: 'Dokumente', icon: faFileAlt },
  { id: 'logs', label: 'Live Logs', icon: faTerminal },
];

const settingsNavItems: NavItem[] = [
  { id: 'paperless', label: 'Paperless', icon: faServer },
  { id: 'google', label: 'Google Services', icon: faGlobe },
  { id: 'ftp', label: 'FTP Server', icon: faServer },
  { id: 'email', label: 'E-Mail', icon: faEnvelope },
  { id: 'advanced', label: 'Erweitert', icon: faSlidersH },
];

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <div className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full">
      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-1">
          <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Navigation
          </h3>
          {mainNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === item.id
                  ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              <FontAwesomeIcon icon={item.icon} className="w-4 h-4" />
              <span>{item.label}</span>
              {item.badge && (
                <span className="ml-auto bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Settings Section */}
        <div className="p-4 space-y-1 border-t border-gray-200 dark:border-gray-800">
          <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Einstellungen
          </h3>
          {settingsNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === item.id
                  ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              <FontAwesomeIcon icon={item.icon} className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Info Section */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <Link
            href="/about"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <FontAwesomeIcon icon={faInfoCircle} className="w-4 h-4" />
            <span>Info & Kontakt</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
