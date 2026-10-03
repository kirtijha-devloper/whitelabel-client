import React, { useState, useEffect } from 'react';
import { X, Search, Check, Loader } from 'lucide-react';
import { GetAllFranchises, GetAllMerchants } from '../../api/FranchiseApi';

const FranchiseCommissionModal = ({ rule, onClose, onSave }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [franchises, setFranchises] = useState([]); // This will now hold ALL users (Franchises + Merchants)
  const [filteredFranchises, setFilteredFranchises] = useState([]);
  const [selectedFranchise, setSelectedFranchise] = useState(null);
  const [commissionFee, setCommissionFee] = useState(rule?.percent_fee || 0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch Users on Mount
  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter Users on Search
  useEffect(() => {
    if (!searchTerm) {
      setFilteredFranchises(franchises);
      return;
    }
    const term = searchTerm.toLowerCase().trim();
    console.log("Searching for:", term, "in", franchises.length, "users");

    const filtered = franchises.filter(f =>
      (f.name && f.name.toLowerCase().includes(term)) ||
      (f.id && String(f.id).toLowerCase().includes(term)) ||
      (f._id && String(f._id).toLowerCase().includes(term)) || // Check _id too
      (f.phone && String(f.phone).includes(term)) ||
      (f.mobile_number && String(f.mobile_number).includes(term)) ||
      (f.email && f.email.toLowerCase().includes(term)) // Add email search
    );
    console.log("Filtered results:", filtered);
    setFilteredFranchises(filtered);
  }, [searchTerm, franchises]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch BOTH Merchants and Franchises
      const [franchiseRes, merchantRes] = await Promise.allSettled([
        GetAllFranchises(),
        GetAllMerchants()
      ]);

      let allUsers = [];

      // Process Franchises
      if (franchiseRes.status === 'fulfilled') {
        const res = franchiseRes.value;
        let data = [];
        if (Array.isArray(res)) data = res;
        else if (res.data && Array.isArray(res.data)) data = res.data;
        else if (res.users && Array.isArray(res.users)) data = res.users;
        allUsers = [...allUsers, ...data.map(u => ({ ...u, type: 'Franchise' }))];
      }

      // Process Merchants
      if (merchantRes.status === 'fulfilled') {
        const res = merchantRes.value;
        let data = [];
        if (Array.isArray(res)) data = res;
        else if (res.data && Array.isArray(res.data)) data = res.data;
        else if (res.users && Array.isArray(res.users)) data = res.users;
        allUsers = [...allUsers, ...data.map(u => ({ ...u, type: 'Merchant' }))];
      }

      console.log("Combined Users in Modal:", allUsers);
      console.log("User Names:", allUsers.map(u => u.name).join(", "));
      setFranchises(allUsers);
      setFilteredFranchises(allUsers);
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedFranchise) return;
    setSaving(true);
    try {
      await onSave(selectedFranchise, commissionFee);
      onClose();
    } catch (error) {
      console.error("Save failed", error);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-bold text-gray-900">Add Commission</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">

          {/* Search Dropdown */}
          <div className="relative">
            <div className="relative">
              <input
                type="text"
                placeholder="Search Name / ID / Mobile"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00D3CD] focus:border-transparent outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={() => { if (!selectedFranchise) setSearchTerm('') }} // cleared on click if needed? No common pattern
              />
              <Search className="absolute left-3 top-3.5 text-gray-400" size={18} />
            </div>

            {/* Dropdown List */}
            {!selectedFranchise && filteredFranchises.length > 0 && searchTerm && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-gray-500">Loading...</div>
                ) : (
                  filteredFranchises.map(f => (
                    <div
                      key={f.id}
                      onClick={() => {
                        setSelectedFranchise(f);
                        setSearchTerm(`${f.id} - ${f.name}`);
                      }}
                      className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-none"
                    >
                      <div className="text-sm font-medium text-gray-900">
                        {f.id} - {f.name} <span className="text-xs text-gray-400 ml-1">[{f.type}]</span>
                      </div>
                      <div className="text-xs text-gray-500">{f.phone || f.mobile_number || 'No Phone'}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Context Info */}
          {rule && (
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              CARD {rule.paymentCardBrand} {rule.paymentCardType} - GLOBAL COMMISSION {rule.percent_fee}%
            </div>
          )}

          {/* Commission Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Commission Fee (%)</label>
            <input
              type="number"
              step="0.01"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00D3CD] outline-none"
              value={commissionFee}
              onChange={(e) => setCommissionFee(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedFranchise || saving}
            className={`px-6 py-2 text-white bg-[#00D3CD] hover:bg-[#00bdb7] rounded-lg font-medium transition-colors flex items-center gap-2 ${(!selectedFranchise || saving) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {saving ? <Loader size={18} className="animate-spin" /> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FranchiseCommissionModal;
