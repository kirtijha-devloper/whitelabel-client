import React, { useState } from "react";
import Table from "../components/Table";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import {
  Eye,
  Loader2,
  SquarePen,
  MoreHorizontal,
  Building,
} from "lucide-react";

import { toast } from "react-toastify";
import { BASE_SITE_URL } from "../constants";

/**
 * Resolves uploaded image path to full URL (supporting absolute URLs and /uploads/ paths)
 */
const resolveLogoUrl = (logoPath) => {
  if (!logoPath || typeof logoPath !== "string") return null;
  const trimmed = logoPath.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const clean = trimmed.replace(/\\/g, "/");
  const slashPrefixed = clean.startsWith("/") ? clean : `/${clean}`;
  return `${BASE_SITE_URL}${slashPrefixed}`;
};

import { extractUsersArray, normalizeUserRole } from "../utils/userAccess";
import {
  hasPermission,
  isAdminUser,
} from "../utils/accessControl";

import {
  getAdminList,
  updateAdminStatus,
  updateAdmin,
} from "../api/superAdminApi";

import ServiceManagementModal from "../components/SuperAdmin/ServiceManagementModal";
import AdminActionMenuModal from "../components/SuperAdmin/AdminActionMenuModal";
import AdminWalletModal from "../components/SuperAdmin/AdminWalletModal";
import AdminRateModal from "../components/SuperAdmin/AdminRateModal";
import ConfirmationModal from "../components/Common/ConfirmationModal";


/* =========================================================
   SERVICE LABELS
========================================================= */

const SERVICE_LABELS = {
  pos: "POS",
  pg: "PG",
  qr: "QR",
  soundbox: "Soundbox",
  dmt: "DMT",
  billpayments: "Bill Payments",
};


/* =========================================================
   ADMIN LIST
========================================================= */

const AdminList = ({
  currentUser,
  title = "Admin List",
}) => {

  /* =========================================================
     STATES
  ========================================================= */

  const [searchInputValue, setSearchInputValue] = useState("");

  const [committedSearch, setCommittedSearch] = useState("");

  const [isExporting, setIsExporting] = useState(false);

  const [statusUpdatingId, setStatusUpdatingId] = useState(null);

  /* Management Modals */

  const [isAdminActionMenuOpen, setIsAdminActionMenuOpen] = useState(false);

  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);

  const [selectedAdminForAction, setSelectedAdminForAction] = useState(null);

  const [selectedCompany, setSelectedCompany] = useState(null);

  const [isRateModalOpen, setIsRateModalOpen] = useState(false);

  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    variant: "primary",
    onConfirm: () => {},
  });


  /* =========================================================
     PAGINATION
  ========================================================= */

  const [adminParams, setAdminParams] = useState({
    page: 1,
    limit: 10,
    status: "",
  });

  const [searchPage, setSearchPage] = useState(1);

  const searchPageSize = 10;

  const isSearchMode = Boolean(committedSearch);


  /* =========================================================
     ROUTER / QUERY CLIENT
  ========================================================= */

  const navigate = useNavigate();

  const queryClient = useQueryClient();


  /* =========================================================
     ROLE / PERMISSION
  ========================================================= */

  const normalizedCurrentUserRole =
    normalizeUserRole(currentUser?.role);

  const isAdmin = isAdminUser(currentUser);

  const isSuperAdminViewer =
    normalizedCurrentUserRole === "super_admin";


  const canListUsers =
    isSuperAdminViewer ||
    hasPermission(currentUser, "users.list");


  const canSearchUsers =
    isSuperAdminViewer ||
    hasPermission(currentUser, "users.search");


  const canReadUsers =
    isSuperAdminViewer ||
    hasPermission(currentUser, "users.read");


  const canUpdateUsers =
    isSuperAdminViewer ||
    hasPermission(currentUser, "users.update");


  const canUpdateUserStatus =
    isSuperAdminViewer ||
    hasPermission(
      currentUser,
      "users.status.update"
    );


  const canManageUserServiceSettings =
    isSuperAdminViewer ||
    isAdmin ||
    hasPermission(
      currentUser,
      "users.service_settings.manage"
    );


  /* =========================================================
     GET ADMIN LIST
  ========================================================= */

  const {
    data: allAdminsResponse,
    isLoading: allAdminsLoading,
    error: allAdminsError,
    refetch: refetchAllAdmins,
  } = useQuery({
    queryKey: ["adminList", adminParams],

    queryFn: () =>
      getAdminList(adminParams),

    enabled:
      !isSearchMode &&
      canListUsers,
  });


  /* =========================================================
     SEARCH ADMIN
  ========================================================= */

  const {
    data: searchResponse,
    isLoading: searchLoading,
    error: searchError,
  } = useQuery({
    queryKey: [
      "adminSearch",
      committedSearch,
      adminParams.status,
      searchPage,
      searchPageSize,
    ],

    queryFn: () =>
      getAdminList({
        search: committedSearch,
        status: adminParams.status,
        limit: searchPageSize,
        page: searchPage,
      }),

    enabled:
      isSearchMode &&
      canSearchUsers,

    staleTime: 30 * 1000,
  });


  /* =========================================================
     DATA
  ========================================================= */

  const allAdmins = allAdminsResponse
    ? extractUsersArray(allAdminsResponse)
    : [];


  const searchAdmins = searchResponse
    ? extractUsersArray(searchResponse)
    : [];


  const currentData =
    isSearchMode
      ? searchAdmins
      : allAdmins;


  const isLoading =
    isSearchMode
      ? searchLoading
      : allAdminsLoading;


  const isError =
    isSearchMode
      ? searchError
      : allAdminsError;


  const totalResults = Number(
    (
      isSearchMode
        ? searchResponse?.pagination?.total
        : allAdminsResponse?.pagination?.total
    ) ??
      currentData.length
  );


  const totalPages = Number(
    (
      isSearchMode
        ? searchResponse?.pagination?.totalPages
        : allAdminsResponse?.pagination?.totalPages
    ) ?? 1
  );


  const currentPage =
    isSearchMode
      ? searchPage
      : adminParams.page;


  /* =========================================================
     SEARCH
  ========================================================= */

  const handleSearchSubmit = (e) => {

    e.preventDefault();

    const term =
      searchInputValue.trim();

    setSearchPage(1);

    setCommittedSearch(term);

    setSearchInputValue("");
  };


  const handleSearchClear = () => {

    setSearchInputValue("");

    setCommittedSearch("");

    setSearchPage(1);
  };


  /* =========================================================
     FILTER
  ========================================================= */

  const handleFilterChange = (
    key,
    value
  ) => {

    setAdminParams((prev) => ({
      ...prev,

      [key]: value,

      page: 1,
    }));
  };


  /* =========================================================
     PAGINATION
  ========================================================= */

  const handlePageChange = (
    newPage
  ) => {

    if (isSearchMode) {

      setSearchPage(newPage);

    } else {

      setAdminParams((prev) => ({
        ...prev,

        page: newPage,
      }));

    }
  };


  /* =========================================================
     STATUS UPDATE
  ========================================================= */

  const executeToggleStatus = async (row, nextStatus) => {
    if (!canUpdateUserStatus || !row?.id) return;

    try {
      setStatusUpdatingId(String(row.id));
      await updateAdminStatus(row.id, nextStatus);
      toast.success(
        `${row?.name || "Admin"} status changed to ${
          nextStatus === "active" ? "active" : "inactive"
        }.`
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["adminList"] }),
        queryClient.invalidateQueries({ queryKey: ["adminSearch"] }),
      ]);

      if (typeof refetchAllAdmins === "function") {
        await refetchAllAdmins();
      }
    } catch (error) {
      toast.error(error?.message || "Failed to update admin status.");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleToggleStatus = (row, nextStatus) => {
    if (!canUpdateUserStatus || !row?.id) return;

    setConfirmConfig({
      isOpen: true,
      title: `${nextStatus === "active" ? "Activate" : "Deactivate"} Administrator?`,
      message: `Are you sure you want to change the status of "${row?.name || "this admin"}" to ${nextStatus}? ${
        nextStatus === "inactive"
          ? "This will temporarily prevent portal login and transaction actions for this admin."
          : "This will restore full portal access for this admin."
      }`,
      confirmText: nextStatus === "active" ? "Activate Admin" : "Deactivate Admin",
      cancelText: "Cancel",
      variant: nextStatus === "active" ? "success" : "danger",
      onConfirm: async () => {
        setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        await executeToggleStatus(row, nextStatus);
      },
    });
  };


  /* =========================================================
     VIEW ADMIN
  ========================================================= */

  const handleViewAdmin = (admin) => {
    if (!admin?.id) return;
    navigate(`/super-admin/user/${admin.id}`);
  };


  /* =========================================================
     EDIT ADMIN
  ========================================================= */

  const handleEditAdmin = (admin) => {
    if (!admin?.id) return;
    navigate(`/super-admin/user/${admin.id}/edit`);
  };


  /* =========================================================
     ADMIN ACTION MENU (THREE DOTS)
  ========================================================= */

  const handleOpenAdminActionMenu = (row) => {
    if (!row) return;
    setSelectedAdminForAction(row);
    setIsAdminActionMenuOpen(true);
  };

  const handleCloseAdminActionMenu = () => {
    setIsAdminActionMenuOpen(false);
  };

  const handleSelectServiceManagement = (admin) => {
    setIsAdminActionMenuOpen(false);
    handleOpenServiceManagement(admin || selectedAdminForAction);
  };

  const handleSelectRateManagement = (admin) => {
    setIsAdminActionMenuOpen(false);
    setSelectedAdminForAction(admin || selectedAdminForAction);
    setIsRateModalOpen(true);
  };

  const handleCloseRateModal = () => {
    setIsRateModalOpen(false);
  };

  const handleSelectWalletManagement = (admin) => {
    setIsAdminActionMenuOpen(false);
    setSelectedAdminForAction(admin || selectedAdminForAction);
    setIsWalletModalOpen(true);
  };

  const handleCloseWalletModal = () => {
    setIsWalletModalOpen(false);
  };

  const handleWalletSuccess = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["adminList"] }),
      queryClient.invalidateQueries({ queryKey: ["adminSearch"] }),
    ]);
    if (typeof refetchAllAdmins === "function") {
      await refetchAllAdmins();
    }
  };


  /* =========================================================
     OPEN SERVICE MANAGEMENT
  ========================================================= */

  const handleOpenServiceManagement = (
    row
  ) => {

    if (!row) {
      return;
    }


    /*

      Company object preferred.

      If API already sends:

      row.company

      then modal receives company details.

    */

    const companyData = {

      id:
        row.company?.id ||
        row.company_id ||
        row.id,

      company_id:
        row.company?.company_id ||
        row.company_id ||
        "",

      company_name:
        row.company?.company_name ||
        row.company_or_shop_name ||
        row.name ||
        "Company",

      services:
        row.company?.services ||
        row.services ||
        {
          pos: true,
          pg: true,
          qr: true,
          soundbox: true,
          dmt: true,
          billpayments: true,
        },
    };


    setSelectedCompany(
      companyData
    );


    setIsServiceModalOpen(
      true
    );
  };


  /* =========================================================
     CLOSE SERVICE MANAGEMENT
  ========================================================= */

  const handleCloseServiceManagement = () => {

    setIsServiceModalOpen(false);

    setSelectedCompany(null);
  };


  /* =========================================================
     SAVE SERVICES
  ========================================================= */

  const handleSaveServices = async ({
    companyId,
    company_id,
    services,
  }) => {

    try {

      /*
       * IMPORTANT:
       *
       * Backend must accept `services`
       * in updateAdmin/update company API.
       *
       * If your backend uses another field
       * such as `service_settings`,
       * change it here.
       */

      await updateAdmin(
        companyId,
        {
          services: services,
          company_id: company_id,
        }
      );


      toast.success(
        "Services updated successfully."
      );


      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["adminList"],
        }),

        queryClient.invalidateQueries({
          queryKey: ["adminSearch"],
        }),

        queryClient.invalidateQueries({
          queryKey: ["adminServices"],
        }),

        queryClient.invalidateQueries({
          queryKey: ["superAdminServices"],
        }),
      ]);


      if (
        typeof refetchAllAdmins ===
        "function"
      ) {
        await refetchAllAdmins();
      }

    } catch (error) {

      toast.error(
        error?.message ||
          "Failed to update services."
      );

      throw error;
    }
  };


  /* =========================================================
     EXPORT EXCEL
  ========================================================= */

  const handleExport = async () => {

    try {

      setIsExporting(true);


      const total =
        totalResults > 0
          ? totalResults
          : 1000;


      const response =
        await getAdminList({
          search: isSearchMode
            ? committedSearch
            : undefined,

          status:
            adminParams.status,

          limit: total,

          page: 1,
        });


      const exportAdmins =
        extractUsersArray(
          response
        );


      if (
        !Array.isArray(
          exportAdmins
        ) ||
        exportAdmins.length === 0
      ) {

        toast.info(
          "No admin data available to export."
        );

        return;
      }


      const rows =
        exportAdmins.map(
          (item, index) => ({
            SL: index + 1,

            Name:
              item.name || "-",

            Email:
              item.email || "-",

            Mobile:
              item.mobile_number ||
              "-",

            Username:
              item.username ||
              item.abheepay_id ||
              "-",

            "Company Name":
              item.company
                ?.company_name ||
              item.company_or_shop_name ||
              "-",

            "Domain Name":
              item.company
                ?.domain_name ||
              "-",

            Status:
              item.status ||
              "active",

            "Created At":
              item.createdAt
                ? new Date(
                    item.createdAt
                  ).toLocaleDateString()
                : "-",
          })
        );


      const worksheet =
        XLSX.utils.json_to_sheet(
          rows
        );


      const workbook =
        XLSX.utils.book_new();


      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Admins"
      );


      const excelBuffer =
        XLSX.write(
          workbook,
          {
            bookType: "xlsx",
            type: "array",
          }
        );


      const blob =
        new Blob(
          [excelBuffer],
          {
            type:
              "application/octet-stream",
          }
        );


      saveAs(
        blob,
        "AdminList.xlsx"
      );


      toast.success(
        "Admin list exported successfully."
      );

    } catch (error) {

      toast.error(
        error?.message ||
          "Failed to export admin list."
      );

    } finally {

      setIsExporting(false);
    }
  };


  /* =========================================================
     TABLE DATA
  ========================================================= */

  const baseIndex =
    isSearchMode
      ? (searchPage - 1) *
        searchPageSize
      : (adminParams.page - 1) *
        adminParams.limit;


  const tableData =
    currentData.map(
      (row, idx) => ({
        ...row,

        sl:
          baseIndex +
          idx +
          1,
      })
    );


  /* =========================================================
     TABLE COLUMNS
  ========================================================= */

  const columns = [

    {
      header: "SL",

      key: "sl",
    },


    {
      header: "Admin / User",

      key: "name",

      render: (
        name,
        row
      ) => (

        <div className="space-y-0.5">

          <div className="font-medium text-gray-900">
            {name || "-"}
          </div>

          <div className="text-xs text-gray-600">
            {row.mobile_number || "-"}
          </div>

          <div className="text-xs text-gray-500">
            {row.username ||
              row.abheepay_id ||
              "-"}
          </div>

        </div>
      ),
    },


    {
      header: "Email",

      key: "email",

      render: (
        email
      ) => (

        <span className="text-sm text-gray-700">
          {email || "-"}
        </span>
      ),
    },


    {
      header: "Company",

      key: "company",

      render: (
        _value,
        row
      ) => {
        const companyName =
          row.company?.company_name || row.company_or_shop_name || "-";
        const domainName = row.company?.domain_name || "-";
        const logoUrl = resolveLogoUrl(
          row.company?.company_logo || row.shop_with_photo_url
        );

        return (
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={companyName}
                className="h-9 w-9 rounded-lg object-contain border border-gray-200 bg-white p-0.5 shadow-xs shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const fallback = e.currentTarget.nextElementSibling;
                  if (fallback) fallback.style.display = "flex";
                }}
              />
            ) : null}
            <div
              className={`h-9 w-9 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 font-bold text-xs flex items-center justify-center shrink-0 ${
                logoUrl ? "hidden" : "flex"
              }`}
            >
              {companyName && companyName !== "-"
                ? companyName.charAt(0).toUpperCase()
                : <Building className="h-4 w-4 text-teal-600" />}
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="font-medium text-gray-900 truncate max-w-[200px]" title={companyName}>
                {companyName}
              </div>
              <div className="text-xs text-blue-600 truncate max-w-[200px]" title={domainName}>
                {domainName}
              </div>
            </div>
          </div>
        );
      },
    },


    {
      header: "Status",

      key: "status",

      render: (
        status
      ) => (

        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold ${
            status === "active"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {status || "active"}
        </span>
      ),
    },
  ];


  /* =========================================================
     ACTIONS
     
     IMPORTANT:
     
     DO NOT PUT <button> INSIDE label.
     
     Table component already creates
     the outer button.
  ========================================================= */

  const actions = [];


  /* VIEW */

  if (canReadUsers) {

    actions.push({

      label: (
        <Eye
          className="text-blue-500 transition-colors hover:text-blue-700"
          size={20}
        />
      ),

      onClick: (
        row
      ) =>
        handleViewAdmin(row),
    });
  }


  /* EDIT */

  if (canUpdateUsers) {

    actions.push({

      label: (
        <SquarePen
          className="text-primary transition-colors hover:opacity-80"
          size={20}
        />
      ),

      onClick: (
        row
      ) =>
        handleEditAdmin(row),
    });
  }


  /* ENABLE / DISABLE */

  if (canUpdateUserStatus) {

    actions.push({

      label: (
        row
      ) => {

        const isUpdating =
          statusUpdatingId ===
          String(row?.id);


        const isActive =
          row?.status === "active";


        return (

          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
              isActive
                ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
            }`}
          >

            {isUpdating && (

              <Loader2
                className="h-3 w-3 animate-spin"
              />

            )}

            {isActive
              ? "Disable"
              : "Enable"}

          </span>
        );
      },

      onClick: (
        row
      ) =>
        handleToggleStatus(
          row,

          row?.status === "active"
            ? "inactive"
            : "active"
        ),
    });
  }


  /* =========================================================
     ADMIN MANAGEMENT (THREE DOTS MENU)
     
     label contains ONLY ICON.
     Table will create the button itself.
  ========================================================= */

  if (
    canManageUserServiceSettings ||
    isSuperAdminViewer ||
    isAdmin
  ) {

    actions.push({

      label: (

        <MoreHorizontal
          size={21}
          className="text-gray-600 transition-colors hover:text-gray-900"
        />

      ),

      onClick: (
        row
      ) =>
        handleOpenAdminActionMenu(
          row
        ),
    });
  }



  /* =========================================================
     ACCESS CHECK
  ========================================================= */

  if (!canListUsers) {

    return (

      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">

        <h2 className="text-xl font-semibold text-gray-900">

          User List Access Required

        </h2>


        <p className="mt-2 text-sm text-gray-500">

          This account does not currently have permission to open the user list.

        </p>

      </div>
    );
  }


  /* =========================================================
     UI
  ========================================================= */

  return (

    <div className="min-h-screen bg-gray-100">

      {/* TITLE */}

      <div className="mb-4">

        <h2 className="text-lg font-semibold text-gray-900">

          {title}

        </h2>

      </div>


      <div className="rounded-lg bg-white px-1 py-6 shadow-sm md:p-6">


        {/* =====================================================
            SEARCH
        ===================================================== */}

        {canSearchUsers && (

          <form
            onSubmit={
              handleSearchSubmit
            }
            className="mb-6"
          >

            <label className="mb-2 block text-sm font-medium text-gray-700">

              Search Admins

            </label>


            <div className="flex max-w-md gap-2">

              <input
                type="text"
                value={
                  searchInputValue
                }
                onChange={(e) =>
                  setSearchInputValue(
                    e.target.value
                  )
                }
                placeholder="Name, email, username or mobile..."
                autoComplete="off"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />


              <button
                type="submit"
                disabled={isLoading}
                className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >

                {isLoading &&
                isSearchMode
                  ? "Searching..."
                  : "Search"}

              </button>


              {isSearchMode && (

                <button
                  type="button"
                  onClick={
                    handleSearchClear
                  }
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >

                  Clear

                </button>

              )}

            </div>


            {isSearchMode && (

              <p className="mt-1 text-xs text-gray-500">

                {isLoading
                  ? "Searching..."
                  : `${totalResults} result(s) for "${committedSearch}"`}

              </p>

            )}

          </form>

        )}


        {/* =====================================================
            FILTER + PAGINATION
        ===================================================== */}

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">


          {/* STATUS */}

          <div className="flex flex-wrap gap-3">

            <div>

              <label className="block text-xs font-medium text-gray-500">

                Status

              </label>


              <select
                value={
                  adminParams.status
                }
                onChange={(e) =>
                  handleFilterChange(
                    "status",
                    e.target.value
                  )
                }
                className="mt-1 block w-full rounded-md border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >

                <option value="">
                  All
                </option>

                <option value="active">
                  Active
                </option>

                <option value="inactive">
                  Inactive
                </option>

              </select>

            </div>

          </div>


          {/* RIGHT CONTROLS */}

          <div className="flex flex-col items-end gap-3 text-sm text-gray-600 md:flex-row md:items-center">


            {/* EXCEL */}

            <button
              type="button"
              onClick={
                handleExport
              }
              disabled={
                isExporting ||
                isLoading
              }
              className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >

              {isExporting
                ? "Exporting..."
                : "Download Excel"}

            </button>


            {/* PAGINATION */}

            <div className="flex items-center gap-2">

              <span>

                Page {currentPage} of{" "}
                {totalPages}

              </span>


              <button
                type="button"
                onClick={() =>
                  handlePageChange(
                    Math.max(
                      1,
                      currentPage - 1
                    )
                  )
                }
                disabled={
                  currentPage <= 1 ||
                  isLoading
                }
                className="rounded-md border border-gray-200 bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >

                Prev

              </button>


              <button
                type="button"
                onClick={() =>
                  handlePageChange(
                    Math.min(
                      totalPages,
                      currentPage + 1
                    )
                  )
                }
                disabled={
                  currentPage >=
                    totalPages ||
                  isLoading
                }
                className="rounded-md border border-gray-200 bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >

                Next

              </button>

            </div>

          </div>

        </div>


        {/* =====================================================
            LOADING
        ===================================================== */}

        {isLoading && (

          <p className="py-4 text-sm text-gray-500">

            Loading admin list...

          </p>

        )}


        {/* =====================================================
            ERROR
        ===================================================== */}

        {isError && (

          <p className="py-4 text-sm text-red-500">

            Error loading admin list:{" "}
            {isError.message}

          </p>

        )}


        {/* =====================================================
            TABLE
        ===================================================== */}

        {!isLoading &&
          !isError && (

            <>

              {/* MOBILE */}

              <div className="space-y-4 md:hidden">

                {currentData.length === 0 ? (

                  <div className="rounded-xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">

                    No admins found.

                  </div>

                ) : (

                  currentData.map(
                    (admin) => (

                      <div
                        key={admin.id}
                        className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-md"
                      >

                        <div className="flex items-start justify-between">

                          <div>

                            <h3 className="text-base font-bold text-gray-900">

                              {admin.name ||
                                "-"}

                            </h3>


                            <p className="text-xs text-gray-500">

                              {admin.email ||
                                "-"}

                            </p>


                            <p className="text-xs text-gray-400">

                              {admin.username ||
                                admin.abheepay_id ||
                                "-"}

                            </p>

                          </div>


                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              admin.status ===
                              "active"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >

                            {admin.status ||
                              "active"}

                          </span>

                        </div>


                        <div className="grid grid-cols-2 border-t border-gray-100 pt-2 text-xs">

                          <div>

                            <p className="text-gray-400">
                              Phone
                            </p>

                            <p className="font-semibold text-gray-800">

                              {admin.mobile_number ||
                                "-"}

                            </p>

                          </div>


                          <div>

                            <p className="text-gray-400">
                              Company
                            </p>

                            <div className="flex items-center gap-2 mt-0.5">
                              {resolveLogoUrl(admin.company?.company_logo || admin.shop_with_photo_url) ? (
                                <img
                                  src={resolveLogoUrl(admin.company?.company_logo || admin.shop_with_photo_url)}
                                  alt="Logo"
                                  className="h-6 w-6 rounded object-contain border border-gray-200 bg-white p-0.5 shrink-0"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                  }}
                                />
                              ) : null}
                              <p className="font-semibold text-blue-600 truncate max-w-[140px]">
                                {admin.company
                                  ?.company_name ||
                                  admin.company_or_shop_name ||
                                  "-"}
                              </p>
                            </div>

                          </div>

                        </div>


                        {/* MOBILE ACTIONS */}

                        <div className="flex items-center justify-between border-t border-gray-100 pt-2">

                          <div className="flex gap-2">


                            {canReadUsers && (

                              <button
                                type="button"
                                onClick={() =>
                                  handleViewAdmin(
                                    admin
                                  )
                                }
                                className="rounded-lg p-1.5 text-blue-600 transition-colors hover:bg-blue-50"
                                title="View Admin"
                              >

                                <Eye className="h-4 w-4" />

                              </button>

                            )}


                            {canUpdateUsers && (

                              <button
                                type="button"
                                onClick={() =>
                                  handleEditAdmin(
                                    admin
                                  )
                                }
                                className="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-gray-100"
                                title="Edit Admin"
                              >

                                <SquarePen className="h-4 w-4" />

                              </button>

                            )}


                            {/* MOBILE ADMIN MANAGEMENT BUTTON */}

                            {(canManageUserServiceSettings ||
                              isSuperAdminViewer ||
                              isAdmin) && (

                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenAdminActionMenu(
                                    admin
                                  )
                                }
                                className="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-gray-100"
                                title="Admin Management"
                              >

                                <MoreHorizontal className="h-5 w-5" />

                              </button>

                            )}


                          </div>


                          {canUpdateUserStatus && (

                            <button
                              type="button"
                              onClick={() =>
                                handleToggleStatus(
                                  admin,

                                  admin.status ===
                                    "active"
                                    ? "inactive"
                                    : "active"
                                )
                              }
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                admin.status ===
                                "active"
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : "border-green-200 bg-green-50 text-green-700"
                              }`}
                            >

                              {admin.status ===
                              "active"
                                ? "Disable"
                                : "Enable"}

                            </button>

                          )}

                        </div>

                      </div>

                    )
                  )

                )}

              </div>


              {/* DESKTOP */}

              <div className="hidden md:block">

                <Table
                  columns={columns}
                  data={tableData}
                  actions={actions}
                  actionsHeader="Actions"
                  actionsAlign="center"
                />

              </div>

            </>

          )}

      </div>


      {/* =====================================================
          ADMIN ACTION MENU MODAL (SERVICE / RATE / WALLET)
      ===================================================== */}

      <AdminActionMenuModal
        isOpen={
          isAdminActionMenuOpen
        }
        onClose={
          handleCloseAdminActionMenu
        }
        admin={
          selectedAdminForAction
        }
        onSelectServiceManagement={
          handleSelectServiceManagement
        }
        onSelectRateManagement={
          handleSelectRateManagement
        }
        onSelectWalletManagement={
          handleSelectWalletManagement
        }
      />


      {/* =====================================================
          SERVICE MANAGEMENT MODAL
      ===================================================== */}

      <ServiceManagementModal

        isOpen={
          isServiceModalOpen
        }

        onClose={
          handleCloseServiceManagement
        }

        company={
          selectedCompany
        }

        onSave={
          handleSaveServices
        }

      />


      {/* =====================================================
          ADMIN WALLET MANAGEMENT MODAL
      ===================================================== */}

      <AdminWalletModal
        isOpen={
          isWalletModalOpen
        }
        onClose={
          handleCloseWalletModal
        }
        admin={
          selectedAdminForAction
        }
        onSuccess={
          handleWalletSuccess
        }
      />

      {/* =====================================================
          ADMIN RATE MANAGEMENT MODAL (IN-PLACE MODAL)
      ===================================================== */}
      <AdminRateModal
        isOpen={isRateModalOpen}
        onClose={handleCloseRateModal}
        admin={selectedAdminForAction}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["adminList"] });
          queryClient.invalidateQueries({ queryKey: ["adminSearch"] });
        }}
      />

      {/* =====================================================
          CONFIRMATION MODAL
      ===================================================== */}
      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        cancelText={confirmConfig.cancelText}
        variant={confirmConfig.variant}
      />

    </div>
  );
};


export default AdminList;