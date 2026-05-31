import { Button } from '@/app/components/ui/button';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  userName?: string;
}

export function AppHeader({ title, subtitle, showBackButton = true, userName }: AppHeaderProps) {
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="bg-white shadow-sm border-b mb-4">
      <div className="max-w-7xl mx-auto px-2 py-2 flex justify-between items-center">
        <div className="flex items-center gap-1">
          <img src="/logo.png" alt="MDM Logo" className="w-10 h-10" />
          <div>
            <h1 className="text-[27px] font-bold text-gray-800 px-2">MDM Calculator</h1>
            {userName && <p className="text-[15px] text-gray-600 px-2">welcome {userName.toLowerCase()}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {showBackButton && (
            <Button 
              onClick={() => router.push('/dashboard')} 
              variant="outline"
              size="sm"
            >
              ← Dashboard
            </Button>
          )}
          
          {/* Profile Button */}
          {userName && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold hover:bg-blue-700 transition-colors"
              >
                {getInitials(userName)}
              </button>
              
              {/* Dropdown Menu */}
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-md"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* Fallback logout button if no userName */}
          {!userName && (
            <Button onClick={handleLogout} variant="outline" size="sm">
              Logout
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}