import React from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Building,
  Globe,
  MapPin,
  CreditCard,
  Calendar,
  SquarePen,
  FileText,
  Loader2,
  HardDrive,
  ShieldCheck,
} from "lucide-react";
import { getAdminDetails } from "../../api/superAdminApi";
import { BASE_SITE_URL } from "../../constants";

const AdminProfile = ({ currentUser }) => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Retrieve fallback data from localStorage if available
  const storedAdmin = React.useMemo(() => {
    try {
      const raw = localStorage.getItem("selectedUser") || localStorage.getItem("selectedAdmin");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return String(parsed?.id) === String(id) ? parsed : null;
    } catch {
      return null;
    }
  }, [id]);

  const {
    data: adminResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["superAdminDetails", id],
    queryFn: () => getAdminDetails(id),
    enabled: Boolean(id),
  });

  const admin = adminResponse?.data || adminResponse?.user || storedAdmin || {};
  const company = admin?.company || {};
  const posMachines = Array.isArray(admin?.pos_machines) ? admin.pos_machines : [];

  if (isLoading && !storedAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
          <span className="text-base font-medium">Loading Admin Profile...</span>
        </div>
      </div>
    );
  }

  if (error && !storedAdmin) {
    return (
      <div className="min-h-screen p-6 bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <User className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Failed to Load Admin Profile</h2>
          <p className="text-sm text-gray-500">{error?.message || "Admin not found."}</p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate("/super-admin/admin-list")}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              Back to List
            </button>
            <button
              type="button"
              onClick={() => refetch()}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderDocumentPreview = (label, urlOrPath) => {
    if (!urlOrPath) return null;
    const fullUrl = urlOrPath.startsWith("http")
      ? urlOrPath
      : `${BASE_SITE_URL}/${urlOrPath.replace(/^\/+/, "")}`;

    return (
      <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 flex flex-col items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-700 text-center">{label}</span>
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full overflow-hidden rounded-lg border border-gray-200 bg-white"
        >
          <img
            src={fullUrl}
            alt={label}
            className="w-full h-28 object-contain hover:scale-105 transition-transform duration-200"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src =
                "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22 viewBox=%220 0 80 80%22%3E%3Crect width=%2280%22 height=%2280%22 fill=%22%23f3f4f6%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%236b7280%22 font-family=%22Arial,sans-serif%22 font-size=%2210%22%3EDocument%3C/text%3E%3C/svg%3E";
            }}
          />
        </a>
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline font-medium"
        >
          View Full Document
        </a>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 space-y-6">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate("/super-admin/admin-list")}
              className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
              title="Back to Admin List"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">Admin Profile</h1>
                <span
                  className={`px-3 py-0.5 rounded-full text-xs font-semibold capitalize ${
                    admin.status === "active"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      : "bg-rose-100 text-rose-800 border border-rose-200"
                  }`}
                >
                  {admin.status || "active"}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Abheepay ID:{" "}
                <span className="font-semibold text-gray-800">
                  {admin.abheepay_id || admin.username || "N/A"}
                </span>
                {admin.createdAt && (
                  <span className="ml-3 text-gray-400">
                    Joined {new Date(admin.createdAt).toLocaleDateString()}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                localStorage.setItem("selectedUser", JSON.stringify(admin));
                localStorage.setItem("selectedAdmin", JSON.stringify(admin));
                navigate(`/super-admin/create-admin/${admin.id}`);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 shadow-sm transition-opacity"
            >
              <SquarePen className="w-4 h-4" />
              Edit Admin
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Content Grid ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <User className="w-5 h-5 text-primary" />
              Personal Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500">Full Name</p>
                <p className="font-semibold text-gray-900 mt-0.5">{admin.name || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Email Address</p>
                <p className="font-semibold text-gray-900 mt-0.5">{admin.email || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Mobile Number</p>
                <p className="font-semibold text-gray-900 mt-0.5">
                  {admin.mobile_number_country_code || "+91"} {admin.mobile_number || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Username</p>
                <p className="font-semibold text-gray-900 mt-0.5">{admin.username || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Gender</p>
                <p className="font-semibold text-gray-900 capitalize mt-0.5">{admin.gender || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Date of Birth</p>
                <p className="font-semibold text-gray-900 mt-0.5">
                  {admin.dob ? new Date(admin.dob).toLocaleDateString() : "-"}
                </p>
              </div>
            </div>
          </div>

          {/* Company & Business Information */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <Building className="w-5 h-5 text-primary" />
              Company / Business Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500">Company Name</p>
                <p className="font-semibold text-blue-600 mt-0.5">
                  {company.company_name || admin.company_or_shop_name || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Domain Name</p>
                <p className="font-semibold text-gray-900 mt-0.5">{company.domain_name || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Company ID</p>
                <p className="font-semibold text-gray-900 mt-0.5">{admin.company_id || company.company_id || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Settlement Type</p>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 mt-1 capitalize">
                  {(admin.settlement_type || "today_settlement").replace(/_/g, " ")}
                </span>
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <MapPin className="w-5 h-5 text-primary" />
              Address Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="sm:col-span-2">
                <p className="text-xs text-gray-500">Address Line 1</p>
                <p className="font-medium text-gray-800 mt-0.5">{admin.address1 || "-"}</p>
              </div>
              {admin.address2 && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-gray-500">Address Line 2</p>
                  <p className="font-medium text-gray-800 mt-0.5">{admin.address2}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500">City</p>
                <p className="font-medium text-gray-800 mt-0.5">{admin.city || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">District</p>
                <p className="font-medium text-gray-800 mt-0.5">{admin.district || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">State</p>
                <p className="font-medium text-gray-800 mt-0.5">{admin.state || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Pincode</p>
                <p className="font-medium text-gray-800 mt-0.5">{admin.pincode || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Country</p>
                <p className="font-medium text-gray-800 mt-0.5">{admin.country || "India"}</p>
              </div>
            </div>
          </div>

          {/* Assigned POS Machines */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-primary" />
                Assigned POS Machines ({posMachines.length})
              </h2>
            </div>
            {posMachines.length === 0 ? (
              <p className="text-sm text-gray-500 py-3 text-center">No POS machines currently assigned to this admin.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
                      <th className="p-2.5">Serial No</th>
                      <th className="p-2.5">TID</th>
                      <th className="p-2.5">MID</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posMachines.map((pos) => (
                      <tr key={pos.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                        <td className="p-2.5 font-semibold text-gray-800">
                          {pos.device_serial_number || pos.serial_number || "-"}
                        </td>
                        <td className="p-2.5 text-gray-600">{pos.tid_number || "-"}</td>
                        <td className="p-2.5 text-gray-600">{pos.mid_number || "-"}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              pos.status === "active"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {pos.status || "active"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 col) */}
        <div className="space-y-6">
          {/* Wallet Overview */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-3">
            <h3 className="text-sm font-semibold text-gray-500">Wallet Balance</h3>
            <div className="text-3xl font-extrabold text-gray-900">
              ₹{Number(admin.wallet_balance ?? admin.wallet ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-gray-400">Available main balance for this admin account.</p>
          </div>

          {/* Identity & Legal Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Identification Numbers
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Aadhaar Number</p>
                <p className="font-mono font-medium text-gray-800 mt-0.5">{admin.aadhar_number || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">PAN Number</p>
                <p className="font-mono font-medium text-gray-800 mt-0.5 uppercase">{admin.pan_number || "-"}</p>
              </div>
            </div>
          </div>

          {/* Uploaded Documents */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <FileText className="w-5 h-5 text-primary" />
              Uploaded Documents
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              {renderDocumentPreview("Aadhaar Front", admin.aadhar_photo || admin.aadhar_photo_url)}
              {renderDocumentPreview("Aadhaar Back", admin.aadhar_back_photo || admin.aadhar_back_photo_url)}
              {renderDocumentPreview("PAN Card", admin.pan_photo || admin.pan_photo_url)}
              {renderDocumentPreview("Bank Passbook", admin.bank_passbook || admin.bank_passbook_url)}
              {renderDocumentPreview("Shop / Office", admin.shop_photo || admin.shop_photo_url)}
              {!admin.aadhar_photo &&
                !admin.aadhar_back_photo &&
                !admin.pan_photo &&
                !admin.bank_passbook &&
                !admin.shop_photo && (
                  <p className="text-xs text-gray-400 text-center py-4">No documents uploaded.</p>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProfile;
