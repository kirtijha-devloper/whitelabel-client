import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, User, X, ChevronDown, Loader2 } from 'lucide-react';
import { AllUsers, searchUsers } from '../../api/FranchiseApi';
import { extractUsersArray } from '../../utils/userAccess';

const normalizeRoleBadge = (role) => {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'admin') return { label: 'Admin', bg: 'bg-purple-100 text-purple-700' };
  if (r === 'employee') return { label: 'Employee', bg: 'bg-blue-100 text-blue-700' };
  if (r === 'franchise' || r === 'franchaise') return { label: 'Franchise', bg: 'bg-amber-100 text-amber-700' };
  if (r === 'merchant') return { label: 'Merchant', bg: 'bg-emerald-100 text-emerald-700' };
  return { label: role || 'User', bg: 'bg-gray-100 text-gray-700' };
};

const UserSelectWithSuggestions = ({
  selectedUser = null,
  onSelectUser,
  placeholder = 'Search & select user (ID, Name, Mobile)...',
  label = 'Select User',
  className = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Debounce user search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchTerm.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isSearching = debouncedQuery.length > 0;

  // Search API query
  const { data: searchResults, isLoading: isSearchLoading } = useQuery({
    queryKey: ['searchUsersReportFilter', debouncedQuery],
    queryFn: () => searchUsers({ q: debouncedQuery, limit: 20 }),
    enabled: isOpen && isSearching,
    staleTime: 30 * 1000,
  });

  // Default active users query (shown when input is focused with empty search)
  const { data: defaultUsersResponse, isLoading: isDefaultLoading } = useQuery({
    queryKey: ['defaultUsersReportFilter'],
    queryFn: () => AllUsers({ limit: 15, status: 'active' }),
    enabled: isOpen && !isSearching,
    staleTime: 60 * 1000,
  });

  const suggestions = useMemo(() => {
    const raw = isSearching ? searchResults : defaultUsersResponse;
    const list = extractUsersArray(raw);
    return list || [];
  }, [isSearching, searchResults, defaultUsersResponse]);

  const isLoading = isSearching ? isSearchLoading : isDefaultLoading;

  const handleSelect = (user) => {
    onSelectUser(user);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onSelectUser(null);
    setSearchTerm('');
    setIsOpen(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const getDisplayText = () => {
    if (isOpen) return searchTerm;
    if (selectedUser) {
      const name = selectedUser.name || 'User';
      const idOrMobile = selectedUser.abheepay_id || selectedUser.mobile_number || selectedUser.id || '';
      return idOrMobile ? `${name} (${idOrMobile})` : name;
    }
    return searchTerm;
  };

  return (
    <div ref={dropdownRef} className={`relative w-full ${className}`}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        <div className="pointer-events-none absolute left-3 flex items-center text-gray-400">
          {selectedUser ? <User className="h-4 w-4 text-[#00D3CD]" /> : <Search className="h-4 w-4" />}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={getDisplayText()}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full rounded-lg border bg-white pl-9 pr-16 py-2 text-sm text-gray-900 outline-none transition duration-150 focus:ring-2 focus:ring-[#00D3CD] ${
            selectedUser
              ? 'border-[#00D3CD] font-medium bg-teal-50/20 text-teal-900'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        />

        <div className="absolute right-2.5 flex items-center gap-1">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-[#00D3CD]" />}

          {(selectedUser || searchTerm) && (
            <button
              type="button"
              onClick={handleClear}
              title="Clear selection"
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="text-gray-400 hover:text-gray-600 p-0.5"
          >
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Autocomplete Suggestions Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl py-1 divide-y divide-gray-100">
          {isLoading && suggestions.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin text-[#00D3CD]" />
              <span>Searching users...</span>
            </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((user) => {
              const isSelected = selectedUser?.id === user.id;
              const roleBadge = normalizeRoleBadge(user.role);
              const displayName = user.name || 'Unnamed User';
              const displayMobile = user.mobile_number || '';
              const displayId = user.abheepay_id || user.id || '';
              const avatarLetter = displayName.charAt(0).toUpperCase();

              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelect(user)}
                  className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 transition hover:bg-teal-50/60 ${
                    isSelected ? 'bg-teal-50 text-teal-900 font-medium' : 'text-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#1855e4] to-[#00D3CD] text-xs font-bold text-white shadow-sm">
                      {avatarLetter}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900 leading-snug">
                        {displayName}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 truncate mt-0.5">
                        {displayId && <span>ID: {displayId}</span>}
                        {displayId && displayMobile && <span>•</span>}
                        {displayMobile && <span>Mob: {displayMobile}</span>}
                      </div>
                    </div>
                  </div>

                  <span className={`shrink-0 px-2 py-0.5 text-[11px] font-semibold rounded-full ${roleBadge.bg}`}>
                    {roleBadge.label}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="py-4 text-center text-xs text-gray-500">
              No users found matching "{searchTerm}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserSelectWithSuggestions;
